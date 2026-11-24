"""Launch safeguards and generated store output; no calls to a live payment API."""
import copy
import re
import shutil
import subprocess
import tempfile
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from inject_google_ads import inject
from storefront import load_config, validate_config, page, REQUIRED_CHECKS


class StorefrontTests(unittest.TestCase):
    def setUp(self):
        self.config = load_config()
        self.config["store"]["mode"] = "preview"

    def live_config(self):
        config = copy.deepcopy(self.config)
        config['store'].update(mode='live', domain='ccw-test.myshopify.com', dispatch_time='Ships within 3 business days.')
        config['launch'] = dict.fromkeys(REQUIRED_CHECKS, True)
        for p in config['products']:
            p.update(merchant_approved=True)
        return config

    def test_launch_requires_verified_domain(self):
        for domain in ('', 'evil.test', 'ccw.myshopify.com.evil.test', 'ccw.myshopify.com/path', 'https://ccw.myshopify.com'):
            with self.subTest(domain=domain):
                config=self.live_config(); config['store']['domain']=domain
                with self.assertRaises(ValueError): validate_config(config)

    def test_each_unfinished_launch_check_blocks_live_build(self):
        for check in REQUIRED_CHECKS:
            with self.subTest(check=check):
                config=self.live_config(); config['launch'][check]=False
                with self.assertRaisesRegex(ValueError, check): validate_config(config)

    def test_missing_shipping_timing_blocks_live_build(self):
        for timing in ('dispatch_time', 'delivery_time'):
            with self.subTest(timing=timing):
                config=self.live_config(); config['store'][timing]=''
                with self.assertRaisesRegex(ValueError, timing): validate_config(config)

    def test_unapproved_product_blocks_launch(self):
        config=self.live_config(); config['products'][0]['merchant_approved']=False
        with self.assertRaisesRegex(ValueError, 'Product review'): validate_config(config)

    def test_draft_never_loads_checkout_provider(self):
        result=page(self.config)
        self.assertTrue(result['noindex'])
        self.assertFalse(result['tracking'])
        self.assertNotIn('cdn.shopify.com', result['extra_head'])
        self.assertNotIn('<shopify-cart', result['body'])
        self.assertIn('Checkout opens at launch', result['body'])
        self.assertIn('id="preview-cart"', result['body'])

    def test_live_price_and_inventory_are_not_draft_values(self):
        config=self.live_config(); validate_config(config)
        result=page(config)
        self.assertNotIn('id="preview-cart"', result['body'])
        self.assertIn('<shopify-cart', result['body'])
        self.assertIn('product.selectedOrFirstAvailableVariant.price', result['body'])
        self.assertIn('query="product.selectedOrFirstAvailableVariant.availableForSale"', result['body'])
        self.assertIn('data-live-add disabled', result['body'])
        self.assertNotIn('shopify-attr--', result['body'])
        self.assertNotIn('$100.00', result['body'])
        self.assertIn('"products": []', result['body'])

    def test_product_text_cannot_close_script_or_inject_html(self):
        self.config['products'][0]['title']='<script>alert(1)</script>'
        result=page(self.config)['body']
        self.assertNotIn('<script>alert(1)', result)
        self.assertIn('\\u003cscript>', result)

    def test_distinct_shop_collections_share_cart_and_checkout(self):
        config = self.live_config()
        main = page(config)
        partner = page(config, destination="partner")
        members = page(config, destination="members")
        self.assertEqual(main['path'], '/shop')
        self.assertEqual(partner['path'], '/pins-and-aces')
        self.assertEqual(members['path'], '/members-only')
        self.assertIn('href="/members-only" aria-current="page"', members['body'])
        self.assertIn('made to order', members['body'])
        for group in ('Apparel', 'Hats'):
            self.assertIn(f'data-member-group="{group}"', members['body'])
            self.assertIn(f'<h2 id="members-{group.lower()}">{group}</h2>', members['body'])
        for result, key in ((main, 'collection'), (partner, 'partner_collection'), (members, 'members_collection')):
            self.assertIn(f'handle="{config["store"][key]}" id="shop-collection"', result['body'])
            self.assertIn('id="shop-cart"', result['body'])
            self.assertIn('id="shop-product-detail"', result['body'])
        self.assertIn('data-filter="Hats"', main['body'])
        self.assertIn('data-filter="Ball Markers"', main['body'])
        self.assertIn('data-filter="Headcovers"', main['body'])
        self.assertNotIn('data-filter="Apparel"', main['body'])
        self.assertNotIn('data-filter=', partner['body'])
        self.assertNotIn('id="ccw-denver-ball-marker"', partner['body'])
        self.assertIn('>Pins and Aces Platinum Partner</h1>', partner['body'])

    def test_retail_pause_and_reopen(self):
        routes = ('shop', 'members-only', 'pins-and-aces', 'shop-policies', 'shop-privacy', 'shop-terms')
        with tempfile.TemporaryDirectory() as temp:
            site = Path(temp)
            for name in ('build.py', 'storefront.py', 'content.toml'):
                shutil.copyfile(ROOT / name, site / name)
            for name in ('assets', 'templates'):
                (site / name).symlink_to(ROOT / name, target_is_directory=True)
            config = (ROOT / 'shop.toml').read_text()
            for paused in (False, True, False):
                with self.subTest(paused=paused):
                    setting = 'paused = ' + str(paused).lower()
                    (site / 'shop.toml').write_text(re.sub(r'^paused = (true|false)$', setting, config, flags=re.M))
                    subprocess.run([sys.executable, 'build.py'], cwd=site, capture_output=True, check=True)
                    home = (site / 'index.html').read_text()
                    sitemap = (site / 'sitemap.xml').read_text()
                    for route in routes:
                        output = site / (route + '.html')
                        self.assertEqual(output.exists(), not paused)
                        self.assertEqual('/' + route + '</loc>' in sitemap, not paused)
                        if not paused:
                            text = output.read_text()
                            self.assertNotIn('AW-18288494011', text)
                            self.assertNotIn('inquiry-conversion.js', text)
                            self.assertIn('name="ccw-tracking" content="off"', text)
                            self.assertFalse(inject(output))
                    for route in routes[:3]:
                        self.assertEqual(f'href="/{route}"' in home, not paused)
                    self.assertIn('href="/contact"', home)
                    self.assertTrue((site / 'admin/shop/index.html').is_file())


if __name__ == '__main__':
    unittest.main()
