# Chronic Clubworks — Netlify site

Four pages, no framework, and a tiny Python build step that turns `content.toml`
into static HTML. One stylesheet, zero JavaScript dependencies, and the SEO basics
are generated consistently from the same source content.

## Deploy

1. Put the folder contents in the GitHub repo connected to Netlify
2. Netlify reads `netlify.toml` automatically
3. Confirm the build command is `python3 build.py`
4. Confirm the publish directory is `.`
5. Point `tcclubworks.io` at the site in **Domain management**

Manual drag-and-drop deploys still work after running `python3 build.py` locally first.

## Set the form recipients (do this right after the first deploy)

The contact form uses **Netlify Forms** — no third-party service, no API key.

1. Deploy first. Netlify only detects a form after it sees the HTML.
2. Netlify dashboard → **Forms** → you'll see a form called **quote**
3. **Form notifications → Add notification → Email notification**
4. Enter `info@tcclubworks.io`, save
5. **Add notification** again for `paul@tcclubworks.io`

Both addresses now get every submission, and every submission is also stored in the
dashboard as a backup. Free tier covers 100 submissions/month.

Submissions redirect to `/thanks`, which is `noindex` so it never shows up in search.

## Pages

| URL | Purpose |
|---|---|
| `/` | Home — hero, services, why-us, gallery, pricing, testimonials, FAQ, contact |
| `/golf-club-repair-denver` | Services — four deep sections with anchors, pricing table, FAQ |
| `/custom-golf-headcovers-denver` | Custom headcovers — driver, fairway and hybrid covers, process, pricing, FAQ |
| `/custom-golf-clubs-about` | About — story, how-we-work, Denver/altitude angle |
| `/contact` | Contact — form, details, FAQ |
| `/thanks` | Form success page (noindex) |
| `/404.html` | Custom not-found |

Service anchors: `#reshafting-regripping`, `#custom-clubmaking`, `#loft-and-lie`,
`#repairs-restorations`. Headcover short URLs `/headcovers`, `/custom-headcovers`
and `/golf-headcovers` redirect to `/custom-golf-headcovers-denver`.

## Redirects

`_redirects` sends **16 legacy URLs** to their new homes with 301s — every Hostinger
Website Builder URL you've ever published, including the five placeholder store products
and the service pages that were consolidated into `/golf-club-repair-denver`. The `301!`
force flag makes them apply even if a matching file exists.

## Editing content

Everything is generated from `build.py`. Don't hand-edit the HTML.

```bash
python3 build.py     # regenerates all pages
```

Common edits, all at the top of the file:

- Phone: `TEL_D` (display) and `TEL_E` (tel: link)
- Email: `EMAIL`
- Service area: `AREAS`
- Pricing: the `PRICING` block
- FAQ: the `FAQS` list — it feeds both the visible accordions and the FAQ schema
- Testimonials: search for `class="quote ph"` — two placeholders waiting on real quotes

CSS lives in `assets/style.css` and is shared by every page.

## What's already handled

- Unique title (≤60 chars) and meta description (120–160) on every page
- Exactly one H1 per page, correct heading hierarchy
- `LocalBusiness` schema sitewide with phone, 8am–5pm hours, and all seven service cities
- `Service` schema ×4 with price ranges, `FAQPage`, `BreadcrumbList`, `AboutPage`, `ContactPage`
- Self-referencing canonicals, Open Graph, Twitter cards, 1200×630 social image
- Favicons (32px, 180px Apple touch) generated from your logo
- Alt text on every image
- Your real logo, trimmed and served at 1x/2x
- Responsive to 390px, keyboard accessible, skip link, WCAG-checked contrast
- `sitemap.xml`, `robots.txt` (with `/thanks` disallowed)
- Security headers and a 1-year immutable cache on `/assets/*` via `netlify.toml`

## Two things worth doing soon

**1. Replace the remaining placeholder content.** The site now self-hosts its images,
but the testimonial section still needs real customer quotes as they come in.

**2. Google Business Profile.** Still the highest-value item on the whole list and the
one thing I can't do for you. The site now has a real phone, real hours and a defined
service area, so everything the profile needs to match already exists.

## Then

- Verify the domain in Google Search Console and submit `sitemap.xml`
- Watch the 16 redirects resolve and the old URLs retire
- Send me two real testimonials to replace the dashed placeholders
- Consider a `/blog/` — the regripping-cost and golf-at-altitude articles are where new
  traffic actually comes from

---

# Common changes

## Change the photo on the home page

All images are defined in **one place** — the `I` dictionary near the top of `build.py`
(around line 13). Each entry is a name and a URL.

