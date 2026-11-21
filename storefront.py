"""CCW shop pages. Shopify owns live catalog, cart, checkout and order state."""
import html
import json
import re
from pathlib import Path
try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib

ROOT = Path(__file__).resolve().parent
REQUIRED_CHECKS = (
    "payments_verified", "inventory_verified", "shipping_pickup_verified",
    "tax_registrations_verified", "product_listing_approved",
    "policies_approved", "test_order_verified", "refund_request_and_restock_verified",
)


def load_config(path=None):
    with open(path or ROOT / "shop.toml", "rb") as stream:
        config = tomllib.load(stream)
    validate_config(config)
    return config


def validate_config(config):
    store = config["store"]
    if store["mode"] not in ("preview", "live"):
        raise ValueError("Shop mode must be preview or live")
    if store["currency"] != "USD" or store["country"] != "US":
        raise ValueError("This launch is configured for US / USD only")
    if store["mode"] == "live":
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*\.myshopify\.com", store["domain"]):
            raise ValueError("Live shop requires its verified myshopify.com domain")
        if not re.fullmatch(r"[a-z0-9-]+", store["collection"]):
            raise ValueError("Invalid Shopify collection handle")
        pending = [key for key in REQUIRED_CHECKS if config.get("launch", {}).get(key) is not True]
        for timing in ("dispatch_time", "delivery_time"):
            if not store.get(timing, "").strip():
                pending.append(timing)
        if pending:
            raise ValueError("Shop launch is incomplete: " + ", ".join(pending))
    seen = set()
    for product in config.get("products", []):
        if not re.fullmatch(r"[a-z0-9-]+", product["handle"]) or product["handle"] in seen:
            raise ValueError("Invalid or duplicate product handle")
        seen.add(product["handle"])
        if type(product["quantity"]) is not int or product["quantity"] < 0:
            raise ValueError("Product quantity must be a nonnegative integer")
        if not isinstance(product["price_usd"], (int, float)) or product["price_usd"] <= 0:
            raise ValueError("Product price must be positive")
        if not product["image"].startswith("/assets/store/") or ".." in product["image"]:
            raise ValueError("Draft product images must be local store assets")
        if store["mode"] == "live" and not all(product.get(k) is True for k in (
            "image_confirmed_accurate", "merchant_approved"
        )):
            raise ValueError("Product review is incomplete: " + product["handle"])


def esc(value):
    return html.escape(str(value), quote=True)


def draft_card(product):
    return f'''<article class="shop-card" data-category="{esc(product['category'])}">
  <button class="shop-image-button" data-product="{esc(product['handle'])}" aria-label="View {esc(product['title'])}">
    <img src="{esc(product['image'])}" alt="{esc(product['image_alt'])}" width="1254" height="1254" loading="lazy">
    <span class="shop-label">{product['quantity']} available · {esc(product['fit'])}</span>
  </button>
  <div class="shop-card-copy"><p class="shop-meta">{esc(product['category'])} / {esc(product['fit'])}</p>
    <h3><button class="shop-title-button" data-product="{esc(product['handle'])}">{esc(product['title'])}</button></h3>
    <div class="shop-card-bottom"><span class="shop-price">${product['price_usd']:,.2f} <small>USD</small></span>
    <button class="shop-text-button" data-product="{esc(product['handle'])}">View details <span aria-hidden="true">↗</span></button></div>
  </div>
</article>'''


