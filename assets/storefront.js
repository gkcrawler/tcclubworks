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
  let currentFilter = 'all';
  function filterProducts() {
    const cards = [...document.querySelectorAll('.shop-card')];
    let visible = 0;
    cards.forEach(card => {const show = currentFilter === 'all' || card.dataset.category?.toLowerCase() === currentFilter.toLowerCase(); card.hidden = !show; if(show) visible++;});
    const empty = $('shop-empty');
    empty.hidden = visible > 0 || (!preview && !cards.length);
    if (!empty.hidden) {
      empty.querySelector('.eyebrow').textContent = currentFilter === 'Apparel' ? 'CCW apparel' : 'The next drop';
      empty.querySelector('h3').textContent = currentFilter === 'Apparel' ? 'Off the bench. Into your rotation.' : 'More pieces are on the way.';
      empty.querySelector('p:not(.eyebrow)').textContent = currentFilter === 'Apparel' ? 'The first apparel release is in the works. Come back for the drop.' : 'No pieces are listed in this category right now.';
    }
  }
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) closeDialog(close.dataset.close);
    const draft = event.target.closest('[data-product]');
    if (preview && draft) previewProduct(draft.dataset.product);
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      currentFilter=filter.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b===filter)));
      filterProducts();
    }
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
  $('open-bag').addEventListener('click', () => {
    if(preview) {renderBag(); showDialog('preview-cart');}
    else if(typeof $('shop-cart')?.showModal === 'function') $('shop-cart').showModal();
    else $('shop-connection-status').textContent='The shop is still loading. Please try again shortly.';
  });
  if(preview) renderBag();
  else {
    // Native Shopify cart owns quantity; do not display an inaccurate local count.
    $('bag-count').hidden=true;
    const catalog=$('shop-collection');
    const observer=new MutationObserver(() => {filterProducts(); if(document.querySelector('.shop-card')) $('shop-connection-status').textContent='';});
    observer.observe(catalog,{childList:true,subtree:true});
    window.setTimeout(() => {
      if(!document.querySelector('.shop-card')) $('shop-connection-status').textContent='No products are available to display right now. Please try again later or contact info@tcclubworks.io.';
    },12000);
  }
  filterProducts();
})();
