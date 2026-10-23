/* Count an inquiry only after the form returns to its confirmation page. */
(function () {
  'use strict';
  var key = 'ccw-pending-inquiry';
  if (/^\/thanks\/?$/.test(window.location.pathname)) {
    try {
      var pending = JSON.parse(sessionStorage.getItem(key) || 'null');
      sessionStorage.removeItem(key);
      if (pending && pending.id && Date.now() - pending.time >= 0 &&
          Date.now() - pending.time < 30 * 60 * 1000 &&
          typeof window.gtag === 'function') {
        window.gtag('event', 'conversion', {
          send_to: 'AW-18288494011/4rQbCMWt6-IcELuL0ZBE',
          transaction_id: pending.id
        });
      }
    } catch (_) { /* Storage restrictions must never block an inquiry. */ }
    return;
  }
  document.querySelectorAll('form[name="quote"]').forEach(function (form) {
    form.addEventListener('submit', function () {
      try {
        sessionStorage.setItem(key, JSON.stringify({
          id: window.crypto.randomUUID(),
          time: Date.now()
        }));
      } catch (_) { /* The form still submits if storage is unavailable. */ }
    });
  });
})();
