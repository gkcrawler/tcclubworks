const {randomUUID}=require('node:crypto');
const stages=['inquiry','quoted','approved','bench','ready','complete'];
const text=(v,n=5000)=>typeof v==='string'?v.slice(0,n):'';
const number=v=>Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v)*100)/100):0;
function formName(row){const d=row.data||{};return d['form-name']||d.form_name||row.form_name||row.formName||'';}
function normalize(rows){
 const quotes=new Map(),approvals=new Map(),inquiries=new Map();
 for(const row of rows){if(!row||typeof row!=='object')continue;const d=row.data||{},f=formName(row);
  if(f==='quote_approval'&&d.token){if(!approvals.has(d.token)||String(row.created_at)>String(approvals.get(d.token).at))approvals.set(d.token,{at:row.created_at,by:text(d.approvedBy||d.name,200)});}
  if(f==='quote'&&row.id)inquiries.set(row.id,{id:String(row.id),customer:text(d.name,200),email:text(d.email,250),phone:text(d.phone,100),type:text(d.service,200),notes:text(d.message||row.body),createdAt:row.created_at||''});
  if(f==='saved_quote'&&d.quotePayload){try{const q=JSON.parse(d.quotePayload);if(!q||typeof q!=='object'||Array.isArray(q)||typeof q.id!=='string'||!/^quote_[A-Za-z0-9_-]{1,200}$/.test(q.id)||!Array.isArray(q.items)||q.items.some(i=>!i||typeof i!=='object'||Array.isArray(i)))continue;if(q.sourceSubmissionId!==undefined&&typeof q.sourceSubmissionId!=='string')continue;if(q.sourceJobId!==undefined&&typeof q.sourceJobId!=='string')continue;const prior=quotes.get(q.id),at=row.created_at||q.updatedAt||'';if(!prior||at>prior.updatedAt)quotes.set(q.id,{...q,updatedAt:at});}catch{}}
 }
 for(const q of quotes.values()){const a=approvals.get(q.approvalToken);if(a){q.status='Approved';q.approvedAt=a.at;}}
 return {quotes:[...quotes.values()],inquiries:[...inquiries.values()]};
}
function emptyState(){return {version:1,jobs:{},manual:{},links:{}};}
function derive(sources,state){
 const candidates=new Map();
 for(const q of sources.quotes){
  const sources=[];if(q.sourceSubmissionId)sources.push('inquiry:'+q.sourceSubmissionId);if(q.sourceJobId&&q.sourceJobId.startsWith('manual:'))sources.push(q.sourceJobId);
  for(const source of sources){if(!candidates.has(source))candidates.set(source,[]);candidates.get(source).push('quote:'+q.id);}
 }
 const links={};for(const [source,targets] of candidates){if(targets.length===1)links[source]=targets[0];}
 Object.assign(links,state.links);
 const quoteIds=new Set(sources.quotes.map(q=>'quote:'+q.id));
 const liveLinks=Object.fromEntries(Object.entries(links).filter(([,target])=>quoteIds.has(target)));
 const inherited=key=>{const sources=Object.keys(liveLinks).filter(k=>liveLinks[k]===key);return Object.assign({},...sources.map(k=>state.jobs[k]||{}),state.jobs[key]||{});};
 const finish=(base,meta)=>{const job={...base,...meta,id:base.id,source:base.source,quote:base.quote,customer:base.customer,email:base.email,phone:base.phone,type:base.type,amount:base.amount,approved:base.approved,createdAt:base.createdAt};
  if(base.approved&&['inquiry','quoted'].includes(job.stage))job.stage='approved';
  job.stage=stages.includes(job.stage)?job.stage:base.stage;job.checks=Array.isArray(job.checks)&&job.checks.length===5?job.checks.map(Boolean):[false,false,false,false,false];job.due=job.due||'';job.notes=job.notes??base.notes;job.archived=Boolean(job.archived);job.linkedSources=Object.keys(liveLinks).filter(k=>liveLinks[k]===base.id);return job;
 };
 const jobs=sources.quotes.map(q=>{
  const status=text(q.status,100),approved=['approved','accepted'].includes(status.trim().toLowerCase()),id='quote:'+q.id;
  const sourceInquiry=sources.inquiries.find(s=>liveLinks['inquiry:'+s.id]===id);
  const base={id,source:'quote',title:text(q.customerService||q.items.find(i=>i.desc)?.desc||q.quoteNumber||'Customer quote',160),customer:text(q.customerName,200),email:text(q.customerEmail,250),phone:text(q.customerPhone,100),type:text(q.customerService,200),notes:text(q.customerMessage||sourceInquiry?.notes||q.notes),amount:number(q.total),approved,stage:['complete','completed','delivered'].includes(status.trim().toLowerCase())?'complete':approved?'approved':'quoted',archived:['cancelled','canceled','declined','rejected'].includes(status.trim().toLowerCase()),createdAt:q.createdAt||q.quoteDate||q.updatedAt,sourceUpdatedAt:q.updatedAt,quote:{id:q.id,number:text(q.quoteNumber,100),status,approvedAt:q.approvedAt||null,items:q.items.map(i=>({desc:text(i.desc,1000),qty:number(i.qty),unit:number(i.unit),total:number(i.total??number(i.qty)*number(i.unit))})),subtotal:number(q.subtotal),discount:number(q.discount),tax:number(q.tax),total:number(q.total),depositDue:number(q.deposit)}};
  return finish(base,inherited(id));
 });
 for(const i of sources.inquiries){const id='inquiry:'+i.id;if(liveLinks[id])continue;jobs.push(finish({...i,id,source:'inquiry',title:i.type||'New inquiry',amount:null,approved:false,stage:'inquiry'},state.jobs[id]||{}));}
 for(const [id,m] of Object.entries(state.manual)){if(liveLinks[id])continue;jobs.push(finish({...m,id,source:'manual',amount:null,approved:false,stage:'inquiry'},state.jobs[id]||{}));}
 return jobs.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
}
function error(message,status=400){return Object.assign(new Error(message),{status});}
function updateState(state,sources,input,now=new Date().toISOString()){
 const next=structuredClone(state),jobs=derive(sources,state);let target;
 if(input.action==='create'){
  if(!text(input.customer,200).trim()||!text(input.title,160).trim())throw error('Enter a customer name and job title.');
  target='manual:'+randomUUID();next.manual[target]={customer:text(input.customer,200).trim(),title:text(input.title,160).trim(),email:text(input.email,250).trim(),phone:text(input.phone,100).trim(),type:text(input.type,200),notes:'',createdAt:now};
  next.jobs[target]={due:validDate(input.due||''),notes:text(input.notes),updatedAt:now};
 }else if(input.action==='link'){
  const from=jobs.find(j=>j.id===input.id),to=jobs.find(j=>j.id===input.quoteId&&j.source==='quote');
  if(!from||from.source==='quote'||!to)throw error('Choose an unlinked inquiry or manual job and a saved quote.');
  next.links[from.id]=to.id;next.jobs[to.id]={...(next.jobs[from.id]||{}),...(next.jobs[to.id]||{}),updatedAt:now};target=to.id;
 }else if(input.action==='deleteManual'){
  if(!next.manual[input.id])throw error('Only a manually created job can be deleted.');
  delete next.manual[input.id];delete next.jobs[input.id];delete next.links[input.id];target=null;
 }else if(input.action==='update'){
  const job=jobs.find(j=>j.id===input.id);if(!job)throw error('This job no longer exists. Refresh the board.',404);
  const p=input.patch;if(!p||typeof p!=='object'||Array.isArray(p))throw error('Invalid job update.');
  const allowed=['title','due','notes','stage','checks','archived'];if(Object.keys(p).some(k=>!allowed.includes(k)))throw error('Unsupported job field.');
  const meta={...(next.jobs[job.id]||{})};
  if('title'in p){if(typeof p.title!=='string'||!p.title.trim())throw error('Job title is required.');meta.title=p.title.trim().slice(0,160);}
  if('notes'in p){if(typeof p.notes!=='string'||p.notes.length>10000)throw error('Notes must be under 10,000 characters.');meta.notes=p.notes;}
  if('due'in p)meta.due=validDate(p.due);
  if('checks'in p){if(!Array.isArray(p.checks)||p.checks.length!==5||p.checks.some(x=>typeof x!=='boolean'))throw error('Invalid checklist.');meta.checks=p.checks;}
  if('stage'in p){if(!stages.includes(p.stage))throw error('Invalid job stage.');meta.stage=p.stage;}
  if('archived'in p){if(typeof p.archived!=='boolean')throw error('Invalid archive value.');meta.archived=p.archived;}
  meta.updatedAt=now;meta.history=[...(meta.history||[]),{at:now,fields:Object.keys(p)}].slice(-30);next.jobs[job.id]=meta;target=job.id;
 }else throw error('Unknown action.');
 next.updatedAt=now;next.writeId=randomUUID();if(Buffer.byteLength(JSON.stringify(next))>1000000)throw error('The shop record limit has been reached.',413);return {state:next,id:target};
}
function validDate(d){if(d==='')return '';if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw error('Enter a valid due date.');return d;}
module.exports={normalize,derive,emptyState,updateState,error,stages};
