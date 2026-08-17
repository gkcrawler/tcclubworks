# Editing your website

Everything you'll normally want to change lives in **one file: `content.toml`**.

Change it, save, and the site republishes itself in about a minute. You never
touch Netlify again.

---

## One-time setup (about 30 minutes, you only do this once)

### 1. Put the site on GitHub

1. Go to [github.com](https://github.com) and create a free account if you don't have one
2. Click **+** (top right) → **New repository**
3. Name it `tcclubworks`, choose **Private**, click **Create repository**
4. On the next screen click **uploading an existing file**
5. Drag in **everything** from this folder — all the files and folders together
6. Scroll down, click **Commit changes**

### 2. Point Netlify at it

1. Netlify → your site → **Site configuration** → **Build & deploy**
2. Under *Continuous deployment*, click **Link repository**
3. Choose **GitHub**, authorize it, pick your `tcclubworks` repo
4. Netlify reads the settings from `netlify.toml` automatically. Confirm it shows:
   - Build command: `python3 build.py`
   - Publish directory: `.`
5. Click **Deploy**

That's it. From now on, every change you save on GitHub publishes automatically.

> **Your form keeps working.** Netlify re-scans for forms on every deploy, and
> your notification settings for `info@` and `paul@` stay as they are.

---

## Making an edit (about 30 seconds)

1. Go to your repo on GitHub
2. Click **`content.toml`**
3. Click the **pencil icon** (top right of the file)
4. Change what you need
5. Scroll down, click **Commit changes**

Netlify starts building immediately. Refresh your site in a minute and it's live.

---

## The three rules

1. **Only change text inside the `"quote marks"`.**
2. **Never delete a quote mark, a bracket `[ ]`, or an equals sign.**
3. **Lines starting with `#` are notes to you.** They're ignored — edit or ignore them freely.

Indentation doesn't matter in this file. Extra spaces are harmless.

### If you make a mistake

**Nothing breaks.** If the file has an error, the build fails and **your live
site stays exactly as it was**. Netlify emails you that the deploy failed. Fix
the typo, commit again, and it publishes.

You cannot take the site down by mistyping this file. Worst case, your change
just doesn't appear yet.

---

## Common edits

### Change a price

Find the `[[pricing]]` block for that service, change the `price` line:

```toml
[[pricing]]
service  = "Regripping"
price    = "$5–$10"          ← change this
includes = "Per club, labor only..."
```

### Add a testimonial

Find the testimonials section. Change a placeholder into a real one:

```toml
[[testimonials]]
quote       = "Paul rebuilt my whole set and it's a different game."
name        = "J. Marsh"
location    = "Arvada, CO"
placeholder = false          ← false removes the greyed-out styling
```

To add a fourth, copy an entire `[[testimonials]]` block and paste it below.

### Add an FAQ

Copy a `[[faqs]]` block and change the two lines. These also get sent to Google
as structured data, which can earn you extra space in search results — so real
questions customers actually ask are worth adding.

### Swap a photo

1. In GitHub, open the `assets/img` folder → **Add file** → **Upload files**
2. Upload your image
3. In `content.toml`, point the right entry at it and update the description:

```toml
[photos.hero]
file = "/assets/img/my-new-photo.jpg"
alt  = "Describe what's actually in the picture"
```

**Crop before uploading:**

| Photo | Shape | Size |
|---|---|---|
| `hero`, `bench`, `shop` | tall portrait 4:5 | ~1200 × 1500 |
| everything else | square 1:1 | ~1200 × 1200 |

Keep files under about 400 KB. Export JPEG at 78–82% quality.

**`alt` is not optional.** It's what a blind visitor hears and what Google reads
to understand the image. Describe the photo plainly — no need to write "photo of".

### Change your phone number or hours

The `[contact]` block at the top. Change it once and it updates in the header,
footer, contact page, and the business data Google reads — 40-odd places.

---

## Replacing the logo

The logo is `assets/logo-v2.svg`. Upload a replacement with **exactly that filename**
and it swaps everywhere — header, footer, and the business data Google reads.

If you replace it and still see the old one after a few minutes, that's your browser
holding a cached copy. Hard-refresh (**Cmd/Ctrl + Shift + R**). Assets refresh within
an hour for everyone else.

---

## What is *not* in content.toml

Page copy — headlines, service descriptions, the About story — lives in
`build.py`. It's editable but it's Python, so a mistake there is easier to make.
Ask me before changing it, or change it and let the failed build tell you.

---

## Checking a build

Netlify → **Deploys**. Green means published. Red means the build failed and
your old site is still live — click the failed deploy to see the error.

Most errors are a missing quote mark. The message will name the line number.
