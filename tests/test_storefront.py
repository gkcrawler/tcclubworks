"""Launch safeguards and generated store output; no calls to a live payment API."""
import copy
import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
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

    def test_generated_shop_has_no_ad_tracking(self):
        for name in ('shop', 'shop-policies', 'shop-privacy', 'shop-terms'):
            text=(ROOT / (name+'.html')).read_text()
            self.assertNotIn('AW-18288494011', text)
            self.assertNotIn('inquiry-conversion.js', text)
            self.assertIn('name="ccw-tracking" content="off"', text)

    def test_ad_injection_respects_shop_marker(self):
        spec=importlib.util.spec_from_file_location('ads', ROOT / 'inject_google_ads.py')
        module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        self.assertFalse(module.inject(ROOT / 'shop.html'))


if __name__ == '__main__':
    unittest.main()
