(function(){
  var money = new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2});
  var password = sessionStorage.getItem("ccw_admin_password") || "";
  var submissions = [], quotes = [], catalog = [], activeId = "", currentQuoteId = "", currentToken = "";

  var els = {
    authForm: $("authForm"), adminPassword: $("adminPassword"), authStatus: $("authStatus"),
    setupAlert: $("setupAlert"), setupMessage: $("setupMessage"), quoteApp: $("quoteApp"),
    submissionList: $("submissionList"), submissionSearch: $("submissionSearch"),
    catalogList: $("catalogList"), catalogSearch: $("catalogSearch"), catalogFile: $("catalogFile"),
    refreshSubmissions: $("refreshSubmissions"), quoteList: $("quoteList"),
    refreshQuotes: $("refreshQuotes"), lineItems: $("lineItems"), addItem: $("addItem"),
    exportPdf: $("exportPdf"), saveQuote: $("saveQuote"), emailQuote: $("emailQuote"),
    newQuote: $("newQuote"), quoteForm: $("quoteForm"), quoteStatus: $("quoteStatus")
  };

  function $(id){ return document.getElementById(id); }
  function val(id){ return ($(id) || {}).value || ""; }
  function set(id, value){ var el = $(id); if(el) el.value = value == null ? "" : value; }
  function parseNumber(value){ return Number.parseFloat(value || "0") || 0; }
  function parseWhole(value){ return Math.max(0, Math.round(parseNumber(value))); }
  function parseMoney(value){ return Math.max(0, Math.round(parseNumber(value) * 100) / 100); }
  function escapeHtml(value){
    return String(value || "").replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function today(offsetDays){
    var d = new Date(); d.setDate(d.getDate() + (offsetDays || 0));
    return d.toISOString().slice(0,10);
  }
  function quoteNumber(){
    var d = new Date();
    return "CCW-" + d.getFullYear() + String(d.getMonth()+1).padStart(2,"0") +
      String(d.getDate()).padStart(2,"0") + "-" + String(d.getHours()).padStart(2,"0") +
      String(d.getMinutes()).padStart(2,"0");
  }
  function authHeaders(extra){
    var h = {Authorization:"Basic " + btoa("admin:" + password)};
    Object.keys(extra || {}).forEach(function(k){ h[k] = extra[k]; });
    return h;
  }
  function showStatus(message){ els.quoteStatus.textContent = message || ""; }
  function approvalUrl(token){
    return token ? location.origin + "/quote-approval/?token=" + encodeURIComponent(token) : "";
  }
  function randomId(prefix){
    return prefix + "_" + Date.now() + "_" + Math.random().toString(16).slice(2, 12);
  }
  function encodedForm(data){
    var params = new URLSearchParams();
    Object.keys(data).forEach(function(key){ params.append(key, data[key] == null ? "" : data[key]); });
    return params.toString();
  }
  function parseCsv(text){
    var rows = [], row = [], value = "", quoted = false;
    for(var i = 0; i < text.length; i++){
      var ch = text[i], next = text[i + 1];
      if(ch === '"' && quoted && next === '"'){ value += '"'; i++; }
      else if(ch === '"'){ quoted = !quoted; }
      else if(ch === "," && !quoted){ row.push(value); value = ""; }
      else if((ch === "\n" || ch === "\r") && !quoted){
        if(ch === "\r" && next === "\n") i++;
        row.push(value); value = "";
        if(row.some(function(cell){ return cell.trim() !== ""; })) rows.push(row);
        row = [];
      }else value += ch;
    }
    row.push(value);
    if(row.some(function(cell){ return cell.trim() !== ""; })) rows.push(row);
    if(!rows.length) return [];
    var headers = rows.shift().map(function(h){ return h.trim(); });
    return rows.map(function(cells){
      var item = {};
      headers.forEach(function(h, i){ item[h] = (cells[i] || "").trim(); });
      return item;
    });
  }
  async function submitNetlifyForm(data){
    var res = await fetch("/", {
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:encodedForm(data)
    });
    if(!res.ok) throw new Error("Netlify Forms could not save this record.");
  }

  async function adminFetch(url, options){
    options = options || {};
    options.headers = authHeaders(options.headers || {});
    var res = await fetch(url, options);
    var data = await res.json().catch(function(){ return {}; });
    if(res.status === 401){
      sessionStorage.removeItem("ccw_admin_password");
      throw new Error("That admin password was not accepted.");
    }
    if(!res.ok) throw new Error(data.message || ("Request failed with status " + res.status + "."));
    return data;
  }

  async function adminDelete(url){
    return adminFetch(url, {method:"DELETE"});
  }

  async function loadSubmissions(){
    els.authStatus.textContent = "Loading customer submissions...";
    els.setupAlert.hidden = true;
    var data = await adminFetch("/.netlify/functions/admin-submissions");
    submissions = data.submissions || [];
    els.quoteApp.hidden = false;
    els.authStatus.textContent = "Unlocked. Loaded " + submissions.length + " recent submissions.";
    renderSubmissions();
  }

  async function loadQuotes(){
    try{
      var data = await adminFetch("/.netlify/functions/admin-quotes");
      quotes = data.quotes || [];
      renderQuotes();
    }catch(err){
      els.quoteList.innerHTML = '<p class="help">' + escapeHtml(err.message) + '</p>';
    }
  }

  async function loadCatalog(){
    try{
      var res = await fetch("/assets/parts-catalog.csv?v=20260820a", {cache:"no-store"});
      if(!res.ok) throw new Error("Could not load parts catalog.");
      catalog = parseCsv(await res.text());
      renderCatalog();
    }catch(err){
      els.catalogList.innerHTML = '<p class="help">' + escapeHtml(err.message) + '</p>';
    }
  }

  function renderSubmissions(){
    var q = els.submissionSearch.value.trim().toLowerCase();
    var visible = submissions.filter(function(s){
      return !q || [s.name,s.email,s.phone,s.service,s.message,s.createdAt].join(" ").toLowerCase().includes(q);
    });
    els.submissionList.innerHTML = visible.length ? visible.map(function(s){
      var date = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "";
      return '<div class="submission' + (s.id === activeId ? " active" : "") + '" data-submission-id="' + escapeHtml(s.id) + '">' +
        '<button type="button" class="submission-main" data-submission-action="select">' +
          '<b>' + escapeHtml(s.name || "No name") + '</b>' +
          '<span>' + escapeHtml([s.service,date].filter(Boolean).join(" | ")) + '</span>' +
          '<span>' + escapeHtml([s.email,s.phone].filter(Boolean).join(" | ")) + '</span>' +
        '</button>' +
        '<button type="button" class="mini danger" data-submission-action="delete">Delete</button>' +
      '</div>';
    }).join("") : '<p class="help">No matching submissions found.</p>';
  }

  function renderQuotes(){
    els.quoteList.innerHTML = quotes.length ? quotes.map(function(q){
      var date = q.updatedAt ? new Date(q.updatedAt).toLocaleDateString() : "";
      return '<div class="submission quote-card" data-quote-id="' + escapeHtml(q.id) + '">' +
        '<button type="button" class="submission-main" data-quote-action="edit">' +
          '<b>' + escapeHtml(q.quoteNumber || q.id) + '</b>' +
          '<span>' + escapeHtml([q.customerName,q.status,date].filter(Boolean).join(" | ")) + '</span>' +
          '<span>' + escapeHtml(money.format(q.total || 0)) + '</span>' +
        '</button>' +
        '<div class="card-actions">' +
          '<button type="button" class="mini" data-quote-action="edit">Edit</button>' +
          '<button type="button" class="mini danger" data-quote-action="delete">Delete</button>' +
        '</div>' +
      '</div>';
    }).join("") : '<p class="help">No saved quotes yet.</p>';
  }

  function renderCatalog(){
    var q = els.catalogSearch.value.trim().toLowerCase();
    var visible = catalog.filter(function(item){
      return !q || [item.sku,item.category,item.brand,item.name,item.description,item.notes].join(" ").toLowerCase().includes(q);
    }).slice(0, 60);
    els.catalogList.innerHTML = visible.length ? visible.map(function(item){
      var originalIndex = catalog.indexOf(item);
      var price = parseMoney(item.quote_price || item.price || item.cost || 0);
      return '<button type="button" class="catalog-item" data-catalog-index="' + originalIndex + '">' +
        '<b>' + escapeHtml(item.name || "Unnamed part") + '</b>' +
        '<span>' + escapeHtml([item.sku,item.category,item.brand].filter(Boolean).join(" | ")) + '</span>' +
        '<span>' + escapeHtml(price ? money.format(price) : "Price TBD") + '</span>' +
      '</button>';
    }).join("") : '<p class="help">No catalog items found.</p>';
  }

  function addCatalogItem(index){
    var item = catalog[Number(index)];
    if(!item) return;
    var price = parseMoney(item.quote_price || item.price || item.cost || 0);
    var label = [item.sku, item.brand, item.name].filter(Boolean).join(" - ");
    addItem(label || "Catalog part", 1, price);
    showStatus("Added catalog item: " + (item.name || item.sku || "part") + ".");
  }

  function selectSubmission(id){
    var s = submissions.find(function(item){ return item.id === id; });
    if(!s) return;
    activeId = id; currentQuoteId = ""; currentToken = "";
    set("customerName", s.name); set("customerEmail", s.email); set("customerPhone", s.phone);
    set("customerService", s.service); set("customerMessage", s.message);
    set("quoteNumber", quoteNumber()); set("quoteDate", today(0)); set("validUntil", today(14));
    set("paymentLink", ""); set("status", "Draft");
    renderSubmissions(); showStatus("Started a new quote from " + (s.name || "submission") + ".");
  }

  async function loadQuote(id){
    var data = await adminFetch("/.netlify/functions/admin-quotes?id=" + encodeURIComponent(id));
    fillQuote(data.quote);
    showStatus("Loaded " + (data.quote.quoteNumber || "saved quote") + ".");
  }

  function fillQuote(q){
    currentQuoteId = q.id || ""; currentToken = q.approvalToken || "";
    set("quoteNumber", q.quoteNumber); set("quoteDate", q.quoteDate); set("validUntil", q.validUntil);
    set("preparedBy", q.preparedBy || "Chronic Clubworks"); set("status", q.status || "Draft");
    set("customerName", q.customerName); set("customerEmail", q.customerEmail); set("customerPhone", q.customerPhone);
    set("customerService", q.customerService); set("customerMessage", q.customerMessage);
    set("discount", q.discount || 0); set("taxRate", q.taxRate || 0); set("deposit", q.deposit || 0);
    set("paymentLink", q.paymentLink || ""); set("notes", q.notes); set("terms", q.terms);
    els.lineItems.innerHTML = "";
    (q.items || []).forEach(function(item){ addItem(item.desc, item.qty, item.unit); });
    if(!(q.items || []).length) addItem("",1,0);
    calculate();
  }

  function addItem(desc, qty, unit){
    var row = document.createElement("div");
    row.className = "line-item";
    row.innerHTML =
      '<label>Description<input class="item-desc" value="' + escapeHtml(desc || "") + '"></label>' +
      '<label>Qty<input class="item-qty whole-number" type="number" min="0" step="1" inputmode="numeric" pattern="[0-9]*" value="' + escapeHtml(parseWhole(qty || "1")) + '"></label>' +
      '<label>Unit<input class="item-unit" type="number" min="0" step="0.01" inputmode="decimal" value="' + escapeHtml(parseMoney(unit || "0").toFixed(2)) + '"></label>' +
      '<label>Total<span class="amount">$0.00</span></label>' +
      '<button type="button" aria-label="Remove line item">&times;</button>';
    els.lineItems.appendChild(row);
    calculate();
  }

  function lineData(){
    return [].slice.call(document.querySelectorAll(".line-item")).map(function(row){
      var desc = row.querySelector(".item-desc").value;
      var qty = parseWhole(row.querySelector(".item-qty").value);
      var unit = parseMoney(row.querySelector(".item-unit").value);
      return {desc:desc, qty:qty, unit:unit, total:qty * unit};
    }).filter(function(item){ return item.desc || item.qty || item.unit; });
  }

  function calculate(){
    var subtotal = 0;
    [].slice.call(document.querySelectorAll(".line-item")).forEach(function(row){
      var qty = parseWhole(row.querySelector(".item-qty").value);
      var unit = parseMoney(row.querySelector(".item-unit").value);
      var total = qty * unit;
      subtotal += total;
      row.querySelector(".amount").textContent = money.format(total);
    });
    var discount = parseNumber(val("discount"));
    var taxable = Math.max(0, subtotal - discount);
    var tax = taxable * (parseNumber(val("taxRate")) / 100);
    var grand = taxable + tax;
    var balance = Math.max(0, grand - parseNumber(val("deposit")));
    $("subtotal").textContent = money.format(subtotal); $("taxTotal").textContent = money.format(tax);
    $("grandTotal").textContent = money.format(grand); $("balanceDue").textContent = money.format(balance);
    return {subtotal:subtotal, tax:tax, grand:grand, balance:balance, discount:discount};
  }

  function collectQuote(){
    var totals = calculate();
    return {
      id: currentQuoteId, approvalToken: currentToken, quoteNumber: val("quoteNumber"),
      quoteDate: val("quoteDate"), validUntil: val("validUntil"), preparedBy: val("preparedBy"),
      status: val("status") || "Draft", customerName: val("customerName"), customerEmail: val("customerEmail"),
      customerPhone: val("customerPhone"), customerService: val("customerService"),
      customerMessage: val("customerMessage"), items: lineData(), discount: parseNumber(val("discount")),
      taxRate: parseNumber(val("taxRate")), deposit: parseNumber(val("deposit")),
      paymentLink: val("paymentLink"), notes: val("notes"), terms: val("terms"),
      subtotal: totals.subtotal, tax: totals.tax, total: totals.grand, balance: totals.balance
    };
  }

  async function saveQuote(silent){
    var quote = collectQuote();
    var now = new Date().toISOString();
    quote.id = quote.id || randomId("quote");
    quote.approvalToken = quote.approvalToken || randomId("approve");
    quote.createdAt = quote.createdAt || now;
    quote.updatedAt = now;
    await submitNetlifyForm({
      "form-name":"saved_quote",
      quoteId:quote.id,
      approvalToken:quote.approvalToken,
      quoteNumber:quote.quoteNumber,
      customerName:quote.customerName,
      customerEmail:quote.customerEmail,
      status:quote.status,
      total:quote.total,
      quotePayload:JSON.stringify(quote)
    });
    fillQuote(quote);
    await loadQuotes();
    if(!silent) showStatus("Saved. Approval link: " + approvalUrl(currentToken));
    return quote;
  }

  async function emailQuote(){
    showStatus("Saving quote and opening email draft...");
    var quote = await saveQuote(true);
    var link = approvalUrl(quote.approvalToken);
    var subject = "Chronic Clubworks quote " + (quote.quoteNumber || "");
    var body = "Hi " + (quote.customerName || "there") + ",\n\n" +
      "Here is your Chronic Clubworks quote.\n\n" +
      "Total: " + money.format(quote.total || 0) + "\n" +
      "Balance after deposit: " + money.format(quote.balance || 0) + "\n\n" +
      "Review and approve here:\n" + link + "\n\n" +
      (quote.paymentLink ? "Deposit/payment link:\n" + quote.paymentLink + "\n\n" : "") +
      "Thanks,\nChronic Clubworks";
    window.location.href = "mailto:" + encodeURIComponent(quote.customerEmail || "") +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    showStatus("Email draft opened. The quote is saved in history.");
    await loadQuotes();
  }

  function quoteHtml(){
    var q = collectQuote(), link = approvalUrl(currentToken || q.approvalToken);
    var rows = q.items.map(function(item){
      return '<tr><td>' + escapeHtml(item.desc) + '</td><td>' + item.qty + '</td><td>' +
        money.format(item.unit) + '</td><td>' + money.format(item.total) + '</td></tr>';
    }).join("");
    var action = (link || q.paymentLink) ? '<section class="box"><h2>Approval and payment</h2>' +
      (link ? '<p>Approve this quote: ' + escapeHtml(link) + '</p>' : "") +
      (q.paymentLink ? '<p>Deposit/payment link: ' + escapeHtml(q.paymentLink) + '</p>' : "") + '</section>' : "";
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(q.quoteNumber) +
      '</title><style>body{font:14px/1.45 Arial,sans-serif;color:#15151f;margin:36px}.top{display:flex;justify-content:space-between;gap:30px;align-items:flex-start;border-bottom:3px solid #15151f;padding-bottom:20px;margin-bottom:28px}img{width:180px;height:auto}.meta{text-align:right}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:11px;color:#555;font-weight:bold}h1{font-size:34px;margin:8px 0 0;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:28px}.box{border:1px solid #d8d8e5;border-radius:10px;padding:16px;margin-top:16px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;margin:0 0 10px;color:#555}p{margin:0 0 6px}table{width:100%;border-collapse:collapse;margin:20px 0}th{text-align:left;background:#111124;color:white;padding:10px}td{border-bottom:1px solid #ddd;padding:10px;vertical-align:top}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.totals{margin-left:auto;width:320px}.totals p{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:7px 0}.totals .grand{font-size:18px;font-weight:bold;border-bottom:2px solid #15151f}.notes{margin-top:26px;display:grid;gap:14px}.footer{margin-top:38px;color:#666;font-size:12px}@media print{body{margin:28px}}</style></head><body>' +
      '<section class="top"><div><img src="' + location.origin + '/assets/logo-v2.svg" alt="Chronic Clubworks"><p>Denver, CO<br>(720) 854-4132<br>info@tcclubworks.io<br>tcclubworks.io</p></div><div class="meta"><p class="eyebrow">Estimate / Quote</p><h1>' + escapeHtml(q.quoteNumber) + '</h1><p>Status: ' + escapeHtml(q.status) + '<br>Date: ' + escapeHtml(q.quoteDate) + '<br>Valid until: ' + escapeHtml(q.validUntil) + '</p></div></section>' +
      '<section class="grid"><div class="box"><h2>Prepared for</h2><p><b>' + escapeHtml(q.customerName) + '</b></p><p>' + escapeHtml(q.customerEmail) + '</p><p>' + escapeHtml(q.customerPhone) + '</p></div><div class="box"><h2>Request</h2><p><b>' + escapeHtml(q.customerService) + '</b></p><p>' + escapeHtml(q.customerMessage).replace(/\\n/g,"<br>") + '</p></div></section>' +
      '<table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<section class="totals"><p><span>Subtotal</span><b>' + money.format(q.subtotal) + '</b></p><p><span>Discount</span><b>' + money.format(q.discount) + '</b></p><p><span>Tax</span><b>' + money.format(q.tax) + '</b></p><p class="grand"><span>Total</span><b>' + money.format(q.total) + '</b></p><p><span>Balance after deposit</span><b>' + money.format(q.balance) + '</b></p></section>' +
      '<section class="notes"><div class="box"><h2>Notes</h2><p>' + escapeHtml(q.notes).replace(/\\n/g,"<br>") + '</p></div><div class="box"><h2>Terms</h2><p>' + escapeHtml(q.terms).replace(/\\n/g,"<br>") + '</p></div></section>' +
      action + '<p class="footer">Prepared by Chronic Clubworks. Please reply to approve this quote before work begins.</p></body></html>';
  }

  function exportPdf(){
    var html = quoteHtml();
    var blob = new Blob([html], {type:"text/html"});
    var url = URL.createObjectURL(blob);
    var frame = $("quotePrintFrame");
    if(!frame){
      frame = document.createElement("iframe");
      frame.id = "quotePrintFrame"; frame.title = "Quote PDF preview";
      frame.style.position = "fixed"; frame.style.right = "0"; frame.style.bottom = "0";
      frame.style.width = "0"; frame.style.height = "0"; frame.style.border = "0";
      document.body.appendChild(frame);
    }
    frame.onload = function(){
      window.setTimeout(function(){
        frame.contentWindow.focus();
        frame.contentWindow.print();
        window.setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
      }, 150);
    };
    frame.src = url;
  }

  async function deleteSubmission(id){
    var s = submissions.find(function(item){ return item.id === id; });
    if(!s || !confirm("Delete this customer intake submission for " + (s.name || "this customer") + "?")) return;
    await adminDelete("/.netlify/functions/admin-submissions?id=" + encodeURIComponent(id));
    submissions = submissions.filter(function(item){ return item.id !== id; });
    if(activeId === id) resetQuote();
    renderSubmissions();
    showStatus("Customer intake deleted.");
  }

  async function deleteQuote(id){
    var q = quotes.find(function(item){ return item.id === id; });
    if(!q || !confirm("Delete saved quote " + (q.quoteNumber || id) + "?")) return;
    await adminDelete("/.netlify/functions/admin-quotes?id=" + encodeURIComponent(id));
    quotes = quotes.filter(function(item){ return item.id !== id; });
    if(currentQuoteId === id) resetQuote();
    renderQuotes();
    showStatus("Saved quote deleted.");
  }

  function resetQuote(){
    currentQuoteId = ""; currentToken = ""; activeId = "";
    set("quoteNumber", quoteNumber()); set("quoteDate", today(0)); set("validUntil", today(14));
    set("preparedBy", "Chronic Clubworks"); set("status", "Draft");
    set("customerName", ""); set("customerEmail", ""); set("customerPhone", "");
    set("customerService", ""); set("customerMessage", ""); set("paymentLink", "");
    set("discount", 0); set("taxRate", 0); set("deposit", 0);
    set("notes", "Quote is based on the details available today. Final parts pricing may change if the requested components are unavailable or if the scope changes after inspection.");
    set("terms", "Quote valid until the date shown above. Work begins after customer approval and any required parts or deposit are received.");
    els.lineItems.innerHTML = ""; addItem("",1,0); renderSubmissions(); showStatus("New draft ready.");
  }

  els.authForm.addEventListener("submit",function(e){
    e.preventDefault(); password = els.adminPassword.value;
    sessionStorage.setItem("ccw_admin_password", password);
    Promise.all([loadSubmissions(), loadQuotes()]).catch(function(err){ els.authStatus.textContent = err.message; });
  });
  els.refreshSubmissions.addEventListener("click",function(){ loadSubmissions().catch(function(err){ els.authStatus.textContent = err.message; }); });
  els.refreshQuotes.addEventListener("click",function(){ loadQuotes(); });
  els.submissionSearch.addEventListener("input",renderSubmissions);
  els.catalogSearch.addEventListener("input",renderCatalog);
  els.catalogFile.addEventListener("change",function(e){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    file.text().then(function(text){
      catalog = parseCsv(text);
      renderCatalog();
      showStatus("Imported " + catalog.length + " catalog rows for this session.");
    }).catch(function(){ showStatus("Could not import that CSV."); });
  });
  els.submissionList.addEventListener("click",function(e){
    var card = e.target.closest("[data-submission-id]");
    if(!card) return;
    var id = card.getAttribute("data-submission-id");
    if(e.target.closest("[data-submission-action='delete']")){
      deleteSubmission(id).catch(function(err){ showStatus(err.message); });
    }else{
      selectSubmission(id);
    }
  });
  els.quoteList.addEventListener("click",function(e){
    var card = e.target.closest("[data-quote-id]");
    if(!card) return;
    var id = card.getAttribute("data-quote-id");
    if(e.target.closest("[data-quote-action='delete']")){
      deleteQuote(id).catch(function(err){ showStatus(err.message); });
    }else{
      loadQuote(id).catch(function(err){ showStatus(err.message); });
    }
  });
  els.catalogList.addEventListener("click",function(e){
    var btn = e.target.closest("[data-catalog-index]");
    if(btn) addCatalogItem(btn.getAttribute("data-catalog-index"));
  });
  els.addItem.addEventListener("click",function(){ addItem("",1,0); });
  els.saveQuote.addEventListener("click",function(){ saveQuote(false).catch(function(err){ showStatus(err.message); }); });
  els.emailQuote.addEventListener("click",function(){ emailQuote().catch(function(err){ showStatus(err.message); }); });
  els.newQuote.addEventListener("click",resetQuote);
  els.exportPdf.addEventListener("click",exportPdf);
  els.quoteForm.addEventListener("input",calculate);
  document.addEventListener("input",function(e){
    if(e.target.classList && e.target.classList.contains("whole-number") && e.target.value !== ""){
      e.target.value = parseWhole(e.target.value); calculate();
    }
  });
  document.addEventListener("click",function(e){
    var preset = e.target.closest("[data-preset]");
    if(preset){ var p = preset.getAttribute("data-preset").split("|"); addItem(p[0],p[1],p[2]); }
    if(e.target.closest(".line-item button")){ e.target.closest(".line-item").remove(); calculate(); }
  });

  resetQuote();
  loadCatalog();
  if(password){
    els.adminPassword.value = password;
    Promise.all([loadSubmissions(), loadQuotes()]).catch(function(err){ els.authStatus.textContent = err.message; });
  }
})();
