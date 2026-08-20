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
    if TAG_ID in html or should_skip(path):
        return False
    marker = "</head>"
    if marker not in html:
        return False
    html = html.replace(marker, TAG + marker, 1)
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
