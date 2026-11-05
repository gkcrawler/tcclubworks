import {getStore} from '@netlify/blobs';
import {createHash} from 'node:crypto';
import auth from '../lib/shop-auth.cjs';
import data from '../lib/shop-data.cjs';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Vary':'Cookie'};
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
let cache=null;
async function readSources(force=false){
 if(!force&&cache&&Date.now()-cache.time<30000)return cache;
 const token=process.env.NETLIFY_API_TOKEN||process.env.NETLIFY_AUTH_TOKEN,site=process.env.NETLIFY_SITE_ID||process.env.SITE_ID;
 if(!token||!site)throw data.error('The quote connection is not configured.',503);
 const rows=[];
 for(let page=1;page<=1000;page++){
  const r=await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(site)}/submissions?per_page=100&page=${page}&state=verified`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw data.error('Unable to refresh quotes and inquiries. Please try again.',502);
  const batch=await r.json();if(!Array.isArray(batch))throw data.error('Invalid response from quote storage.',502);rows.push(...batch);
  if(batch.length<100){cache={...data.normalize(rows),time:Date.now(),fetchedAt:new Date().toISOString()};return cache;}
 }
 throw data.error('Too many source records. Contact the site administrator.',503);
}
function stateStore(){return getStore({name:process.env.SHOP_STORE_NAME||'ccw-shop-v1',consistency:'strong'});}
async function rateLimit(ip){
 const store=getStore({name:'ccw-shop-login-limits',consistency:'strong'}),key=createHash('sha256').update(ip||'unknown').digest('hex');
 for(let i=0;i<4;i++){
  const entry=await store.getWithMetadata(key,{type:'json'}),now=Date.now(),old=entry?.data;
  const bucket=old&&now-old.start<15*60000?old:{start:now,count:0};
  if(bucket.count>=10)throw data.error('Too many sign-in attempts. Please try again in 15 minutes.',429);
  const result=await store.setJSON(key,{start:bucket.start,count:bucket.count+1},entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});if(result.modified)return;
 }
 throw data.error('Sign-in is busy. Please try again.',503);
}
export function createHandler(deps={}){
 const storeFactory=deps.storeFactory||stateStore,sourcesFn=deps.readSources||readSources,limit=deps.rateLimit||rateLimit;
 return async function(req,context={}){
  try{
   const url=new URL(req.url),method=req.method;
   if(!['GET','POST'].includes(method))return json(405,{message:'Method not allowed.'},{Allow:'GET, POST'});
   if(method==='POST'&&req.headers.get('origin')!==url.origin)return json(403,{message:'This request must come from the dashboard.'});
   let input={};
   if(method==='POST'){
    if(!req.headers.get('content-type')?.startsWith('application/json'))return json(415,{message:'JSON is required.'});
    if(Number(req.headers.get('content-length'))>50000)return json(413,{message:'Request is too large.'});
    const body=await req.text();if(Buffer.byteLength(body)>50000)return json(413,{message:'Request is too large.'});
    try{input=JSON.parse(body);}catch{return json(400,{message:'Invalid request.'});}
    if(!input||typeof input!=='object'||Array.isArray(input))return json(400,{message:'Invalid request.'});
    if(input.action==='login'){
     if(!auth.password())return json(503,{message:'The shop password is not configured.'});
     await limit(context.ip);
     if(!auth.validPassword(input.password))return json(401,{message:'That password was not accepted.'});
     return json(200,{ok:true},{'Set-Cookie':auth.issueSession(input.remember===true)});
    }
    if(input.action==='logout')return json(200,{ok:true},{'Set-Cookie':auth.clearSession()});
   }
   if(!auth.validSession(req.headers.get('cookie')||''))return json(401,{message:'Sign in to your shop dashboard.'});
   const store=storeFactory();
   const [entry,sources]=await Promise.all([store.getWithMetadata('board',{type:'json'}),sourcesFn(url.searchParams.get('refresh')==='1'||method==='POST')]);
   const state=entry?.data||data.emptyState(),revision=entry?.etag||'new';
   const response=(s,rev,id)=>({jobs:data.derive(sources,s),revision:rev,selectedId:id||null,sourceFetchedAt:sources.fetchedAt,counts:{quotes:sources.quotes.length,inquiries:sources.inquiries.length},updatedAt:s.updatedAt||null});
   if(method==='GET')return json(200,response(state,revision));
   if(input.revision!==revision)return json(409,{message:'Another window updated the shop. Refresh before saving your change.'});
   const updated=data.updateState(state,sources,input);
   const result=await store.setJSON('board',updated.state,entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true});
   if(!result.modified)return json(409,{message:'Another window updated the shop. Refresh before saving your change.'});
   const confirmed=await store.getWithMetadata('board',{type:'json'});
   if(!confirmed||confirmed.data.writeId!==updated.state.writeId)return json(409,{message:'The board changed while saving. Refresh to see the latest version.'});
   return json(200,response(confirmed.data,confirmed.etag,updated.id));
  }catch(err){console.error('Shop request failed:',err.status||500,err.status?err.message:'internal error');return json(err.status||503,{message:err.status?err.message:'The shop connection is temporarily unavailable. Please try again.'});}
 };
}
export default createHandler();
