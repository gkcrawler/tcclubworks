#!/usr/bin/env python3
"""Chronic Clubworks — 4-page static site generator. Cyberpunk build."""
import os, json, html

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11 local fallback; Netlify uses runtime.txt.
    import tomli as tomllib

OUT = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(OUT, "content.toml"), "rb") as _f:
    C = tomllib.load(_f)

_c = C["contact"]
D = "https://tcclubworks.io"
BRAND = "Chronic Clubworks"
TEL_D, TEL_E = _c["phone_display"], _c["phone_link"]
EMAIL = _c["email"]
IG = _c["instagram"]
AREAS = _c["service_area"]
HOURS = _c["hours"]
I   = {k: v["file"] for k, v in C["photos"].items()}
ALT = {k: v["alt"]  for k, v in C["photos"].items()}


def pic(key, w, h, loading="lazy", priority=False):
    """<picture> with WebP for self-hosted images; plain <img> for remote ones."""
    src, alt = I[key], html.escape(ALT[key])
    fp = ' fetchpriority="high"' if priority else ''
    if src.startswith("/assets/"):
        webp = src.rsplit(".",1)[0] + ".webp"
        return (f'<picture><source type="image/webp" srcset="{webp}">'
                f'<img src="{src}" alt="{alt}" width="{w}" height="{h}" '
                f'loading="{loading}" decoding="async"{fp}></picture>')
    return (f'<img src="{src}" alt="{alt}" width="{w}" height="{h}" '
            f'loading="{loading}" decoding="async"{fp}>')
NAV = [("/","Home"),("/golf-club-repair-denver","Services"),
       ("/custom-golf-headcovers-denver","Headcovers"),
       ("/custom-golf-clubs-about","About"),("/contact","Contact")]


def FULL(key):
    """Full-size variant of a gallery image for the lightbox."""
    import re as _re
    src = I[key]
    if src.startswith("/assets/"): return src
    return _re.sub(r"w=\d+", "w=1600", src)

