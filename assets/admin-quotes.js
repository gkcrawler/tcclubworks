(function(){
  var money = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
  var password = sessionStorage.getItem("ccw_admin_password") || "";
  var submissions = [];
  var activeId = "";

  var els = {
    authForm: document.getElementById("authForm"),
    adminPassword: document.getElementById("adminPassword"),
    authStatus: document.getElementById("authStatus"),
    setupAlert: document.getElementById("setupAlert"),
    setupMessage: document.getElementById("setupMessage"),
    quoteApp: document.getElementById("quoteApp"),
    submissionList: document.getElementById("submissionList"),
    submissionSearch: document.getElementById("submissionSearch"),
    refreshSubmissions: document.getElementById("refreshSubmissions"),
    lineItems: document.getElementById("lineItems"),
    addItem: document.getElementById("addItem"),
    exportPdf: document.getElementById("exportPdf"),
    quoteForm: document.getElementById("quoteForm")
  };

  function $(id){ return document.getElementById(id); }
  function val(id){ return ($(id) || {}).value || ""; }
  function set(id, value){ var el = $(id); if(el) el.value = value || ""; }
  function parseNumber(value){ return Number.parseFloat(value || "0") || 0; }
  function parseWhole(value){ return Math.max(0, Math.round(parseNumber(value))); }
  function escapeHtml(value){
    return String(value || "").replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function today(offsetDays){
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.toISOString().slice(0,10);
  }
  function quoteNumber(){
    var d = new Date();
    return "CCW-" + d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") +
      String(d.getDate()).padStart(2,"0") + "-" + String(d.getHours()).padStart(2,"0") +
      String(d.getMinutes()).padStart(2,"0");
  }

  function authHeaders(){
    return {Authorization:"Basic " + btoa("admin:" + password)};
  }

  async function loadSubmissions(){
    els.authStatus.textContent = "Loading customer submissions...";
    els.setupAlert.hidden = true;
    var res = await fetch("/.netlify/functions/admin-submissions",{headers:authHeaders()});
    var data = await res.json().catch(function(){ return {}; });
    if(res.status === 401){
      sessionStorage.removeItem("ccw_admin_password");
      throw new Error("That admin password was not accepted.");
    }
    if(!res.ok && data.setupRequired){
      els.setupMessage.textContent = data.message || "Add the required Netlify environment variables.";
      els.setupAlert.hidden = false;
      els.quoteApp.hidden = false;
      els.authStatus.textContent = "Unlocked, but Netlify setup is still needed.";
      submissions = [];
      renderSubmissions();
      return;
    }
    if(!res.ok) throw new Error(data.message || "Could not load submissions.");
    submissions = data.submissions || [];
    els.quoteApp.hidden = false;
    els.authStatus.textContent = "Unlocked. Loaded " + submissions.length + " recent submissions.";
    renderSubmissions();
  }

  function renderSubmissions(){
    var q = els.submissionSearch.value.trim().toLowerCase();
    var visible = submissions.filter(function(s){
      return !q || [s.name,s.email,s.phone,s.service,s.message,s.createdAt].join(" ").toLowerCase().includes(q);
    });
    els.submissionList.innerHTML = visible.length ? visible.map(function(s){
      var date = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "";
      return '<button type="button" class="submission' + (s.id === activeId ? " active" : "") + '" data-id="' + escapeHtml(s.id) + '">' +
        '<b>' + escapeHtml(s.name || "No name") + '</b>' +
        '<span>' + escapeHtml([s.service,date].filter(Boolean).join(" | ")) + '</span>' +
        '<span>' + escapeHtml([s.email,s.phone].filter(Boolean).join(" | ")) + '</span>' +
      '</button>';
    }).join("") : '<p class="help">No matching submissions found.</p>';
  }

  function selectSubmission(id){
    var s = submissions.find(function(item){ return item.id === id; });
    if(!s) return;
    activeId = id;
    set("customerName", s.name);
    set("customerEmail", s.email);
    set("customerPhone", s.phone);
    set("customerService", s.service);
    set("customerMessage", s.message);
    renderSubmissions();
  }

  function addItem(desc, qty, unit){
    var row = document.createElement("div");
    row.className = "line-item";
    row.innerHTML =
      '<label>Description<input class="item-desc" value="' + escapeHtml(desc || "") + '"></label>' +
      '<label>Qty<input class="item-qty whole-number" type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" value="' + escapeHtml(parseWhole(qty || "1")) + '"></label>' +
      '<label>Unit<input class="item-unit whole-number" type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" value="' + escapeHtml(parseWhole(unit || "0")) + '"></label>' +
      '<label>Total<span class="amount">$0</span></label>' +
      '<button type="button" aria-label="Remove line item">&times;</button>';
    els.lineItems.appendChild(row);
    calculate();
  }

  function lineData(){
    return [].slice.call(document.querySelectorAll(".line-item")).map(function(row){
      var desc = row.querySelector(".item-desc").value;
      var qty = parseWhole(row.querySelector(".item-qty").value);
      var unit = parseWhole(row.querySelector(".item-unit").value);
      return {desc:desc, qty:qty, unit:unit, total:qty * unit};
    });
  }

  function calculate(){
    var subtotal = 0;
    [].slice.call(document.querySelectorAll(".line-item")).forEach(function(row){
      var qty = parseWhole(row.querySelector(".item-qty").value);
      var unit = parseWhole(row.querySelector(".item-unit").value);
      var total = qty * unit;
      subtotal += total;
      row.querySelector(".amount").textContent = money.format(total);
    });
    var discount = parseNumber(val("discount"));
    var taxable = Math.max(0, subtotal - discount);
    var tax = taxable * (parseNumber(val("taxRate")) / 100);
    var grand = taxable + tax;
    var balance = Math.max(0, grand - parseNumber(val("deposit")));
    $("subtotal").textContent = money.format(subtotal);
    $("taxTotal").textContent = money.format(tax);
    $("grandTotal").textContent = money.format(grand);
    $("balanceDue").textContent = money.format(balance);
    return {subtotal:subtotal, tax:tax, grand:grand, balance:balance, discount:discount};
  }

  function quoteHtml(){
    var totals = calculate();
    var rows = lineData().map(function(item){
      return '<tr><td>' + escapeHtml(item.desc) + '</td><td>' + item.qty + '</td><td>' +
        money.format(item.unit) + '</td><td>' + money.format(item.total) + '</td></tr>';
    }).join("");
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(val("quoteNumber")) +
      '</title><style>' +
      'body{font:14px/1.45 Arial,sans-serif;color:#15151f;margin:36px} .top{display:flex;justify-content:space-between;gap:30px;align-items:flex-start;border-bottom:3px solid #15151f;padding-bottom:20px;margin-bottom:28px}' +
      'img{width:180px;height:auto}.meta{text-align:right}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:#555;font-weight:bold}h1{font-size:34px;margin:8px 0 0;text-transform:uppercase}' +
      '.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:28px}.box{border:1px solid #d8d8e5;border-radius:10px;padding:16px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;margin:0 0 10px;color:#555}' +
      'p{margin:0 0 6px}table{width:100%;border-collapse:collapse;margin:20px 0}th{text-align:left;background:#111124;color:white;padding:10px}td{border-bottom:1px solid #ddd;padding:10px;vertical-align:top}td:nth-child(n+2),th:nth-child(n+2){text-align:right}' +
      '.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:7px 0}.totals .grand{font-size:18px;font-weight:bold;border-bottom:2px solid #15151f}' +
      '.notes{margin-top:26px;display:grid;gap:14px}.footer{margin-top:38px;color:#666;font-size:12px}@media print{button{display:none}body{margin:28px}}' +
      '</style></head><body>' +
      '<section class="top"><div><img src="' + location.origin + '/assets/logo-v2.svg" alt="Chronic Clubworks"><p>Denver, CO<br>(720) 854-4132<br>info@tcclubworks.io<br>tcclubworks.io</p></div>' +
      '<div class="meta"><p class="eyebrow">Estimate / Quote</p><h1>' + escapeHtml(val("quoteNumber")) + '</h1><p>Date: ' + escapeHtml(val("quoteDate")) + '<br>Valid until: ' + escapeHtml(val("validUntil")) + '</p></div></section>' +
      '<section class="grid"><div class="box"><h2>Prepared for</h2><p><b>' + escapeHtml(val("customerName")) + '</b></p><p>' + escapeHtml(val("customerEmail")) + '</p><p>' + escapeHtml(val("customerPhone")) + '</p></div>' +
      '<div class="box"><h2>Request</h2><p><b>' + escapeHtml(val("customerService")) + '</b></p><p>' + escapeHtml(val("customerMessage")).replace(/\\n/g,"<br>") + '</p></div></section>' +
      '<table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<section class="totals"><p><span>Subtotal</span><b>' + money.format(totals.subtotal) + '</b></p><p><span>Discount</span><b>' + money.format(totals.discount) + '</b></p><p><span>Tax</span><b>' + money.format(totals.tax) + '</b></p><p class="grand"><span>Total</span><b>' + money.format(totals.grand) + '</b></p><p><span>Balance after deposit</span><b>' + money.format(totals.balance) + '</b></p></section>' +
      '<section class="notes"><div class="box"><h2>Notes</h2><p>' + escapeHtml(val("notes")).replace(/\\n/g,"<br>") + '</p></div><div class="box"><h2>Terms</h2><p>' + escapeHtml(val("terms")).replace(/\\n/g,"<br>") + '</p></div></section>' +
      '<p class="footer">Prepared by Chronic Clubworks. Please reply to approve this quote before work begins.</p>' +
      '<script>window.addEventListener("load",function(){window.print();});<\\/script></body></html>';
  }

  function exportPdf(){
    var frame = document.getElementById("quotePrintFrame");
    if(!frame){
      frame = document.createElement("iframe");
      frame.id = "quotePrintFrame";
      frame.title = "Quote PDF preview";
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      document.body.appendChild(frame);
    }
    frame.onload = null;
    var doc = frame.contentWindow.document;
    doc.open();
    doc.write(quoteHtml().replace('<script>window.addEventListener("load",function(){window.print();});<\\/script>', ""));
    doc.close();
    window.setTimeout(function(){
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }, 150);
  }

  els.authForm.addEventListener("submit",function(e){
    e.preventDefault();
    password = els.adminPassword.value;
    sessionStorage.setItem("ccw_admin_password", password);
    loadSubmissions().catch(function(err){ els.authStatus.textContent = err.message; });
  });
  document.addEventListener("input",function(e){
    if(e.target.classList && e.target.classList.contains("whole-number")){
      if(e.target.value === "") return;
      e.target.value = parseWhole(e.target.value);
      calculate();
    }
  });
  els.refreshSubmissions.addEventListener("click",function(){ loadSubmissions().catch(function(err){ els.authStatus.textContent = err.message; }); });
  els.submissionSearch.addEventListener("input",renderSubmissions);
  els.submissionList.addEventListener("click",function(e){
    var btn = e.target.closest(".submission");
    if(btn) selectSubmission(btn.getAttribute("data-id"));
  });
  els.addItem.addEventListener("click",function(){ addItem("",1,0); });
  document.addEventListener("click",function(e){
    var preset = e.target.closest("[data-preset]");
    if(preset){
      var p = preset.getAttribute("data-preset").split("|");
      addItem(p[0],p[1],p[2]);
    }
    if(e.target.closest(".line-item button")){
      e.target.closest(".line-item").remove();
      calculate();
    }
  });
  els.quoteForm.addEventListener("input",calculate);
  els.exportPdf.addEventListener("click",exportPdf);

  set("quoteNumber", quoteNumber());
  set("quoteDate", today(0));
  set("validUntil", today(14));
  addItem("",1,0);
  if(password){
    els.adminPassword.value = password;
    loadSubmissions().catch(function(err){ els.authStatus.textContent = err.message; });
  }
})();
