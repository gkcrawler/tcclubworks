const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/admin-quotes');
const originalFetch = global.fetch;
const originalTimeout = global.setTimeout;
const originalEnv = { ...process.env };
afterEach(() => { global.fetch = originalFetch; global.setTimeout = originalTimeout; process.env = { ...originalEnv }; });
const quote = { id:'quote_test', approvalToken:'approve_test', items:[{desc:'Grip',qty:1,unit:12}], quoteNumber:'TEST', total:12 };
const row = { id:'submission-1', form_name:'saved_quote', data:{quotePayload:JSON.stringify(quote)} };
function setup() {
 Object.assign(process.env, {QUOTE_ADMIN_PASSWORD:'test-only',NETLIFY_API_TOKEN:'test-api',NETLIFY_SITE_ID:'test-site',URL:'https://example.netlify.app'});
 global.setTimeout = (fn) => { fn(); return 0; };
 return { httpMethod:'POST', headers:{authorization:'Basic '+Buffer.from('admin:test-only').toString('base64')}, body:JSON.stringify(quote) };
}
const response = (data, status=200) => ({ok:status<400,status,json:async()=>data});
test('unauthenticated saves never reach storage', async()=>{
 const event=setup(); event.headers={}; global.fetch=()=>assert.fail('Unexpected storage call');
 assert.equal((await handler(event)).statusCode,401);
});
test('rejects malformed quote before storage',async()=>{
 const event=setup(); event.body='{}'; global.fetch=()=>assert.fail('Unexpected storage call');
 assert.equal((await handler(event)).statusCode,400);
});
test('confirms verified save and submits exact quote payload without credentials',async()=>{
 const event=setup(); let posted=false;
 global.fetch=async(url,opts)=>{
  if(opts.method==='POST') { posted=true; assert.equal(opts.headers.Authorization,undefined); assert.equal(new URLSearchParams(opts.body).get('quotePayload'),JSON.stringify(quote)); return response({}); }
  return response([row]);
 };
 const res=await handler(event); assert.equal(res.statusCode,200); assert.ok(posted); assert.deepEqual(JSON.parse(res.body).quote,quote);
});
test('recovers only the exact authenticated quote from spam and confirms visibility',async()=>{
 const event=setup(); let promoted=false;
 global.fetch=async(url,opts)=>{
  if(opts.method==='POST') return response({});
  if(opts.method==='PUT') {assert.match(String(url),/\/submission-1\/ham$/); promoted=true; return response({});}
  if(String(url).includes('state=spam')) return response([{...row,id:'unrelated',data:{quotePayload:'{}'}},row]);
  return response(promoted?[row]:[]);
 };
 assert.equal((await handler(event)).statusCode,200); assert.ok(promoted);
});
test('does not report success for HTTP 200 without a retrievable record or promote unrelated spam',async()=>{
 const event=setup();
 global.fetch=async(url,opts)=>{assert.notEqual(opts.method,'PUT'); return response(opts.method==='POST'?{}:[{...row,data:{quotePayload:'{}'}}]);};
 assert.equal((await handler(event)).statusCode,503);
});
test('failed spam verification is a failed save',async()=>{
 const event=setup();
 global.fetch=async(url,opts)=>response(opts.method==='POST'?{}:String(url).includes('state=spam')?[row]:[],opts.method==='PUT'?403:200);
 assert.equal((await handler(event)).statusCode,500);
});
test('history includes quotes after the first 100 submissions',async()=>{
 const event=setup(); event.httpMethod='GET';
 global.fetch=async(url)=>response(String(url).includes('page=2&')?[row]:Array.from({length:100},()=>({form_name:'quote',data:{}})));
 const res=await handler(event); assert.equal(res.statusCode,200); assert.equal(JSON.parse(res.body).quotes[0].id,quote.id);
});