def live_catalog(store):
    # Official Web Components keep pricing, variants and cart behavior in Shopify.
    # No Admin token, local inventory counter or custom payment handler is needed.
    return f'''<shopify-store store-domain="https://{esc(store['domain'])}" country="US" language="en"></shopify-store>
<shopify-context type="collection" handle="{esc(store['collection'])}" id="shop-collection">
  <template>
    <div class="shop-grid">
    <shopify-list-context type="product" query="collection.products" first="50" id="shop-products">
      <template>
        <article class="shop-card">
          <span data-catalog-handle hidden><shopify-data query="product.handle"></shopify-data></span>
          <button class="shop-image-button" data-live-product aria-label="View product details">
            <shopify-media query="product.featuredImage" width="600" height="600"></shopify-media>
          </button>
          <div class="shop-card-copy"><p class="shop-meta"><shopify-data query="product.productType"></shopify-data></p>
            <h3><button class="shop-title-button" data-live-product><shopify-data query="product.title"></shopify-data></button></h3>
            <div class="shop-card-bottom"><span class="shop-price">From <shopify-money query="product.priceRange.minVariantPrice"></shopify-money></span>
              <button class="shop-text-button" data-live-product>View details ↗</button></div>
          </div>
        </article>
      </template>
    </shopify-list-context>
    </div>
    <div class="shop-pagination" hidden><button class="shop-text-button" data-page="previousPage" disabled>Previous products</button><button class="shop-text-button" data-page="nextPage" disabled>More products</button></div>
  </template>
  <p shopify-loading-placeholder>Loading the collection…</p>
</shopify-context>
<p class="shop-status" id="shop-connection-status" role="status"></p>
<shopify-cart id="shop-cart" target="_self"></shopify-cart>
<dialog id="product-dialog" class="shop-dialog" aria-label="Product details">
  <button class="shop-close" data-close="product-dialog" aria-label="Close product details">×</button>
  <shopify-context type="product" id="shop-product-detail" wait-for-update>
    <template><div class="shop-detail-grid">
      <div class="shop-product-media" aria-label="Product photos and video">
        <shopify-list-context type="media" query="product.media" first="20">
          <template><figure class="shop-media-item">
            <shopify-media query="media" width="640" height="640" video-autoplay="false" video-loop="false" video-controls="true"></shopify-media>
          </figure></template>
        </shopify-list-context>
      </div>
      <div class="shop-detail-copy"><p class="shop-meta"><shopify-data query="product.productType"></shopify-data></p>
        <h2><shopify-data query="product.title"></shopify-data></h2>
        <p class="shop-price"><shopify-money query="product.selectedOrFirstAvailableVariant.price"></shopify-money> <small>USD</small></p>
        <div class="shop-description"><shopify-data query="product.descriptionHtml"></shopify-data></div>
        <shopify-variant-selector></shopify-variant-selector>
        <span data-product-availability hidden><shopify-data query="product.selectedOrFirstAvailableVariant.availableForSale"></shopify-data></span>
        <button class="shop-primary shop-add" data-live-add disabled><span class="available-label">Add to bag</span><span class="unavailable-label">Unavailable</span></button>
        <p class="shop-fine">Items are not reserved until checkout. Shipping and tax are shown before payment.</p>
        <a class="shop-policy-link" href="/shop-policies">Shipping &amp; returns</a>
      </div>
    </div></template>
    <p shopify-loading-placeholder>Loading product details…</p>
  </shopify-context>
</dialog>'''


