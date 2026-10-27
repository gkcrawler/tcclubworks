const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('assets/inquiry-conversion.js','utf8');
const SEND_TO = 'AW-18288494011/4rQbCMWt6-IcELuL0ZBE';

function setup(path, stored) {
  let value = stored, submit;
  const calls = [];
  const context = {
    window: {location:{pathname:path,href:''},crypto:{randomUUID:()=> 'test-inquiry'},gtag:(...args)=>calls.push(args)},
    sessionStorage:{getItem:()=>value,setItem:(_,v)=>value=v,removeItem:()=>value=null},
    document:{querySelectorAll:()=>[{addEventListener:(_,fn)=>submit=fn}],addEventListener:()=>{}},
    Date, JSON
  };
  return {run:()=>vm.runInNewContext(code,context),calls,submit:()=>submit(),value:()=>value};
}
test('does not count a form attempt; counts confirmation once',()=>{
  const form=setup('/contact/',null);form.run();form.submit();
  assert.equal(form.calls.length,0);
  const thanks=setup('/thanks/',form.value());thanks.run();thanks.run();
  assert.equal(thanks.calls.length,1);
  assert.equal(thanks.calls[0][2].send_to,SEND_TO);
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
test('a tel: click fires the contact conversion once, then dials',()=>{
  const calls = [];
  let click;
  const link = {
    attrs: { href: 'tel:+17208544132' },
    getAttribute(name){ return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    setAttribute(name, value){ this.attrs[name] = String(value); },
    closest(sel){ return sel === 'a[href^="tel:"]' ? this : null; }
  };
  const context = {
    window: {
      location:{pathname:'/golf-club-repair-denver', href:''},
      gtag:(...args)=>calls.push(args),
      setTimeout:(fn)=>fn()
    },
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    document:{
      querySelectorAll:()=>[],
      addEventListener:(type, fn)=>{ if (type === 'click') click = fn; }
    },
    Date, JSON
  };
  vm.runInNewContext(code, context);
  const event = { target: link, metaKey:false, ctrlKey:false, shiftKey:false, altKey:false, button:0, prevented:false, preventDefault(){ this.prevented = true; } };
  click(event);
  click(event);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'event');
  assert.equal(calls[0][1], 'conversion');
  assert.equal(calls[0][2].send_to, SEND_TO);
  assert.equal(event.prevented, true);
  assert.equal(context.window.location.href, 'tel:+17208544132');
});
