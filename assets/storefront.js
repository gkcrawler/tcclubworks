/* Preview is deliberately local and cannot open a payment session.
 * Live cart/variants/checkout use Shopify's official Web Components. */
(() => {
  'use strict';
  const dataNode = document.getElementById('shop-data');
  if (!dataNode) return;
  const config = JSON.parse(dataNode.textContent);
  const preview = config.mode === 'preview';
  const products = new Map(config.products.map(p => [p.handle, p]));
  const bag = new Set();
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(value);
  const make = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  function closeDialog(id) { $(id)?.close(); }
  function showDialog(id) { if (!$(id).open) $(id).showModal(); }
  function previewProduct(handle) {
    const p = products.get(handle);
    if (!p) return;
    const grid = make('div', undefined, 'shop-detail-grid');
    const img = make('img'); img.src = p.image; img.alt = p.image_alt; img.width = 640; img.height = 640;
    const copy = make('div', undefined, 'shop-detail-copy');
    const title = make('h2', p.title); title.id = 'product-title';
    copy.append(make('p', `${p.category} / ${p.fit}`, 'shop-meta'), title, make('p', `${money(p.price_usd)} USD`, 'shop-price'), make('p', p.description, 'shop-description'));
    const dl = make('dl');
    for (const [label, value] of [['Fit', p.fit], ['Material', p.material], ['Quantity', p.quantity]]) dl.append(make('dt', label), make('dd', value));
    const add = make('button', bag.has(handle) ? 'Already in your preview bag' : 'Add to preview bag', 'shop-primary');
    add.disabled = bag.has(handle) || p.quantity < 1;
    add.addEventListener('click', () => {
      bag.add(handle); closeDialog('product-dialog'); renderBag(); showDialog('preview-cart');
      $('shop-announcement').textContent = `${p.title} added to the preview bag. Checkout is not open.`;
    });
    const link = make('a', 'Shipping & returns', 'shop-policy-link'); link.href='/shop-policies';
    copy.append(dl, add, make('p', 'Store preview. This item cannot be purchased or reserved yet.', 'shop-fine'), link);
    grid.append(img, copy); $('product-detail').replaceChildren(grid); showDialog('product-dialog');
  }
  function renderBag() {
    const items = $('bag-items'); items.replaceChildren();
    let subtotal = 0;
    for (const handle of bag) {
      const p = products.get(handle); subtotal += p.price_usd;
      const row = make('div', undefined, 'shop-bag-row');
      const image = make('img'); image.src = p.image; image.alt = p.image_alt;
      const info = make('div');
      const remove = make('button', 'Remove', 'shop-text-button');
      remove.setAttribute('aria-label', `Remove ${p.title}`);
      remove.addEventListener('click', () => {bag.delete(handle); renderBag(); $('preview-cart').querySelector('[data-close]').focus();});
      info.append(make('h3', p.title), make('p', `${p.fit} · Quantity 1 · ${money(p.price_usd)}`), remove);
      row.append(image, info); items.append(row);
    }
    if (!bag.size) items.append(make('p', 'Your bag is empty. Find your next one-off.', 'shop-fine'));
    const totals = $('bag-totals'); totals.replaceChildren();
    if (bag.size) {
      for (const [label, value] of [['Subtotal', money(subtotal)], ['U.S. shipping', config.shipping === 0 ? 'Free' : money(config.shipping)], ['Sales tax', 'Calculated at checkout']]) {
        const row = make('div', undefined, 'shop-total-row'); row.append(make('span', label), make('strong', value)); totals.append(row);
      }
      totals.append(make('p', `${config.delivery || ''} Final totals will appear at checkout when the store opens.`, 'shop-fine'));
    }
    $('bag-count').textContent=String(bag.size);
  }
  const supplier = 'Pins and Aces';
  const partnerShop = dataNode.closest('.ccw-shop').dataset.storefront === 'partner';
  let currentFilter = 'all';
  function matchesFilter(card) {
    const vendor = card.querySelector('[data-vendor]')?.textContent.trim();
    if (partnerShop) return vendor === supplier;
    if (vendor === supplier) return false;
    const type = (card.dataset.category || card.querySelector('[data-type]')?.textContent || '').trim();
    let category;
    if (/\bhead\s*covers?\b/i.test(type)) category = 'Headcovers';
    else if (/\bball\s*markers?\b/i.test(type)) category = 'Ball Markers';
    else if (/\b(hats?|caps?)\b/i.test(type)) category = 'Hats';
    return Boolean(category && (currentFilter === 'all' || currentFilter === category));
  }
  function filterProducts() {
    const cards = [...document.querySelectorAll('.shop-card')];
    for (const card of cards) card.hidden = !matchesFilter(card);
    const empty = $('shop-empty');
    empty.hidden = (!preview && !cards.length) || cards.some(card => !card.hidden);
    if (!empty.hidden) {
      const paginated = document.querySelector('.shop-pagination:not([hidden])');
      empty.textContent = currentFilter === 'all' || paginated
        ? 'No matching items on this page.'
        : `No CCW ${currentFilter.toLowerCase()} are listed right now.`;
    }
  }
  function selectFilter(value) {
    currentFilter = value;
    document.querySelectorAll('[data-filter]').forEach(button => {
      if (button.dataset.filter === 'all') button.hidden = value === 'all';
      else button.setAttribute('aria-pressed', String(button.dataset.filter === value));
    });
    filterProducts();
  }
  function readCollectionLink() {
    if (!partnerShop && location.hash === '#pins-and-aces') location.replace('/pins-and-aces' + location.search);
    else if (location.hash === '#collection') selectFilter('all');
  }
  window.addEventListener('hashchange', readCollectionLink);
  readCollectionLink();
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) closeDialog(close.dataset.close);
    const draft = event.target.closest('[data-product]');
    if (preview && draft) previewProduct(draft.dataset.product);
    const filter = event.target.closest('[data-filter]');
    if (filter) selectFilter(filter.dataset.filter === currentFilter ? 'all' : filter.dataset.filter);
    if (event.target.closest('a[href="#collection"]')) selectFilter('all');
    if (!preview) {
      const details=event.target.closest('[data-live-product]');
      if(details) {$('shop-product-detail').update(event); showDialog('product-dialog');}
      if(event.target.closest('[data-live-add]')) {
        $('shop-cart').addLine(event); closeDialog('product-dialog'); $('shop-cart').showModal();
      }
      const page=event.target.closest('[data-page]');
      if(page && ['nextPage','previousPage'].includes(page.dataset.page)) $('shop-products')?.[page.dataset.page]();
    }
  });
  document.querySelectorAll('.shop-dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if(event.target!==dialog) return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
  }));
  // Stop product video when the dialog closes, including Escape and add-to-bag.
  $('product-dialog').addEventListener('close', () => {
    $('product-dialog').querySelectorAll('video').forEach(video => video.pause());
  });
  $('open-bag').addEventListener('click', () => {
    if(preview) {renderBag(); showDialog('preview-cart');}
    else if(typeof $('shop-cart')?.showModal === 'function') $('shop-cart').showModal();
    else $('shop-connection-status').textContent='The shop is still loading. Please try again shortly.';
  });
  if(preview) renderBag();
  else {
    // Native Shopify cart owns quantity; do not display an inaccurate local count.
    $('bag-count').hidden=true;
    const detail=$('shop-product-detail');
    const markerHandle = 'ccw-denver-ball-marker';
    const available = scope => scope?.querySelector('[data-product-availability]')?.textContent.trim() === 'true';
    const syncAvailability=() => {
      const button=detail.querySelector('[data-live-add]');
      const canBuy = available(detail);
      if(button) button.disabled = !canBuy;
      const stock = detail.querySelector('[data-stock]');
      if (stock) stock.hidden = !canBuy;
      const shipping = detail.querySelector('[data-supplier-shipping]');
      if (shipping) shipping.hidden = detail.querySelector('[data-vendor]')?.textContent.trim() !== supplier;
    };
    new MutationObserver(syncAvailability).observe(detail,{childList:true,characterData:true,subtree:true});
    const catalog=$('shop-collection');
    const markerButton = $('open-marker');
    let markerDetails;
    function syncMarker() {
      if (!markerButton) return;
      const handle = [...catalog.querySelectorAll('[data-catalog-handle]')].find(
        node => node.textContent.trim() === markerHandle
      );
      const card = handle?.closest('.shop-card');
      const inStock = available(card);
      $('marker-stock').hidden = !inStock;
      markerDetails = card?.querySelector('[data-live-product]');
      markerButton.hidden = !markerDetails;
      $('marker-inquiry').hidden = Boolean(markerDetails);
    }
    markerButton?.addEventListener('click', () => markerDetails?.click());
    syncMarker();
    catalog.addEventListener('shopify-list-context-update', event => {
      const {hasNextPage,hasPreviousPage}=event.detail;
      const previous=catalog.querySelector('[data-page="previousPage"]');
      const next=catalog.querySelector('[data-page="nextPage"]');
      if(previous) previous.disabled=!hasPreviousPage;
      if(next) next.disabled=!hasNextPage;
      const pagination=catalog.querySelector('.shop-pagination');
      if(pagination) pagination.hidden=!(hasNextPage || hasPreviousPage);
    },true);
    function syncCatalog() {
      const cards = catalog.querySelectorAll('.shop-card');
      for (const card of cards) {
        const ready = Boolean(card.querySelector('[data-catalog-handle]')?.textContent.trim());
        const canBuy = available(card);
        card.querySelector('[data-stock]').hidden = !ready || !canBuy;
        card.querySelector('[data-sold-out]').hidden = !ready || canBuy;
      }
      filterProducts();
      syncMarker();
      if (cards.length) $('shop-connection-status').textContent='';
    }
    const observer=new MutationObserver(syncCatalog);
    observer.observe(catalog,{childList:true,characterData:true,subtree:true});
    syncCatalog();
    window.setTimeout(() => {
      if(!document.querySelector('.shop-card')) $('shop-connection-status').textContent='No products are available to display right now. Please try again later or contact info@tcclubworks.io.';
    },12000);
  }
  filterProducts();
})();
