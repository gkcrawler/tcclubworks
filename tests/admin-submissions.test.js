const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/admin-submissions');
const originalFetch = global.fetch;
const originalEnv = { ...process.env };
afterEach(() => { global.fetch = originalFetch; process.env = { ...originalEnv }; });
function setup() {
  Object.assign(process.env, {QUOTE_ADMIN_PASSWORD:'test-only',NETLIFY_API_TOKEN:'test-api',NETLIFY_SITE_ID:'test-site'});
  return { httpMethod:'GET', headers:{authorization:'Basic '+Buffer.from('admin:test-only').toString('base64')} };
}
test('intake requests verified submissions without importing spam', async () => {
  const event = setup();
  let calls = 0;
  global.fetch = async (url) => {
    calls++;
    assert.equal(new URL(url).searchParams.has('state'), false);
    return {ok:true,json:async()=>[{id:'real-customer',data:{'form-name':'quote',name:'Customer',email:'customer@example.com'}}]};
  };
  const res = await handler(event);
  assert.equal(res.statusCode, 200);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(res.body).submissions[0].id, 'real-customer');
});
test('failed intake fetch reports an error rather than an empty inbox', async () => {
  const event = setup();
  global.fetch = async () => ({ok:false,status:503,text:async()=> 'Unavailable'});
  assert.equal((await handler(event)).statusCode, 502);
});