def page(config):
    store = config["store"]
    preview = store["mode"] == "preview"
    products = config.get("products", [])
    banner = '<div class="shop-preview-bar">Store preview · Checkout is not open yet</div>' if preview else ''
    catalog = ('<div class="shop-grid">' + ''.join(draft_card(p) for p in products) + '</div>') if preview else live_catalog(store)
    preview_dialogs = '''<dialog id="product-dialog" class="shop-dialog" aria-labelledby="product-title">
  <button class="shop-close" data-close="product-dialog" aria-label="Close product details">×</button><div id="product-detail"></div>
</dialog>
<dialog id="preview-cart" class="shop-dialog shop-bag-dialog" aria-labelledby="bag-title">
  <button class="shop-close" data-close="preview-cart" aria-label="Close bag">×</button>
  <p class="shop-meta">Chronic Clubworks</p><h2 id="bag-title">Your bag.</h2><p class="shop-fine">Preview only. Nothing can be purchased or reserved here.</p>
  <div id="bag-items"></div><div id="bag-totals"></div>
  <button class="shop-primary" disabled>Checkout opens at launch</button>
  <button class="shop-text-button" data-close="preview-cart">Keep exploring</button>
</dialog>''' if preview else ''
    # Escaping '<' prevents a product string from closing the JSON script element.
    data = json.dumps({"mode": store["mode"], "shipping": store["shipping_flat_usd"], "delivery": store["delivery_time"], "products": products if preview else []}).replace('<', '\\u003c')
    pickup_strip = '<span>Denver pickup by appointment</span>' if store.get('pickup') else ''
    delivery_strip = f'<span>{esc(store["delivery_time"])}</span>' if store["delivery_time"] else ''
    marker_rate = store['ball_marker_shipping_usd']
    shipping_label = f"Ball markers · ${marker_rate:g} flat U.S. shipping"
    gallery = [
        ("front", "Turquoise and pink CCW enamel ball marker with a Denver skyline across the visor"),
        ("edge", "Angled view of the enamel face and polished metal edge"),
        ("scale", "CCW ball marker beside a U.S. quarter for scale"),
        ("back", "Silver reverse of the marker stamped Denver, CO"),
    ]
    marker_photos = []
    for index, (view, alt) in enumerate(gallery):
        path = f"/assets/store/ccw-denver-ball-marker-{view}.jpg"
        loading = 'fetchpriority="high"' if index == 0 else 'loading="lazy"'
        marker_photos.append(f'<a class="lightbox" href="{path}" data-caption="{alt}"><img src="{path}" alt="{alt}" width="1254" height="1254" {loading}></a>')
    body = f'''<div class="ccw-shop" data-shop-mode="{store['mode']}">
{banner}
<section class="shop-intro wrap" id="ccw-denver-ball-marker">
  <div class="shop-intro-copy"><p class="eyebrow">Chronic Clubworks / The shop</p>
    <h1>CCW Denver<br><span>Ball Marker</span></h1>
    <p class="shop-lede">The Denver skyline sits across the visor of our turquoise and pink CCW mask. A polished metal edge frames the enamel face, with “Denver, CO” on the back.</p>
    <p class="shop-price">$15.00 <small>USD each</small></p>
    <p class="shop-fine">${marker_rate:g} flat U.S. shipping per order. Quarter shown for scale.</p>
    <div class="shop-hero-actions"><button class="shop-primary" id="open-marker" hidden>Shop the ball marker</button>
      <a id="marker-inquiry" class="shop-text-button" href="mailto:info@tcclubworks.io?subject=CCW%20Denver%20Ball%20Marker">Ask about availability</a>
      <a class="shop-text-button" href="#collection">Browse the collection ↘</a></div>
  </div>
  <div class="shop-marker-photos" aria-label="Ball marker photos">{''.join(marker_photos)}</div>
</section>
<div class="shop-strip"><div class="wrap"><span>{shipping_label}</span>{delivery_strip}{pickup_strip}<span>{store['return_days']}-day returns · unused items</span></div></div>
<section class="shop-collection wrap" id="collection" aria-labelledby="collection-title">
  <div class="shop-section-heading"><div><p class="eyebrow">Small runs. Personal touches.</p><h2 id="collection-title">The collection.</h2></div>
    <button class="shop-bag-button" id="open-bag" aria-haspopup="dialog">Bag <span id="bag-count" aria-label="items in bag">0</span></button></div>
  <div class="shop-filters" role="group" aria-label="Filter products">
    <button data-filter="all" aria-pressed="true">All pieces</button><button data-filter="Ball Markers" aria-pressed="false">Ball markers</button><button data-filter="Headcovers" aria-pressed="false">Headcovers</button><button data-filter="Apparel" aria-pressed="false">Apparel</button>
  </div>
  {catalog}
  <div id="shop-empty" class="shop-empty" hidden><p class="eyebrow">CCW apparel</p><h3>Off the bench.<br>Into your rotation.</h3><p>The first apparel release is in the works. Come back for the drop.</p><a class="shop-text-button" href="/contact">Get in touch ↗</a></div>
  <p class="shop-fine" id="shop-announcement" role="status" aria-live="polite"></p>
</section>
<section class="shop-custom"><div class="wrap"><div><p class="eyebrow">Something only you could carry</p><h2>Your story.<br>Your headcover.</h2></div><div><p>A favorite jersey. A thrift-store find. Something with a little history. Let's turn it into your next headcover.</p><a class="shop-primary" href="/contact">Talk through an idea ↗</a></div></div></section>
<div class="shop-service-links wrap"><a href="/shop-policies">Shipping &amp; returns ↗</a><a href="/shop-privacy">Privacy ↗</a><a href="/shop-terms">Terms ↗</a><a href="mailto:info@tcclubworks.io">Need a hand? Email CCW ↗</a></div>
{preview_dialogs}<script type="application/json" id="shop-data">{data}</script>
<script defer src="/assets/storefront.js"></script>
</div>'''
    extra = '<link rel="stylesheet" href="/assets/storefront.css">'
    if not preview:
        extra += '<script type="module" src="https://cdn.shopify.com/storefront/web-components.js"></script>'
    return dict(path="/shop", title="Shop Golf Ball Markers & Custom Headcovers | Chronic Clubworks",
                desc="Shop the CCW Denver enamel golf ball marker and custom golf headcovers from Chronic Clubworks. U.S. shipping available.",
                schemas=[], body=body, noindex=preview, tracking=False, extra_head=extra)


