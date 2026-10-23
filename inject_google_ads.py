#!/usr/bin/env python3
"""Inject the Google Ads tag into generated public HTML pages."""
from pathlib import Path

TAG_ID = "AW-18288494011"
TAG = f"""<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id={TAG_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', '{TAG_ID}');
</script>
"""

SKIP_PARTS = {
    "/admin/",
    "/quote-approval/",
}


def should_skip(path: Path) -> bool:
    normalized = "/" + path.as_posix()
    return any(part in normalized for part in SKIP_PARTS)


def inject(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    if should_skip(path):
        return False
    marker = "</head>"
    if marker not in html:
        return False
    original = html
    if TAG_ID not in html:
        html = html.replace(marker, TAG + marker, 1)
    tracking = '<script defer src="/assets/inquiry-conversion.js?v=1"></script>'
    if 'inquiry-conversion.js' not in html and (
        'name="quote"' in html or path.as_posix().endswith('thanks/index.html')
    ):
        html = html.replace(marker, tracking + "\n" + marker, 1)
    if html == original:
        return False
    path.write_text(html, encoding="utf-8")
    return True


def main() -> None:
    changed = 0
    for path in Path(".").rglob("*.html"):
        if inject(path):
            changed += 1
    print(f"injected Google Ads tag into {changed} pages")


if __name__ == "__main__":
    main()
