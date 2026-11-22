/* Google Ads "Contact" conversion.
   A quote counts only after Netlify accepts it and shows /thanks.
   A tel: tap counts when the visitor actually chooses to call.
   The pending id is removed only after the hit is queued, so a slow
   tag cannot drop the conversion on the floor. */
(function () {
  'use strict';
  var SEND_TO = 'AW-18288494011/4rQbCMWt6-IcELuL0ZBE';
  var KEY = 'ccw-pending-inquiry';

  function isThanks(pathname) {
    return pathname === '/thanks' || pathname === '/thanks/' ||
      pathname === '/thanks.html' || pathname === '/thanks/index.html';
  }

  function sendConversion(transactionId, onDone) {
    var params = { send_to: SEND_TO };
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      if (typeof onDone === 'function') onDone();
    }
    if (transactionId) params.transaction_id = transactionId;
    if (onDone) params.event_callback = finish;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () { window.dataLayer.push(arguments); };
    }
    window.gtag('event', 'conversion', params);
    if (onDone && typeof window.setTimeout === 'function') window.setTimeout(finish, 800);
    return true;
  }

  function dropPending() {
    try { sessionStorage.removeItem(KEY); } catch (_) { /* already gone */ }
  }

  function sendAnalytics(eventName, details) {
    if (window.ccwAnalyticsId && typeof window.gtag === 'function') {
      window.gtag('event', eventName, Object.assign({ send_to: window.ccwAnalyticsId }, details || {}));
    }
  }

  function consumeInquiry() {
    var raw, pending, age;
    try {
      raw = sessionStorage.getItem(KEY);
    } catch (_) { return; }
    try {
      pending = JSON.parse(raw || 'null');
    } catch (_) {
      dropPending();
      return;
    }
    if (!pending || !pending.id) {
      dropPending();
      return;
    }
    age = Date.now() - pending.time;
    if (!(age >= 0 && age < 30 * 60 * 1000)) {
      dropPending();
      return;
    }
    try {
      sendConversion(pending.id);
    } catch (_) {
      return;
    }
    dropPending();
    // Smart campaign quote requests are measured by this confirmation pageview.
    sendAnalytics('page_view');
    sendAnalytics('generate_lead', { method: 'quote_form' });
  }

  function bindForms() {
    if (!document.querySelectorAll) return;
    document.querySelectorAll('form[name="quote"]').forEach(function (form) {
      var source = form.querySelector ? form.querySelector('[name="source_page"]') : null;
      if (source) source.value = window.location.pathname;
      form.addEventListener('submit', function () {
        try {
          sessionStorage.setItem(KEY, JSON.stringify({
            id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'quote-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            time: Date.now()
          }));
        } catch (_) { /* The form still submits if storage is unavailable. */ }
      });
    });
  }

  function bindTel() {
    if (!document.addEventListener) return;
    document.addEventListener('click', function (e) {
      var contact = e.target && e.target.closest ? e.target.closest('a[href^="sms:"], a[href^="mailto:"]') : null;
      if (contact && contact.getAttribute('data-ccw-contact') !== '1') {
        contact.setAttribute('data-ccw-contact', '1');
        sendAnalytics(contact.getAttribute('href').indexOf('sms:') === 0 ? 'click_to_text' : 'click_to_email');
      }
      var node = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
      var href, go;
      if (!node || node.getAttribute('data-ccw-tel') === '1') return;
      href = node.getAttribute('href');
      if (!href) return;
      node.setAttribute('data-ccw-tel', '1');
      sendAnalytics('click_to_call');
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) {
        sendConversion('tel-' + Date.now());
        return;
      }
      if (e.preventDefault) e.preventDefault();
      go = function () {
        if (node.getAttribute('data-ccw-dialed') === '1') return;
        node.setAttribute('data-ccw-dialed', '1');
        window.location.href = href;
      };
      try { sendConversion('tel-' + Date.now(), go); }
      catch (_) { go(); }
    });
  }

  if (isThanks(window.location.pathname)) consumeInquiry();
  else bindForms();
  bindTel();
})();