def policy_pages(config):
    store = config["store"]
    preview = store["mode"] == "preview"
    note = '<p class="shop-policy-draft">Draft for review. The online store is not accepting orders.</p>' if preview else ''
    dispatch = esc(store["dispatch_time"]) or 'Dispatch time will be confirmed before the store opens.'
    delivery = esc(store["delivery_time"]) or 'Delivery time will be confirmed before the store opens.'
    pickup_policy = '<h2>Denver pickup</h2><p>Local pickup is available by appointment. Select pickup at checkout when available. Wait for confirmation that your order is ready; we will provide the pickup details and arrange a time.</p>' if store.get('pickup') else ''
    shipping_policy = f"Standard U.S. shipping is ${store['ball_marker_shipping_usd']:g} per order containing a CCW Denver Ball Marker, regardless of marker quantity. The India Cricket Custom Headcover ships free when ordered on its own."
    refund_shipping = ' For products with shipping included in the listed price, an accepted full return refunds that price without an outbound shipping deduction.'
    policies = [
        ("/shop-policies", "Shipping & returns", f'''
<h2>Shipping in the United States</h2><p>{shipping_policy} Applicable sales tax is shown at checkout. We do not offer international shipping at launch.</p>
<p>{dispatch} {delivery} The delivery window includes order processing and carrier transit. If we cannot meet the promised shipment date, we will contact you about the delay and your cancellation/refund options. Contact us if delivery is delayed.</p>
{pickup_policy}
<h2>Returns</h2><p>Contact info@tcclubworks.io within {store['return_days']} days of delivery to request a return of an unused item. The buyer pays return postage for change-of-mind returns. We will provide return instructions before you send it back.</p>
<p>We will review the returned item and contact you about the refund. Approved refunds go to the original payment method.{refund_shipping} Your payment provider may take additional time to post the credit.</p>
<h2>Damaged, defective or incorrect items</h2><p>Email us with your order number and a description of the problem. Photos can help us resolve it. CCW will work with you to resolve defects or an incorrect shipment, including return postage when needed. The change-of-mind return policy does not limit rights provided by applicable law.</p>
<h2>Personalized work & cancellations</h2><p>This store's return policy covers ready-made products. Any different terms for commissioned or personalized work will be disclosed and agreed before purchase. Contact us promptly if you need to cancel; we will confirm whether your order has shipped.</p>'''),
        ("/shop-privacy", "Store privacy notice", '''
<h2>Who handles your information</h2><p>Chronic Clubworks, Denver, Colorado, operates this storefront. Contact info@tcclubworks.io with privacy questions or requests.</p>
<h2>Information used for an order</h2><p>Shopify hosts our shopping cart and checkout. When you place an order, information such as your name, email, delivery or billing address, order details and payment status is used to process payment, fulfill the order, prevent fraud and provide support. Card details are entered with the payment provider; CCW does not collect or store full card numbers or card security codes on this website.</p>
<h2>Service providers</h2><p>Shopify and its payment services, our website host Netlify, and the delivery carrier may process information needed to provide their services. Shopify checkout may use cookies and related technology for cart operation, security and payment. Visit <a href="https://www.shopify.com/legal/privacy">Shopify's privacy policy</a> for its practices.</p>
<h2>Browsing and contacting us</h2><p>Our website host may receive technical information such as your IP address and request logs. The shop pages do not load the site's Google Ads tag. Other pages on tcclubworks.io may use Google advertising technology. If you email us or use the separate contact form, we receive the information you choose to send.</p>
<h2>Retention and choices</h2><p>We retain order and support records as needed to fulfill orders, handle returns and disputes, and meet tax and recordkeeping obligations. You may ask us to access, correct or delete personal information, subject to applicable legal and recordkeeping requirements. Purchasing does not subscribe you to CCW marketing emails.</p>'''),
        ("/shop-terms", "Store terms", '''
<h2>Seller and contact</h2><p>The seller is Chronic Clubworks, Denver, Colorado. Contact info@tcclubworks.io or (720) 854-4132 for help with an order.</p>
<h2>Products and availability</h2><p>Headcovers may be made from donor textiles with their own texture and history. Review each listing for the item, club fit, materials and condition. Product-specific information controls; contact us before ordering if fit or condition is unclear.</p>
<p>Adding an item to a bag does not reserve it. Availability is checked during checkout. An order confirmation records the transaction; if we cannot supply an item, we will contact you and refund the unavailable item.</p>
<h2>Pricing and payment</h2><p>Prices are in U.S. dollars. Shipping and applicable tax are displayed before you pay. Payment is processed through Shopify checkout. If a material listing or pricing error affects an order, we will contact you to resolve it or provide a refund; we will not charge an increased price without your agreement.</p>
<h2>Delivery, returns and problems</h2><p>Our <a href="/shop-policies">shipping and returns policy</a> is part of these terms. Contact us if an order is late, damaged or incorrect. Nothing in these terms limits consumer rights or remedies that cannot lawfully be limited.</p>'''),
    ]
    result = []
    for path, title, content in policies:
        result.append(dict(path=path, title=title + " | Chronic Clubworks", desc=title + " for the Chronic Clubworks online shop. Contact CCW in Denver for help with your order.",
            schemas=[], body=f'<section class="shop-policy wrap"><a class="shop-text-button" href="/shop">← Back to the shop</a><p class="eyebrow">Chronic Clubworks</p><h1>{esc(title)}</h1>{note}{content}</section>',
            noindex=preview, tracking=False, extra_head='<link rel="stylesheet" href="/assets/storefront.css">'))
    return result