**Option A — use your own file (recommended).**

1. Drop your photo into `assets/img/` (create the folder if needed), e.g. `assets/img/hero.jpg`
2. In `build.py`, change the `hero` line to:
   ```python
   "hero": "/assets/img/hero.jpg",
   ```
3. Update the matching description in the `ALT` dictionary right below — this is the text
   screen readers announce and what Google reads:
   ```python
   "hero":"Custom iron set on the Chronic Clubworks bench in Denver",
   ```
4. Run `python3 build.py` and redeploy.

The hero image displays in a 4:5 portrait frame, so **shoot or crop it taller than it is
wide**. Around 1200×1500px is ideal. Anything wider gets cropped to the centre.

**Which name is which:**

| Key | Where it appears |
|---|---|
| `hero` | Big photo on the home page hero |
| `bench` | "Not a counter. A bench." section + Services hero |
| `ball` | Custom clubmaking section |
| `shop` | About page hero |
| `w1`–`w7` | The work gallery |

## Change the header logo

The logo is `assets/logo-v2.svg`, used in the header and footer of every page.

- **Same logo, new file:** replace `assets/logo-v2.svg`, keeping the filename. Done.
- **Different filename or format:** search `build.py` for `logo-v2.svg` and update the three
  places it appears (header, footer, and the `logo` field in the schema).
- **Resize it:** it's CSS, not the file. In `assets/style.css`:
  ```css
  .logo img{width:168px}        /* header  */
  footer .logo img{width:190px} /* footer  */
  ```

If you swap the logo, regenerate the favicons and social card to match — they were
generated from the current one and will otherwise be out of date.


## Every image slot on the site

Same `I` dictionary in `build.py` controls all of them. Change the URL, change the matching
`ALT` line, run `python3 build.py`, redeploy.

| Key | Page | Where on the page | Shape needed |
|---|---|---|---|
| `hero` | Home | Main hero photo | **4:5 portrait** |
| `bench` | Home | "Not a counter. A bench." | **1:1 square** |
| `bench` | Services | Hero photo *(same image, two places)* | 4:5 portrait |
| `w4` | Services | Reshafting & Regripping section | 1:1 square |
| `ball` | Services | Custom Clubmaking section | 1:1 square |
| `w5` | Services | Loft & Lie section | 1:1 square |
| `w1` | Services | Repairs & Restorations section | 1:1 square |
| `shop` | About | Hero photo | **4:5 portrait** |
| `w6` | About | "How we got here" | 1:1 square |
| `w2` | About | "Denver born" | 1:1 square |
| `w1 w3 w4 w5 w6 w7 ball` | Home | The work gallery | 1:1 square |
| `headcover_hero` | Headcovers | Hero + hybrid card | 1:1 square |
| `headcover_driver` | Headcovers | Driver card | 1:1 square |
| `headcover_fairway` | Headcovers | Fairway card + materials section | 1:1 square |
| — | Contact | *(no photos)* | — |

**Note that several images do double duty.** `bench` is both the Services hero and a home
page section; `w1`, `w4`, `w5` and `w6` each appear in the gallery *and* in a section.
Change one and it updates everywhere it appears — usually what you want, but worth knowing.

### Sizes to export

| Shape | Export at | Used for |
|---|---|---|
| 4:5 portrait | 1200 × 1500 | All three page heroes |
| 1:1 square | 1200 × 1200 | Section photos and gallery |

Shoot a little wider than you need — the CSS crops to centre, so leave breathing room
around the subject. Keep files under about 400 KB; export JPEG at quality 78–82.

### The three worth replacing first

`bench`, `ball` and `shop` are the AI-generated images from the original site. They're the
weakest thing on the site now — they read as generic, and Google favours original
photography. Real shots of your bench, a club mid-build, and your actual workspace would
be the single biggest visual upgrade available, and they'd also get you off Hostinger's CDN.

### Faster option

Upload photos to Google Drive and tell me which slot each belongs in. I'll crop, compress,
generate WebP versions, write accurate alt text, self-host them, and hand back a built site.

## Change the gallery photos

Same `I` dictionary — keys `w1` through `w7`, plus `ball`. Add more by adding entries to
both `I` and `ALT`, then adding the key to the list in the gallery section of the home
page. The lightbox picks them up automatically.
## Quote builder parts catalog

The admin quote builder loads parts from `assets/parts-catalog.csv`.

Columns:

`sku, category, brand, name, description, cost, quote_price, url, notes`

Use `quote_price` for the price that should land on a customer quote. Leave it
as `0` when you want to add the item but fill the price manually.
