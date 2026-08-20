(function(){
  var money = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
  var params = new URLSearchParams(location.search);
  var token = params.get("token") || "";
  var app = document.getElementById("approvalApp");
  function esc(v){return String(v||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
  function render(q){
    var rows = (q.items||[]).map(function(item){
      return "<tr><td>"+esc(item.desc)+"</td><td>"+item.qty+"</td><td>"+money.format(item.unit)+"</td><td>"+money.format(item.total)+"</td></tr>";
    }).join("");
    app.innerHTML = '<section class="top"><img src="/assets/logo-v2.svg" alt="Chronic Clubworks"><div><p class="eyebrow">Estimate / Quote</p><h1>'+esc(q.quoteNumber)+'</h1><p>Status: '+esc(q.status)+'<br>Valid until: '+esc(q.validUntil)+'</p></div></section>' +
      '<section class="panel"><h2>Prepared for</h2><p><b>'+esc(q.customerName)+'</b><br>'+esc(q.customerEmail)+'<br>'+esc(q.customerPhone)+'</p><p>'+esc(q.customerService)+'</p></section>' +
      '<section class="panel"><h2>Line items</h2><table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>'+rows+'</tbody></table><div class="totals"><p><span>Subtotal</span><b>'+money.format(q.subtotal)+'</b></p><p><span>Tax</span><b>'+money.format(q.tax)+'</b></p><p class="grand"><span>Total</span><b>'+money.format(q.total)+'</b></p><p><span>Balance</span><b>'+money.format(q.balance)+'</b></p></div></section>' +
      '<section class="panel"><h2>Notes and terms</h2><p>'+esc(q.notes).replace(/\\n/g,"<br>")+'</p><p>'+esc(q.terms).replace(/\\n/g,"<br>")+'</p></section>' +
      '<section class="panel"><h2>Approve quote</h2><label>Your name<input id="approverName" value="'+esc(q.customerName)+'"></label><button id="approveBtn" type="button">Approve quote</button>' +
      (q.paymentLink ? '<a class="pay" href="'+esc(q.paymentLink)+'">Pay deposit</a>' : '') + '<p id="approvalStatus"></p></section>';
  }
  fetch("/.netlify/functions/quote-public?token="+encodeURIComponent(token))
    .then(function(res){return res.json().then(function(data){if(!res.ok) throw new Error(data.message||"Quote not found."); render(data.quote);});})
    .catch(function(err){app.innerHTML='<section class="panel"><h1>Quote unavailable</h1><p>'+esc(err.message)+'</p></section>';});
  document.addEventListener("click",function(e){
    if(e.target.id !== "approveBtn") return;
    var name = document.getElementById("approverName").value;
    fetch("/.netlify/functions/quote-public",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:token,name:name})})
      .then(function(res){return res.json().then(function(data){if(!res.ok) throw new Error(data.message||"Could not approve quote."); document.getElementById("approvalStatus").textContent = "Approved. Chronic Clubworks has been notified."; e.target.disabled = true;});})
      .catch(function(err){document.getElementById("approvalStatus").textContent = err.message;});
  });
})();