# ----------------------------------------------------------------- schema
def biz():
    return {"@context":"https://schema.org","@type":"LocalBusiness","@id":D+"/#business",
      "name":BRAND,
      "description":"Custom golf clubmaking, precision golf club repair, and handmade custom golf headcovers serving the Denver metro. Reshafting, regripping, loft and lie adjustment, putter restoration, and one-off headcover builds.",
      "url":D,"email":EMAIL,"telephone":TEL_E,"image":D+"/assets/og-image.jpg",
      "logo":D+"/assets/logo-v2.svg","priceRange":"$$",
      "address":{"@type":"PostalAddress","addressLocality":"Denver","addressRegion":"CO","addressCountry":"US"},
      "areaServed":[{"@type":"City","name":c} for c in AREAS],
      "openingHoursSpecification":[{"@type":"OpeningHoursSpecification",
        "dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        "opens":_c["hours_open"],"closes":_c["hours_close"]}],
      "sameAs":[IG]}

def svc(name, desc, anchor, low=None, high=None):
    o = {"@context":"https://schema.org","@type":"Service","name":name,"description":desc,
         "serviceType":name,"url":D+"/golf-club-repair-denver#"+anchor,
         "provider":{"@id":D+"/#business"},
         "areaServed":[{"@type":"City","name":c} for c in AREAS]}
    if low is not None:
        o["offers"]={"@type":"Offer","priceCurrency":"USD","priceSpecification":{
            "@type":"PriceSpecification","minPrice":low,"maxPrice":high,"priceCurrency":"USD",
            "valueAddedTaxIncluded":False},
            "description":"Labor per club. Parts priced separately."}
    return o

def svc_page(name, desc, path, price_desc="Quoted per project"):
    return {"@context":"https://schema.org","@type":"Service","name":name,
      "description":desc,"serviceType":name,"url":D+path,
      "provider":{"@id":D+"/#business"},
      "areaServed":[{"@type":"City","name":c} for c in AREAS],
      "offers":{"@type":"Offer","priceCurrency":"USD","description":price_desc}}

def faq(pairs):
    return {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
      {"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in pairs]}

def crumbs(path,label):
    it=[{"@type":"ListItem","position":1,"name":"Home","item":D+"/"}]
    if path!="/": it.append({"@type":"ListItem","position":2,"name":label,"item":D+path})
    return {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":it}

# ----------------------------------------------------------------- chrome
def head(p):
    canon=D+(p["path"] if p["path"]!="/" else "/")
    ld="\n".join(f'<script type="application/ld+json">{json.dumps(x,separators=(",",":"))}</script>'
                 for x in p["schemas"])
    preconnect = '<link rel="preconnect" href="https://assets.zyrosite.com" crossorigin>\n' if any(
        str(v).startswith("https://assets.zyrosite.com") for v in I.values()
    ) else ""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(p['title'])}</title>
<meta name="description" content="{html.escape(p['desc'])}">
<link rel="canonical" href="{canon}">
<meta name="theme-color" content="#06060f">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icon-180.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:title" content="{html.escape(p['title'])}">
<meta property="og:description" content="{html.escape(p['desc'])}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{D}/assets/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
{preconnect}<link rel="stylesheet" href="/assets/style.css">
{ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
"""

def header(active):
    links="".join('<a href="%s"%s>%s</a>'%(h,' aria-current="page"' if h==active else '',html.escape(t))
                  for h,t in NAV)
    return f"""<header>
  <div class="wrap nav">
    <a class="logo" href="/" aria-label="{BRAND} home">
      <img src="/assets/logo-v2.svg" alt="{BRAND}" width="320" height="154">
    </a>
    <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false">☰</button>
    <nav class="menu" id="menu">{links}</nav>
    <div class="acts">
      <a class="tel" href="tel:{TEL_E}">{TEL_D}</a>
      <a class="btn" href="/contact">Get a quote</a>
    </div>
  </div>
</header>
"""

def hero(kick,h1a,h1b,lede,imgkey):
    imghtml = pic(imgkey, 1200, 1500, loading='eager', priority=True)
    return f"""<section class="hero">
  <div class="wrap hgrid">
    <div>
      <p class="eyebrow">{html.escape(kick)}</p>
      <h1>{html.escape(h1a)}<br><span class="grad">{html.escape(h1b)}</span></h1>
      <p class="lede h1sub">{lede}</p>
      <div class="hbtns">
        <a class="btn lg" href="/contact">Get a quote</a>
        <a class="btn ghost lg" href="tel:{TEL_E}">Call {TEL_D}</a>
      </div>
    </div>
    <div class="hero-media">
      {imghtml}
      <div class="badge"><b class="grad">150+</b><span>Combined years at the bench</span></div>
    </div>
  </div>
  <div class="trust"><div class="wrap"><ul>
    <li><b>Location</b><span>Denver metro</span></li>
    <li><b>Hours</b><span>{HOURS}</span></li>
    <li><b>Turnaround</b><span>Most work in days</span></li>
    <li><b>Service area</b><span>Denver &amp; Front Range</span></li>
  </ul></div></div>
</section>"""

def form(compact=False):
    return f"""<form name="quote" method="POST" data-netlify="true" netlify-honeypot="bot-field"
        action="/thanks">
  <input type="hidden" name="form-name" value="quote">
  <p class="hp"><label>Don't fill this out: <input name="bot-field" tabindex="-1"></label></p>
  <div class="f2">
    <div class="fld"><label for="n">Name</label><input id="n" name="name" type="text" autocomplete="name" required></div>
    <div class="fld"><label for="p">Phone</label><input id="p" name="phone" type="tel" autocomplete="tel"></div>
  </div>
  <div class="fld"><label for="e">Email</label><input id="e" name="email" type="email" autocomplete="email" required></div>
  <div class="fld"><label for="s">What do you need?</label>
    <select id="s" name="service">
      <option>Reshafting &amp; regripping</option>
      <option>Custom clubmaking</option>
      <option>Loft &amp; lie adjustment</option>
      <option>Repairs &amp; restoration</option>
      <option>Custom headcovers</option>
      <option>Not sure — need advice</option>
    </select></div>
  <div class="fld"><label for="m">Tell us about your clubs</label>
    <textarea id="m" name="message" rows="5" placeholder="What are you playing now, and what isn't working?" required></textarea></div>
  <button class="btn lg" type="submit">Send inquiry</button>
  <p class="formnote">Goes to info@ and paul@tcclubworks.io. We reply within a day.</p>
</form>"""

def contact_section():
    return f"""<section class="pad" id="contact">
  <div class="wrap cgrid">
    <div>
      <p class="eyebrow">Get in touch</p>
      <h2>Tell us about <span class="grad">your clubs.</span></h2>
      <p class="lede">Send a note with what you're playing and what isn't working. We'll come back with a firm quote and a timeline.</p>
      <ul class="facts">
        <li><b>Phone</b><a href="tel:{TEL_E}">{TEL_D}</a></li>
        <li><b>Email</b><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li><b>Location</b><span>Denver, CO — by appointment</span></li>
        <li><b>Hours</b><span>{HOURS}</span></li>
        <li><b>Instagram</b><a href="{IG}" rel="noopener">@tc_clubworks</a></li>
      </ul>
    </div>
    {form()}
  </div>
</section>"""

def ctaband():
    return f"""<div class="ctaband"><div class="wrap">
  <h2>Ready to stop <span class="grad">blaming the clubs?</span></h2>
  <div class="hbtns" style="margin:0">
    <a class="btn lg" href="/contact">Get a quote</a>
    <a class="btn ghost lg" href="tel:{TEL_E}">Call {TEL_D}</a>
  </div>
</div></div>"""

def footer():
    return f"""<footer>
  <div class="wrap">
    <div class="fcols">
      <div>
        <div class="brandrow">
          <a class="logo" href="/"><img src="/assets/logo-v2.svg" alt="{BRAND}" width="320" height="154"></a>
          <a class="cert lightbox" href="/assets/img/cert-full.jpg"
             data-caption="Golfsmith Distinguished Clubmaker Award presented to Paul Cohn, 2002"
             aria-label="View the Golfsmith Distinguished Clubmaker Award certificate">
            <span class="cert-seal" aria-hidden="true">&#9733;</span>
            <span class="cert-txt"><b>Distinguished Clubmaker</b><small>Golfsmith &middot; Paul Cohn</small></span>
          </a>
        </div>
        <p class="tagline">Custom golf clubs and precision repair, built in Denver, Colorado.</p>
      </div>
      <div><h4>Services</h4><ul>
        <li><a href="/golf-club-repair-denver#reshafting-regripping">Reshafting &amp; Regripping</a></li>
        <li><a href="/golf-club-repair-denver#custom-clubmaking">Custom Clubmaking</a></li>
        <li><a href="/golf-club-repair-denver#loft-and-lie">Loft &amp; Lie</a></li>
        <li><a href="/golf-club-repair-denver#repairs-restorations">Repairs &amp; Restorations</a></li>
        <li><a href="/custom-golf-headcovers-denver">Custom Headcovers</a></li>
      </ul></div>
      <div><h4>Company</h4><ul>
        <li><a href="/custom-golf-clubs-about">About</a></li>
        <li><a href="/contact">Contact</a></li>
        <li><a href="{IG}" rel="noopener">Instagram</a></li>
      </ul></div>
      <div><h4>Contact</h4><ul>
        <li><a href="tel:{TEL_E}">{TEL_D}</a></li>
        <li><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li>Denver, CO</li>
        <li>{HOURS}</li>
      </ul></div>
    </div>
    <div class="fbot">
      <p>Serving {", ".join(AREAS)} and the Front Range.</p>
      <p>&copy; 2026 {BRAND}. All rights reserved.</p>
    </div>
  </div>
</footer>
<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Photo viewer" hidden>
  <button class="lb-close" id="lbClose" aria-label="Close photo viewer">&times;</button>
  <button class="lb-prev"  id="lbPrev"  aria-label="Previous photo">&#8249;</button>
  <button class="lb-next"  id="lbNext"  aria-label="Next photo">&#8250;</button>
  <figure><img id="lbImg" src="" alt=""><figcaption id="lbCap"></figcaption></figure>
  <p class="lb-count" id="lbCount" aria-live="polite"></p>
</div>
<script>
(function(){{
  var b=document.getElementById('burger'),m=document.getElementById('menu');
  if(b){{b.addEventListener('click',function(){{var o=m.classList.toggle('open');b.setAttribute('aria-expanded',o);}});
  m.addEventListener('click',function(e){{if(e.target.tagName==='A')m.classList.remove('open');}});}}

  var links=[].slice.call(document.querySelectorAll('.gal a, a.lightbox'));
  if(!links.length) return;
  var lb=document.getElementById('lb'), img=document.getElementById('lbImg'),
      cap=document.getElementById('lbCap'), cnt=document.getElementById('lbCount'),
      closeB=document.getElementById('lbClose'), prevB=document.getElementById('lbPrev'),
      nextB=document.getElementById('lbNext'), i=0, opener=null;
  var focusables=[closeB,prevB,nextB];

  function show(n){{
    i=(n+links.length)%links.length;
    var a=links[i], thumb=a.querySelector('img');
    img.src=a.getAttribute('href');
    img.alt=thumb?thumb.alt:'';
    cap.textContent=a.getAttribute('data-caption')||'';
    cnt.textContent=(i+1)+' / '+links.length;
  }}
  function open(n,src){{
    opener=src; lb.hidden=false; lb.classList.add('on');
    document.body.classList.add('lb-open'); show(n); closeB.focus();
  }}
  function close(){{
    lb.classList.remove('on'); lb.hidden=true;
    document.body.classList.remove('lb-open');
    if(opener) opener.focus();
  }}
  links.forEach(function(a,n){{
    a.setAttribute('aria-haspopup','dialog');
    a.addEventListener('click',function(e){{e.preventDefault(); open(n,a);}});
  }});
  closeB.addEventListener('click',close);
  prevB.addEventListener('click',function(){{show(i-1);}});
  nextB.addEventListener('click',function(){{show(i+1);}});
  lb.addEventListener('click',function(e){{if(e.target===lb) close();}});
  document.addEventListener('keydown',function(e){{
    if(lb.hidden) return;
    if(e.key==='Escape') close();
    else if(e.key==='ArrowLeft') show(i-1);
    else if(e.key==='ArrowRight') show(i+1);
    else if(e.key==='Tab'){{ // focus trap
      var first=focusables[0], last=focusables[focusables.length-1];
      if(e.shiftKey && document.activeElement===first){{e.preventDefault(); last.focus();}}
      else if(!e.shiftKey && document.activeElement===last){{e.preventDefault(); first.focus();}}
    }}
  }});
  // swipe on touch
  var x0=null;
  lb.addEventListener('touchstart',function(e){{x0=e.touches[0].clientX;}},{{passive:true}});
  lb.addEventListener('touchend',function(e){{
    if(x0===null) return; var dx=e.changedTouches[0].clientX-x0;
    if(Math.abs(dx)>50) show(dx>0?i-1:i+1); x0=null;
  }},{{passive:true}});
}})();
</script>
</body>
</html>"""

def render(p):
    return head(p)+header(p["path"])+'<main id="main">'+p["body"]+"</main>"+footer()

# ----------------------------------------------------------------- content
FAQS = [(f["q"], f["a"]) for f in C["faqs"]]


def faq_html(pairs, first_open=True):
    out=[]
    for i,(q,a) in enumerate(pairs):
        op=" open" if (i==0 and first_open) else ""
        out.append(f"<details{op}><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>")
    return '<div class="faq">'+"".join(out)+"</div>"

_rows = "".join(
    '<div class="prow"><div><b>{s}</b></div><div class="amt grad">{p}</div>'
    '<div><small>{i}</small></div></div>'.format(
        s=html.escape(r["service"]), p=html.escape(r["price"]), i=html.escape(r["includes"]))
    for r in C["pricing"])
PRICING = ('<div class="ptable">'
  '<div class="prow hd"><div>Service</div><div>Labor</div><div>What\'s included / parts</div></div>'
  + _rows + '</div><p class="note">' + html.escape(C["pricing_note"]["text"]) + '</p>')


TESTIMONIALS = "".join(
    '<figure class="quote">'
    '<div class="stars" aria-label="Five out of five stars">&#9733;&#9733;&#9733;&#9733;&#9733;</div>'
    '<p>&ldquo;{q}&rdquo;</p><cite>{n} &mdash; {loc}</cite></figure>'.format(
        q=html.escape(t["quote"]), n=html.escape(t["name"]), loc=html.escape(t["location"]))
    for t in C["testimonials"] if not t.get("placeholder"))
GALLERY_KEYS = [k for k in C.get("gallery", {}).get("order", []) if k in I]

PAGES=[]

# ---------------- HOME
PAGES.append(dict(path="/",
 title="Custom Golf Clubs Denver | Club Repair | Chronic Clubworks",
 desc="Custom golf clubs and expert club repair in Denver. Reshafting, regripping, loft & lie adjustment and putter restoration. By appointment, 8am-5pm. Call today.",
 schemas=[biz(),crumbs("/","Home"),faq(FAQS[:4])],
 body=hero("Denver, Colorado · By appointment","Craft without","compromise.",
   "Custom clubmaking and precision repair from a Denver bench. Reshafting, regripping, loft and lie, restorations — built by people who actually play.",
   "hero")
 + f"""
<section class="pad" id="services">
  <div class="wrap">
    <div class="head"><p class="eyebrow">What we do</p>
      <h2>Five things,<br><span class="grad">done right.</span></h2>
      <p class="lede">Off-the-rack gear is built for an average golfer who doesn't exist. Everything here closes the gap between what you own and the way you actually play.</p></div>
    <div class="svc">
      <a class="card" href="/golf-club-repair-denver#reshafting-regripping">
        <span class="num grad">01 — Most requested</span><h3>Reshafting &amp; Regripping</h3>
        <p>Your grips and shafts are the engine of the club. If the driver feels weak, the irons feel dead, or the putter grip is slicker than a wet green, it's time. Premium steel and graphite, frequency matched across the set.</p>
        <span class="price">Labor from $5 · parts separate</span><span class="go">Reshafting &amp; regripping</span></a>
      <a class="card" href="/golf-club-repair-denver#custom-clubmaking">
        <span class="num grad">02 — Full build</span><h3>Custom Clubmaking</h3>
        <p>Completely custom clubs tailored to your swing, feel and style. Driver through wedge, hand-assembled with tour-level precision — shaft selection, clubhead sourcing, swing weighting and MOI matching.</p>
        <span class="price">Quoted per build</span><span class="go">Custom clubmaking</span></a>
      <a class="card" href="/golf-club-repair-denver#loft-and-lie">
        <span class="num grad">03 — Quick win</span><h3>Loft &amp; Lie Adjustments</h3>
        <p>Your irons and wedges may not be lofted and lie'd correctly, which means your ball flight is wrong before you swing. We'll fix your gapping and stop the pushes, pulls and ballooning shots.</p>
        <span class="price">$5–$12 per club</span><span class="go">Loft &amp; lie adjustments</span></a>
      <a class="card" href="/golf-club-repair-denver#repairs-restorations">
        <span class="num grad">04 — Bring it back</span><h3>Repairs &amp; Restorations</h3>
        <p>Dented wedge, cracked ferrule, a vintage putter that deserves better. Putter and wedge refinishing, re-milling and stamping, regrooving, clubhead and epoxy work. We like keeping classic clubs in play.</p>
        <span class="price">From $85</span><span class="go">Repairs &amp; restorations</span></a>
      <a class="card" href="/custom-golf-headcovers-denver">
        <span class="num grad">05 — One-off gear</span><h3>Custom Headcovers</h3>
        <p>Driver, fairway and hybrid covers made from thrifted and second-hand materials. Handmade in small runs, personalized when you want it, and built so your bag doesn't look like anyone else's.</p>
        <span class="price">Quoted per project</span><span class="go">Custom headcovers</span></a>
    </div>
  </div>
</section>

<section class="pad tinted">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Why us</p><h2>Not a counter.<br><span class="grad">A bench.</span></h2>
      <p class="lede">Chronic Clubworks started the way most good things do — a group of friends who couldn't stop tinkering. Decades of golf between us turned into a workbench, then a shop, then a habit of building clubs for anyone who asked.</p>
      <ul class="bullets">
        <li><strong>Every club is measured.</strong> Lofts, lies and swing weights get checked and recorded, not eyeballed.</li>
        <li><strong>You talk to the person building it.</strong> No intake counter, no handoff to a back room.</li>
        <li><strong>Built for Denver golf.</strong> Thin air compresses your gapping — we spec for the courses you actually play.</li>
        <li><strong>Honest advice.</strong> If a repair isn't worth the money, we'll tell you.</li>
      </ul>
    </div>
    {pic('bench_home',1200,1200)}
  </div>
</section>

<section class="pad">
  <div class="wrap">
    <div class="head"><p class="eyebrow">The work</p><h2>Recent builds &amp;<br><span class="grad">restorations.</span></h2></div>
    <div class="gal">
      {"".join(f'<a href="{FULL(k)}" data-caption="{html.escape(ALT[k])}">{pic(k,1200,1200)}</a>' for k in GALLERY_KEYS)}
    </div>
  </div>
</section>

<section class="pad tinted">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Straight answers</p><h2>What it <span class="grad">costs.</span></h2>
      <p class="lede">Most shops make you call to find out. Here are our labor rates up front — parts are your choice and priced separately.</p></div>
    {PRICING}
  </div>
</section>

<section class="pad">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Word of mouth</p><h2>What golfers <span class="grad">say.</span></h2></div>
    <div class="quotes">{TESTIMONIALS or '<p class="lede">Real customer notes are coming soon. Until then, ask us for references when you get in touch.</p>'}</div>
  </div>
</section>

<section class="pad tinted">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Before you ask</p><h2>Common <span class="grad">questions.</span></h2></div>
    {faq_html(FAQS)}
  </div>
</section>
""" + ctaband() + contact_section()))

# ---------------- SERVICES
PAGES.append(dict(path="/golf-club-repair-denver",
 title="Golf Club Repair Denver | Fitting | Chronic Clubworks",
 desc="Golf club repair Denver golfers rely on: custom clubmaking, reshafting, regripping, loft & lie adjustment and putter restoration. Labor rates listed. 8am-5pm.",
 schemas=[biz(),crumbs("/golf-club-repair-denver","Services"),
   svc("Golf Club Reshafting and Regripping","Reshafting with premium steel and graphite shafts, frequency matching, and regripping in Denver, Colorado.","reshafting-regripping",5,20),
   svc("Custom Clubmaking","Completely custom golf clubs built driver to wedge with shaft selection, MOI matching and swing weighting, in Denver, Colorado.","custom-clubmaking"),
   svc("Loft and Lie Adjustment","Iron and wedge loft and lie bending to correct gapping and ball flight, in Denver, Colorado.","loft-and-lie",5,12),
   svc("Golf Club Repairs and Putter Restoration","Putter and wedge refinishing, re-milling, stamping, clubhead and ferrule repair in Denver, Colorado.","repairs-restorations"),
   faq(FAQS)],
 body=hero("Services","Golf club repair","in Denver.",
   "Four services, one bench. Everything measured, everything quoted before we start.",
   "bench")
 + f"""
<section class="pad" id="reshafting-regripping">
  <div class="wrap split">
    <div>
      <p class="eyebrow">01 — Most requested</p>
      <h2>Reshafting &amp;<br><span class="grad">regripping.</span></h2>
      <p class="lede">Your grips and shafts are the engine of the club. If the driver feels weak, the irons feel dead, or the putter grip is slicker than a wet green, it's time for an upgrade.</p>
      <ul class="bullets">
        <li><strong>Reshafting.</strong> Premium steel or graphite installed to suit your feel and swing speed.</li>
        <li><strong>Frequency matching.</strong> No guessing — your shafts perform consistently across the set.</li>
        <li><strong>Regripping.</strong> Everything from tour-level tacky to oversized. Bring your own or we'll order.</li>
        <li><strong>Labor $5–$20 per club.</strong> Grips $6–$15, shafts $20–$60. Full-set regrip lands around $110–$250.</li>
      </ul>
      <p class="hbtns" style="margin-top:1.8em"><a class="btn" href="/contact">Book a regrip</a></p>
    </div>
    {pic('w4',1200,1200)}
  </div>
</section>

<section class="pad tinted" id="custom-clubmaking">
  <div class="wrap split">
    {pic('ball',1200,1200)}
    <div>
      <p class="eyebrow">02 — Full build</p>
      <h2>Custom<br><span class="grad">clubmaking.</span></h2>
      <p class="lede">We build completely custom clubs tailored to your swing, feel and style. From drivers to wedges, every club is hand-assembled with tour-level precision and premium materials.</p>
      <ul class="bullets">
        <li><strong>Shaft selection.</strong> The right flex, weight and profile for how you actually swing.</li>
        <li><strong>Clubhead sourcing.</strong> Forgiveness, workability, or something wild — we'll find it.</li>
        <li><strong>Swing weighting &amp; MOI matching.</strong> Consistent feel from top to bottom of the bag.</li>
        <li><strong>Ferrules, paint fill &amp; stamping.</strong> Make them unmistakably yours.</li>
      </ul>
      <p class="hbtns" style="margin-top:1.8em"><a class="btn" href="/contact">Start a build</a></p>
    </div>
  </div>
</section>

<section class="pad" id="loft-and-lie">
  <div class="wrap split">
    <div>
      <p class="eyebrow">03 — Quick win</p>
      <h2>Loft &amp; lie<br><span class="grad">adjustments.</span></h2>
      <p class="lede">Your irons and wedges might not be lofted and lie'd correctly, which means your ball flight is wrong before you even swing. We'll get them dialed in.</p>
      <ul class="bullets">
        <li><strong>Loft adjustments.</strong> Fix your gapping so you're not stuck between clubs.</li>
        <li><strong>Lie adjustments.</strong> Stop fighting hooks and slices caused by an improper setup.</li>
        <li><strong>Bending for feel.</strong> Want a softer forged club? We can bend it to improve responsiveness.</li>
        <li><strong>$5–$12 per club, all in.</strong> Measured before and after, every time.</li>
      </ul>
      <p><strong>Denver note:</strong> thin air carries the ball further than sea-level yardage charts suggest, which quietly compresses the gaps between your clubs. Getting lofts checked matters more here than almost anywhere else.</p>
      <p class="hbtns" style="margin-top:1.8em"><a class="btn" href="/contact">Get your angles checked</a></p>
    </div>
    {pic('w5',1200,1200)}
  </div>
</section>

<section class="pad tinted" id="repairs-restorations">
  <div class="wrap split">
    {pic('w1',1200,1200)}
    <div>
      <p class="eyebrow">04 — Bring it back</p>
      <h2>Repairs &amp;<br><span class="grad">restorations.</span></h2>
      <p class="lede">Dented wedge? Cracked ferrules? A vintage putter that deserves better? We love keeping classic clubs in the game.</p>
      <ul class="bullets">
        <li><strong>Putter refinishing.</strong> Deep clean, re-milling, custom stamping — from $85.</li>
        <li><strong>Wedge restoration.</strong> Re-groove, re-finish and customize your scoring tools.</li>
        <li><strong>Clubhead repairs.</strong> Epoxy work, sole grind adjustments, and making them look right again.</li>
        <li><strong>Vintage welcome.</strong> Old blades, persimmon woods, a putter handed down — bring it in.</li>
      </ul>
      <p class="hbtns" style="margin-top:1.8em"><a class="btn" href="/contact">Send us photos</a></p>
    </div>
  </div>
</section>

<section class="pad">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Straight answers</p><h2>What it <span class="grad">costs.</span></h2>
      <p class="lede">Labor rates up front. Parts are your choice and priced separately, so you always know what you're paying for.</p></div>
    {PRICING}
  </div>
</section>

<section class="pad tinted">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Before you ask</p><h2>Common <span class="grad">questions.</span></h2></div>
    {faq_html(FAQS)}
  </div>
</section>
""" + ctaband()))

# ---------------- HEADCOVERS
HEADCOVER_FAQS = [
  ("What headcovers can you make?", "We build custom driver, fairway wood and hybrid headcovers. Matching sets are available, and every project is quoted before we start."),
  ("Can I personalize a headcover?", "Yes. We can work in initials, numbers, patches, color direction, team-inspired details or a personal reference, depending on the materials and design."),
  ("What materials do you use?", "Most covers start with thrifted or second-hand materials: denim, canvas, jackets, athletic fabric, old garments and found textiles that deserve another round."),
  ("How much does a custom golf headcover cost?", "Headcovers are quoted per project because materials, personalization and set size change the build. Send us your idea and we'll give you a firm number."),
]

PAGES.append(dict(path="/custom-golf-headcovers-denver",
 title="Custom Golf Headcovers Denver | Chronic Clubworks",
 desc="Custom golf headcovers handmade in Denver from thrifted and second-hand materials. Driver, fairway and hybrid covers, one-off designs and personalization quoted per project.",
 schemas=[biz(),crumbs("/custom-golf-headcovers-denver","Custom Headcovers"),
   svc_page("Custom Golf Headcovers",
     "Handmade custom golf headcovers in Denver for drivers, fairway woods and hybrids, built from thrifted and second-hand materials with one-off designs and personalization.",
     "/custom-golf-headcovers-denver"),
   faq(HEADCOVER_FAQS)],
 body=hero("Custom headcovers","One-off covers","for your bag.",
   "Driver, fairway and hybrid headcovers handmade in Denver from thrifted and second-hand materials. Built one at a time, quoted before we start, and designed to make your bag look like yours.",
   "headcover_hero")
 + f"""
<section class="pad">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Uniqueness</p>
      <h2>No rack copies.<br><span class="grad">No twins.</span></h2>
      <p class="lede">Every custom headcover starts with a different material, a different story and a different golfer. We can build driver, fairway and hybrid sizes from the same design language, but the finished piece stays one of one.</p>
      <ul class="bullets">
        <li><strong>Built around your bag.</strong> Match a color story, break it on purpose, or make one club impossible to miss.</li>
        <li><strong>One-off by nature.</strong> Thrifted and second-hand materials bring texture, wear and details that new fabric usually can't fake.</li>
        <li><strong>Sets when you want them.</strong> Driver, fairway and hybrid covers can share a theme without becoming identical.</li>
      </ul>
    </div>
    <a class="lightbox" href="{FULL('headcover_driver')}" data-caption="{html.escape(ALT['headcover_driver'])}">
      {pic('headcover_driver',1200,1200)}
    </a>
  </div>
</section>

<section class="pad tinted">
  <div class="wrap split">
    <a class="lightbox" href="{FULL('headcover_fairway')}" data-caption="{html.escape(ALT['headcover_fairway'])}">
      {pic('headcover_fairway',1200,1200)}
    </a>
    <div>
      <p class="eyebrow">Craftsmanship</p>
      <h2>Soft goods with<br><span class="grad">bench standards.</span></h2>
      <p class="lede">The same Chronic Clubworks attitude applies here: measure it, fit it, finish it cleanly, and make sure it works in the real world. A headcover should look wild without feeling flimsy.</p>
      <ul class="bullets">
        <li><strong>Made to fit the club.</strong> Driver, fairway and hybrid covers are sized around the club they need to protect.</li>
        <li><strong>Structure matters.</strong> We care about shape, opening, lining, durability and how it comes on and off during a round.</li>
        <li><strong>Finished by hand.</strong> Stitching, seams, patches and details are part of the build, not decoration slapped on at the end.</li>
      </ul>
    </div>
  </div>
</section>

<section class="pad">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Personalization</p>
      <h2>Old material.<br><span class="grad">New meaning.</span></h2>
      <p class="lede">The best builds come from something with a little history: denim, canvas, jackets, jerseys, patches, pockets, colors, logos or a piece you already care about.</p>
      <ul class="bullets">
        <li><strong>Repurpose something real.</strong> Bring a thrift find or a personal piece and we'll work it into the cover if the material fits the job.</li>
        <li><strong>Make it yours.</strong> Initials, numbers, team colors, patches, inside jokes and weird little details are all welcome.</li>
        <li><strong>Quoted before we cut.</strong> You get a clear direction and price before anything old becomes something new.</li>
      </ul>
    </div>
    <a class="lightbox" href="{FULL('headcover_hero')}" data-caption="{html.escape(ALT['headcover_hero'])}">
      {pic('headcover_hero',1200,1200)}
    </a>
  </div>
</section>

<section class="pad">
  <div class="wrap">
    <div class="head"><p class="eyebrow">How it works</p>
      <h2>From idea to<br><span class="grad">first tee.</span></h2></div>
    <div class="svc">
      <div class="card"><span class="num grad">01</span><h3>Send the idea</h3>
        <p>Tell us the club type, colors, theme, personalization and whether you want one cover or a matching set.</p></div>
      <div class="card"><span class="num grad">02</span><h3>We source the look</h3>
        <p>We pull from thrifted and second-hand materials, then sketch a direction around the fabric, texture and details available.</p></div>
      <div class="card"><span class="num grad">03</span><h3>You approve the quote</h3>
        <p>Because every cover is different, every project is quoted. Nothing gets cut or built until the direction and price are clear.</p></div>
      <div class="card"><span class="num grad">04</span><h3>We build it</h3>
        <p>The finished cover is made to protect the club, fit the bag and feel like something you couldn't pull off a rack.</p></div>
    </div>
  </div>
</section>

<section class="pad tinted">
  <div class="wrap cgrid">
    <div>
      <p class="eyebrow">Pricing</p>
      <h2>Quoted per<br><span class="grad">project.</span></h2>
      <p class="lede">A single hybrid cover, a driver statement piece and a matching three-cover set are different jobs. Send the idea and we'll price the build around material, detail and personalization.</p>
      <ul class="facts">
        <li><b>Types</b><span>Driver, fairway and hybrid</span></li>
        <li><b>Materials</b><span>Thrifted and second-hand textiles</span></li>
        <li><b>Designs</b><span>One-off builds and matching sets</span></li>
        <li><b>Price</b><span>Quoted before work begins</span></li>
      </ul>
    </div>
    {form()}
  </div>
</section>

<section class="pad">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Before you ask</p><h2>Headcover <span class="grad">questions.</span></h2></div>
    {faq_html(HEADCOVER_FAQS)}
  </div>
</section>
""" + ctaband()))

# ---------------- ABOUT
PAGES.append(dict(path="/custom-golf-clubs-about",
 title="Denver Custom Clubmakers | Chronic Clubworks",
 desc="Chronic Clubworks is a Denver custom clubmaker and golf club repair shop built by lifelong golfers. By appointment, serving Denver and the Front Range.",
 schemas=[biz(),crumbs("/custom-golf-clubs-about","About"),
   {"@context":"https://schema.org","@type":"AboutPage","name":"About Chronic Clubworks",
    "url":D+"/custom-golf-clubs-about","mainEntity":{"@id":D+"/#business"}}],
 body=hero("About","Just a bunch of dudes","who love golf.",
   "A brotherhood of golf obsessives with decades of camaraderie, competition and tinkering behind them.",
   "shop")
 + f"""
<section class="pad">
  <div class="wrap split">
    <div>
      <p class="eyebrow">The story</p><h2>How we <span class="grad">got here.</span></h2>
      <p class="lede">Chronic Clubworks started the way most good things do — a group of friends who couldn't stop tinkering.</p>
      <p>Decades of camaraderie, competition and a shared love for golf turned into a workbench, then a shop, then a habit of building clubs for anyone who asked. What began as fixing each other's gear became something people started paying us for.</p>
      <p>We're not just slapping grips and gluing heads. We're <strong>artists, tinkerers and golf junkies</strong> who know the right setup can turn a hack into a hero. Between us there's over 150 combined years behind the bench, and we work with golfers at every level — from people breaking 100 for the first time to players who know their exact swing weight.</p>
    </div>
    {pic('w6',1200,1200)}
  </div>
</section>

<section class="pad tinted">
  <div class="wrap">
    <div class="head"><p class="eyebrow">How we work</p><h2>What you can <span class="grad">expect.</span></h2></div>
    <div class="svc">
      <div class="card"><span class="num grad">01</span><h3>We measure everything</h3>
        <p>Lofts, lies and swing weights get checked and recorded before and after — not eyeballed. You get the numbers.</p></div>
      <div class="card"><span class="num grad">02</span><h3>You talk to the builder</h3>
        <p>No intake counter, no handoff to a back room. The person who quotes your job is the person who does it.</p></div>
      <div class="card"><span class="num grad">03</span><h3>Quoted before we start</h3>
        <p>Send photos, get a firm number and a timeline. Nothing gets ordered or altered until you've said yes.</p></div>
      <div class="card"><span class="num grad">04</span><h3>Honest advice</h3>
        <p>If a repair costs more than the club is worth, we'll say so. We'd rather lose the job than sell you something pointless.</p></div>
    </div>
  </div>
</section>

<section class="pad tinted">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Credentials</p>
      <h2>Distinguished <span class="grad">Clubmaker.</span></h2>
      <p class="lede">Paul Cohn holds the Golfsmith Distinguished Clubmaker Award, presented in recognition of his contribution to golf clubfitting and clubmaking.</p>
      <p>It's a small thing to hang on a wall and a big thing to have behind your bag. Clubmaking isn't licensed — anyone can pull a shaft and call it a service. Formal recognition from Golfsmith, one of the industry's original clubmaking institutions, means the work has been measured against a real standard.</p>
      <p class="hbtns" style="margin-top:1.6em"><a class="btn" href="/contact">Talk to us about a build</a></p>
    </div>
    <figure class="certfig">
      <a class="lightbox" href="/assets/img/cert-full.jpg"
         data-caption="Golfsmith Distinguished Clubmaker Award presented to Paul Cohn, 2002">
        {pic('cert',1000,750)}
      </a>
      <figcaption>Golfsmith Distinguished Clubmaker Award &mdash; Paul Cohn, 2002. Click to enlarge.</figcaption>
    </figure>
  </div>
</section>

<section class="pad">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Where we are</p><h2>Denver <span class="grad">born.</span></h2>
      <p class="lede">We work out of the Denver metro by appointment, serving {", ".join(AREAS)} and the wider Front Range.</p>
      <p>Golf at altitude is its own thing. The ball carries further than any sea-level yardage chart suggests, which quietly compresses the gaps between your clubs and makes proper gapping matter more here than almost anywhere else. We build and spec for the courses you actually play.</p>
      <ul class="facts">
        <li><b>Phone</b><a href="tel:{TEL_E}">{TEL_D}</a></li>
        <li><b>Email</b><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li><b>Hours</b><span>{HOURS}, by appointment</span></li>
        <li><b>Instagram</b><a href="{IG}" rel="noopener">@tc_clubworks</a></li>
      </ul>
    </div>
    {pic('w2',1200,1200)}
  </div>
</section>
""" + ctaband()))

# ---------------- CONTACT
PAGES.append(dict(path="/contact",
 title="Contact | Golf Club Repair Denver | Chronic Clubworks",
 desc="Contact Chronic Clubworks for custom golf clubs and club repair in Denver. Call (720) 854-4132, email info@tcclubworks.io, or send us photos of your clubs.",
 schemas=[biz(),crumbs("/contact","Contact"),
   {"@context":"https://schema.org","@type":"ContactPage","name":"Contact Chronic Clubworks",
    "url":D+"/contact","mainEntity":{"@id":D+"/#business"}}],
 body=f"""
<section class="pad" style="padding-top:clamp(56px,8vw,96px)">
  <div class="wrap cgrid">
    <div>
      <p class="eyebrow">Get in touch</p>
      <h1 style="font-size:clamp(2.2rem,5vw,3.6rem)">Tell us about<br><span class="grad">your clubs.</span></h1>
      <p class="lede">Send a note with what you're playing and what isn't working. If photos would help, text or email them after you submit and we'll match them to your inquiry.</p>
      <ul class="facts">
        <li><b>Phone</b><a href="tel:{TEL_E}">{TEL_D}</a></li>
        <li><b>Email</b><a href="mailto:{EMAIL}">{EMAIL}</a></li>
        <li><b>Location</b><span>Denver, CO — by appointment</span></li>
        <li><b>Hours</b><span>{HOURS}</span></li>
        <li><b>Service area</b><span>{", ".join(AREAS)} and the Front Range</span></li>
        <li><b>Instagram</b><a href="{IG}" rel="noopener">@tc_clubworks</a></li>
      </ul>
      <p class="note">Prefer to talk it through? Call or text — that's usually fastest.</p>
    </div>
    {form()}
  </div>
</section>

<section class="pad tinted">
  <div class="wrap">
    <div class="head"><p class="eyebrow">Before you ask</p><h2>Common <span class="grad">questions.</span></h2></div>
    {faq_html(FAQS, first_open=False)}
  </div>
</section>
"""))

# ---------------- THANKS (Netlify form redirect target)
PAGES.append(dict(path="/thanks",
 title="Thanks — we'll be in touch | Chronic Clubworks",
 desc="Your message reached Chronic Clubworks in Denver. We read everything and reply within one business day. For anything urgent, call or text (720) 854-4132.",
 schemas=[biz()], noindex=True,
 body=f"""
<section class="pad" style="min-height:56vh;display:flex;align-items:center">
  <div class="wrap" style="max-width:720px;text-align:center">
    <p class="eyebrow" style="justify-content:center">Message sent</p>
    <h1 style="font-size:clamp(2.2rem,5vw,3.6rem)">Thanks — we'll<br><span class="grad">be in touch.</span></h1>
    <p class="lede" style="margin-inline:auto">We read everything and reply within a business day. If it's urgent, call or text {TEL_D} and you'll get us faster.</p>
    <div class="hbtns" style="justify-content:center">
      <a class="btn lg" href="/">Back to home</a>
      <a class="btn ghost lg" href="tel:{TEL_E}">Call {TEL_D}</a>
    </div>
  </div>
</section>"""))

# ----------------------------------------------------------------- write
def w(rel, s):
    f=os.path.join(OUT,rel); os.makedirs(os.path.dirname(f),exist_ok=True)
    open(f,"w",encoding="utf-8").write(s)

for p in PAGES:
    h = render(p)
    if p.get("noindex"):
        h = h.replace('<meta name="theme-color"', '<meta name="robots" content="noindex,follow">\n<meta name="theme-color"')
    w("index.html" if p["path"]=="/" else p["path"].strip("/")+"/index.html", h)

w("404.html", head({"path":"/404","title":"Page not found | Chronic Clubworks",
  "desc":"That page doesn't exist. Find custom golf clubs and club repair in Denver.","schemas":[]})
  + header("") + f"""<main id="main"><section class="pad" style="min-height:56vh;display:flex;align-items:center">
  <div class="wrap" style="max-width:720px">
    <p class="eyebrow">404</p>
    <h1 style="font-size:clamp(2.2rem,5vw,3.6rem)">That page <span class="grad">doesn't exist.</span></h1>
    <p class="lede">It moved, or it never did. Here's where to go instead:</p>
    <ul class="bullets">
      <li><strong><a href="/golf-club-repair-denver">All services</a></strong> — repair, fitting and pricing</li>
      <li><strong><a href="/custom-golf-clubs-about">About</a></strong> — who we are</li>
      <li><strong><a href="/contact">Contact</a></strong> — get a quote</li>
    </ul>
  </div></section></main>""" + footer())

INDEXED=[p for p in PAGES if not p.get("noindex")]
w("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + "".join(f'  <url><loc>{D}{"/" if p["path"]=="/" else p["path"]}</loc><changefreq>monthly</changefreq>'
            f'<priority>{"1.0" if p["path"]=="/" else "0.8"}</priority></url>\n' for p in INDEXED)
  + "</urlset>\n")

w("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /thanks\n\nSitemap: {D}/sitemap.xml\n")

REDIR=[("/services","/golf-club-repair-denver"),
 ("/custom-clubmaking","/golf-club-repair-denver#custom-clubmaking"),
 ("/custom-clubmaking-denver","/golf-club-repair-denver#custom-clubmaking"),
 ("/reshafting-and-regripping","/golf-club-repair-denver#reshafting-regripping"),
 ("/golf-club-reshafting-denver","/golf-club-repair-denver#reshafting-regripping"),
 ("/loft-and-lie-adjustments","/golf-club-repair-denver#loft-and-lie"),
 ("/loft-and-lie-adjustment-denver","/golf-club-repair-denver#loft-and-lie"),
 ("/repairs-and-restorations","/golf-club-repair-denver#repairs-restorations"),
 ("/vintage-golf-club-refinishing","/golf-club-repair-denver#repairs-restorations"),
 ("/about","/custom-golf-clubs-about"),("/page","/"),
 ("/headcovers","/custom-golf-headcovers-denver"),
 ("/custom-headcovers","/custom-golf-headcovers-denver"),
 ("/golf-headcovers","/custom-golf-headcovers-denver"),
 ("/club-reshaft","/golf-club-repair-denver#reshafting-regripping"),
 ("/club-regrip","/golf-club-repair-denver#reshafting-regripping"),
 ("/loft-adjustment","/golf-club-repair-denver#loft-and-lie"),
 ("/lie-adjustment","/golf-club-repair-denver#loft-and-lie"),
 ("/custom-paint","/golf-club-repair-denver#custom-clubmaking")]
w("_redirects","".join(f"{o}  {n}  301!\n" for o,n in REDIR))

w("netlify.toml", """[build]
  command = "python3 build.py"
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "SAMEORIGIN"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=3600, must-revalidate"
""")

print(f"built {len(PAGES)} pages (+404) | {len(INDEXED)} indexed | {len(REDIR)} redirects")
