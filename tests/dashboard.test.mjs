import test from 'node:test';
import assert from 'node:assert/strict';
import dashboard from '../netlify/functions/dashboard.mjs';
import ingest from '../netlify/functions/dashboard-report.mjs';
import {dateWindow, websiteLeads, validateReport} from '../netlify/lib/dashboard-data.mjs';
import {retailState, changeRetail} from '../netlify/lib/dashboard-store.mjs';
import shopData from '../netlify/lib/shop-data.cjs';

test('Denver window counts verified inquiries by receipt date, including linked open quotes',()=>{
  const now=new Date('2026-11-24T01:30:00Z');
  assert.deepEqual(dateWindow(now),{start:'2026-10-25',end:'2026-11-23'});
  const sources={inquiries:[['abc','2026-10-25T06:00:00Z'],['old','2026-10-25T05:59:00Z'],
    ['closed','2026-11-05T10:00:00Z'],['6b03503599cea071273d216f','2026-11-22T20:27:33Z']].map(([id,createdAt])=>({id,createdAt,type:'Repair'})),
    quotes:[{id:'quote_linked',items:[],createdAt:'2026-11-17',sourceSubmissionId:'abc'}]};
  const state=shopData.emptyState();state.jobs['inquiry:closed']={archived:true};
  const result=websiteLeads(sources,state,now);assert.equal(result.total,2);
  assert.deepEqual(result.open.map(x=>[x.id,x.day]),[['quote:quote_linked','2026-10-25']]);
});
test('unauthenticated clients cannot see leads, post reports or change visibility',async()=>{
  assert.equal((await dashboard(new Request('https://tcclubworks.io/.netlify/functions/dashboard?section=leads'))).status,401);
  assert.equal((await dashboard(new Request('https://tcclubworks.io/.netlify/functions/dashboard',{method:'POST'}))).status,401);
  assert.equal((await ingest(new Request('https://tcclubworks.io/.netlify/functions/dashboard-report',{method:'POST'}))).status,401);
});
test('report input preserves genuine zeros, missing ads and rejects stale or unexpected data',()=>{
  const now=new Date('2026-11-24T01:00Z');
  const value={property:'properties/550152616',asOf:now.toISOString(),...dateWindow(now),traffic:[0,0],
    clicks:{click_to_call:0,click_to_text:0,click_to_email:0},ads:null,daily:[]};
  assert.equal(validateReport(value,now).ads,null);
  assert.deepEqual(validateReport({...value,ads:[0,0,0]},now).ads,[0,0,0]);
  assert.equal(validateReport({...value,property:'wrong'},now),null);
  assert.equal(validateReport({...value,daily:[['20251001',5]]},now),null);
});
test('visibility uses conditional writes, reports the deployed state and allows a failed publish to retry',async()=>{
  let entry=null,serial=0;
  const store={getWithMetadata:async()=>entry,setJSON:async(k,data,opt)=>{
    if(entry ? opt.onlyIfMatch!==entry.etag : !opt.onlyIfNew)return {modified:false};
    entry={data,etag:String(++serial)};return {modified:true,etag:entry.etag};
  }};
  const initial=await retailState(store);const input={visible:!initial.active,revision:initial.revision};
  const first=await changeRetail(store,input,async()=>{throw Error('offline');});assert.equal(first.status,502);
  const failed=await retailState(store);assert.equal(failed.active,initial.active);assert.equal(failed.failed,true);
  assert.equal((await changeRetail(store,input,async()=>{})).status,409);
  const second=await changeRetail(store,{...input,revision:failed.revision},async()=>{});
  assert.equal(second.status,202);const accepted=await second.json();assert.equal(accepted.active,initial.active);
  assert.equal((await changeRetail(store,{...input,revision:accepted.revision},async()=>{})).status,409);
});
