(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const api = '/.netlify/functions/dashboard';
  const sessionApi = '/.netlify/functions/shop';
  const fmt = new Intl.NumberFormat('en-US');
  const money = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
  const shortDay = day => new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
  const icons = {
    grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    inbox:'M5 4h14l3 10v6H2v-6z M3 14h5l2 3h4l2-3h5',
    photo:'M3 4h18v16H3z M4 17l6-6 4 4 3-3 4 4 M15 8h.1',
    board:'M3 4h18v16H3z M9 4v16 M15 4v16',quote:'M5 2h10l4 4v16H5z M8 11h8 M8 15h6',
    calendar:'M3 6h18v15H3z M7 3v6 M17 3v6 M3 11h18',refresh:'M20 10a8 8 0 1 0-2 8 M20 4v6h-6',
    people:'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 20c0-7 14-7 14 0 M17 5c4 0 5 6 0 7 M18 15c3 0 4 2 4 5',
    pointer:'M5 2l14 11-7 1-4 7z',bag:'M4 8h16l1 13H3z M8 9V7a4 4 0 0 1 8 0v2',
    megaphone:'M3 9h5l12-5v15L8 14H3z M7 14l2 7h4l-3-6'
  };
  const svgNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) {
    const node=document.createElementNS(svgNS,tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key,value);
    return node;
  }
  for (const holder of document.querySelectorAll('[data-icon]')) {
    const icon=svg('svg',{viewBox:'0 0 24 24',class:'svg-icon','aria-hidden':'true'});
    icon.append(svg('path',{d:icons[holder.dataset.icon]})); holder.append(icon);
  }
  const put = (id, value) => { $(id).textContent = value; };
  let generation=0, signed=false, refreshing=false, retail=null, production=false, saving=false;
  const labels={inquiry:'New inquiry',quoted:'Quoted',approved:'Approved',bench:'On the bench',ready:'Ready for pickup'};
  async function request(url,body) {
    const response=await fetch(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',
      headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
    const value=await response.json();
    if (!response.ok) throw Object.assign(new Error(value.message || 'Connection unavailable.'),{status:response.status});
    return value;
  }
  function lock() {
    generation++; signed=false; retail=null; $('app').hidden=true; $('login').hidden=false;
    $('lead-list').replaceChildren(); $('large-photo').removeAttribute('src');
    if ($('photo-dialog').open) $('photo-dialog').close();
    $('password').value=''; put('notice',''); put('login-error','');
  }
  function chart(report) {
    const box=$('trend');box.replaceChildren();
    if (!report) {const p=document.createElement('p');p.className='chart-empty';p.textContent='Daily sessions will appear when Analytics is connected.';box.append(p);return;}
    const first=new Date(report.start+'T12:00:00Z');
    const rows=new Map(report.daily), values=[];
    for (let i=0;i<30;i++){ const key=first.toISOString().slice(0,10).replaceAll('-','');values.push(rows.get(key)||0);first.setUTCDate(first.getUTCDate()+1); }
    const max=Math.max(1,...values), points=values.map((v,i)=>[3+i*494/29,85-v*79/max]);
    const graph=svg('svg',{viewBox:'0 0 500 90',preserveAspectRatio:'none',class:'chart-svg',role:'img',
      'aria-label':'Daily sessions from '+shortDay(report.start)+' to '+shortDay(report.end)+'. Peak '+Math.max(...values)+'.'});
    for (const y of [8,47,85]) graph.append(svg('line',{x1:0,x2:500,y1:y,y2:y,stroke:'#39414b','stroke-dasharray':'3 5'}));
    const path='M'+points.map(p=>p.join(',')).join(' L');
    graph.append(svg('path',{d:path+' L497,88 L3,88 Z',fill:'#71d7ad','fill-opacity':'.12'}));
    graph.append(svg('path',{d:path,fill:'none',stroke:'#82dfb9','stroke-width':2.5,'stroke-linejoin':'round','vector-effect':'non-scaling-stroke'}));
    const axis=document.createElement('div');axis.className='axis';
    for(const day of [report.start,report.end]){const span=document.createElement('span');span.textContent=shortDay(day);axis.append(span);}
    box.append(graph,axis);
  }
  function renderReport(report) {
    const numbers=report?.traffic, contacts=report?.clicks, ads=report?.ads;
    put('visitors',numbers?fmt.format(numbers[0]):'—');put('sessions',numbers?fmt.format(numbers[1]):'—');
    const clicks=contacts?[contacts.click_to_call,contacts.click_to_text,contacts.click_to_email]:null;
    put('contact-count',clicks?fmt.format(clicks.reduce((a,b)=>a+b,0)):'—');
    put('contact-detail',clicks?clicks.map(v=>fmt.format(v)).join(' / '):'—');
    put('spend',ads?money(ads[1]):'—');put('ad-clicks',ads?fmt.format(ads[0]):'—');put('impressions',ads?fmt.format(ads[2]):'—');
    put('cpc',ads?.[0]?money(ads[1]/ads[0]):'—');
    put('spend-note',ads?'Linked advertising · USD':'No linked spend reported');
    chart(report);
    const stale=report && Date.now()-Date.parse(report.asOf)>4*3600000;
    put('report-status',report?(stale?'Last available report':'Google Analytics')+' · '+shortDay(report.start)+'–'+shortDay(report.end)+' · Updated '+new Date(report.asOf).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Denver'})+' MT':'Awaiting the first Google Analytics report.');
  }
  function renderRetail(value) {
    retail=value;put('shop-state',value.active?'Public':'Private');$('toggle').setAttribute('aria-checked',String(value.active));
    const pending=value.active !== value.desired;
    $('toggle').disabled=!production || pending || saving;
    const retry=pending && (value.failed || Date.now()-Date.parse(value.requested)>120000);
    $('retry').hidden=!production || !retry; $('retry').disabled=saving;
    put('publish-status',!production?'Manage visibility from the production dashboard.':pending?(retry?'The requested change is still pending. You can retry publishing.':'Publishing '+(value.desired?'public':'private')+' pages…'):(value.active?'Customers can browse the retail pages.':'Retail pages are hidden from customers.'));
  }
  function renderLeads(value) {
    put('lead-count',fmt.format(value.total));put('open-count',fmt.format(value.open.length));put('lead-note',value.open.length+' open for follow-up');
    const list=$('lead-list');list.replaceChildren();
    for (const lead of value.open) {
      const a=document.createElement('a'); a.className='lead';a.href='/admin/shop/#job='+encodeURIComponent(lead.id);
      const avatar=document.createElement('span');avatar.className='avatar';avatar.setAttribute('aria-hidden','true');
      avatar.textContent=lead.name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
      const text=document.createElement('span'), name=document.createElement('strong'), service=document.createElement('small');
      name.textContent=lead.name; service.textContent=lead.service;text.append(name,service);
      const date=document.createElement('small');date.textContent=(labels[lead.stage]||'Open')+' · '+shortDay(lead.day);
      a.append(avatar,text,date);list.append(a);
    }
    if (!value.open.length){const p=document.createElement('p');p.textContent='No open website inquiries from the last 30 days.';list.append(p);}
  }
  async function loadSection(section,render,onError,version) {
    try {const data=await request(api+'?section='+section);if(generation===version && signed)render(data);}
    catch(error){if(generation!==version)return;if(error.status===401)lock();else onError(error.message);}
  }
  async function refresh() {
    if (!signed || refreshing || saving)return;
    refreshing=true;$('refresh').disabled=true;const version=generation;
    await Promise.all([
      loadSection('report',data=>renderReport(data.report),msg=>{renderReport(null);put('report-status',msg);},version),
      loadSection('leads',renderLeads,msg=>{put('lead-list',msg);put('lead-count','—');put('open-count','—');put('lead-note','Lead connection unavailable');},version),
      loadSection('retail',renderRetail,msg=>{retail=null;$('toggle').disabled=true;$('retry').hidden=true;put('shop-state','Unavailable');put('publish-status',msg);},version)
    ]);
    refreshing=false;$('refresh').disabled=false;
  }
  async function start() {
    try {const session=await request(api+'?section=session');production=session.production;signed=true;generation++;
      $('login').hidden=true;$('app').hidden=false;
      put('today',new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'America/Denver'}));
      await refresh();
    } catch(error){lock();if(error.status!==401)put('login-error','Unable to reach the dashboard. Please try again.');}
  }
  async function publish(visible) {
    if(!retail || saving || !production)return;
    if(!confirm(visible?'Publish all six retail pages on tcclubworks.io?':'Hide all six retail pages on tcclubworks.io?'))return;
    saving=true;$('toggle').disabled=true;$('retry').disabled=true;put('notice','Submitting the visibility change…');
    try {const value=await request(api,{action:'retail',visible,revision:retail.revision});renderRetail(value);put('notice','Visibility request received. The live status updates after publication.');}
    catch(error){if(error.status===401)lock();else put('notice',error.message);}
    finally{saving=false;await refresh();}
  }
  $('toggle').onclick=()=>retail && publish(!retail.active);$('retry').onclick=()=>retail && publish(retail.desired);
  $('login-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;
    try{await request(sessionApi,{action:'login',password:$('password').value,remember:$('remember').checked});$('password').value='';await start();}
    catch(error){put('login-error',error.message);}finally{button.disabled=false;}};
  $('logout').onclick=async()=>{try{await request(sessionApi,{action:'logout'});lock();}catch{put('notice','Sign-out could not be confirmed. Please retry.');}};
  $('refresh').onclick=refresh;
  document.querySelector('.projects').onclick=event=>{const a=event.target.closest('a');if(!a || event.ctrlKey || event.metaKey)return;
    event.preventDefault();const img=a.querySelector('img');$('large-photo').src=a.href;$('large-photo').alt=img.alt;put('caption',a.querySelector('strong').textContent);$('photo-dialog').showModal();};
  $('close-photo').onclick=()=>$('photo-dialog').close();
  $('photo-dialog').onclick=event=>{if(event.target===$('photo-dialog'))$('photo-dialog').close();};
  window.addEventListener('pageshow',event=>{if(event.persisted){lock();start();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  start();
})();
