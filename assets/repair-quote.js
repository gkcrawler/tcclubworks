/* Keep the native quote links usable with a keyboard, in a new tab, and on reload. */
(() => {
  const form = document.getElementById('quote');
  const service = form.elements.namedItem('service');

  function selectLinkedService() {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target && form.contains(target) && target.dataset.service) {
      service.value = target.dataset.service;
    }
  }

  window.addEventListener('hashchange', selectLinkedService);
  selectLinkedService();

  // Returning to the same fragment after editing the dropdown fires no hashchange.
  for (const link of document.querySelectorAll('#reshafting-regripping a[href^="#quote-"]')) {
    link.addEventListener('click', event => {
      if (link.hash === window.location.hash && !event.ctrlKey && !event.metaKey &&
          !event.altKey && !event.shiftKey) {
        selectLinkedService();
      }
    });
  }
})();
