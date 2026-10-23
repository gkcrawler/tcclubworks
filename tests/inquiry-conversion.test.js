const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('assets/inquiry-conversion.js','utf8');
function setup(path, stored) {
  let value = stored, submit;
  const calls = [];
  const context = {
    window: {location:{pathname:path},crypto:{randomUUID:()=> 'test-inquiry'},gtag:(...args)=>calls.push(args)},
    sessionStorage:{getItem:()=>value,setItem:(_,v)=>value=v,removeItem:()=>value=null},
    document:{querySelectorAll:()=>[{addEventListener:(_,fn)=>submit=fn}]},
    Date, JSON
  };
  return {run:()=>vm.runInNewContext(code,context),calls,submit:()=>submit(),value:()=>value};
}
test('does not count a form attempt; counts confirmation once',()=>{
  const form=setup('/contact/',null);form.run();form.submit();
  assert.equal(form.calls.length,0);
  const thanks=setup('/thanks/',form.value());thanks.run();thanks.run();
  assert.equal(thanks.calls.length,1);
  assert.equal(thanks.calls[0][2].send_to,'AW-18288494011/4rQbCMWt6-IcELuL0ZBE');
  assert.equal(thanks.calls[0][2].transaction_id,'test-inquiry');
});
test('direct confirmation visits do not count as inquiries',()=>{
  const page=setup('/thanks/',null);page.run();assert.equal(page.calls.length,0);
});
test('expired or invalid pending submissions do not count',()=>{
  for (const value of ['bad json',JSON.stringify({id:'old',time:Date.now()-31*60*1000})]) {
    const page=setup('/thanks/',value);page.run();assert.equal(page.calls.length,0);
  }
});
