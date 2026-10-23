import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('console_cache', Path(__file__).with_name('refresh-console-cache.py'))
cache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache)


class ConsoleCacheTest(unittest.TestCase):
    def test_https_and_http_preserve_public_home_tls_and_api(self):
        source = '''server { listen 80; server_name ndclients.co.in; return 301 https://$host$request_uri; }
server {
 listen 443 ssl; server_name ndclients.co.in www.ndclients.co.in;
 ssl_certificate /etc/cert.pem;
 root /var/www/ndmf;
 location = / { root /var/www/ndmf-public; try_files /index.html =404; }
 location /api/ { proxy_pass http://127.0.0.1:5000; }
 location / { try_files $uri $uri/ /index.html; }
}'''
        result, count = cache.patch(source, 'ndclients.co.in', '/var/www/ndmf')
        self.assertEqual(count, 1)
        self.assertIn('location = /index.html', result)
        self.assertIn(cache.HEADER, result)
        self.assertIn('ssl_certificate /etc/cert.pem;', result)
        self.assertIn('root /var/www/ndmf-public;', result)
        self.assertIn('location ^~ /brand/', result)
        self.assertIn('alias /var/www/ndmf-public/brand/;', result)
        self.assertIn('location = /brand/developers.html', result)
        self.assertIn('proxy_pass http://127.0.0.1:5000;', result)
        self.assertEqual(cache.patch(result, 'ndclients.co.in', '/var/www/ndmf')[0], result)

    def test_existing_cache_directive_is_replaced_without_duplicate_locations(self):
        source = '''server { server_name ndclients.co.in; root /var/www/ndmf;
 location = /index.html { try_files $uri =404; add_header Cache-Control "public, max-age=86400"; }
}'''
        result, _ = cache.patch(source, 'ndclients.co.in', '/var/www/ndmf')
        self.assertEqual(result.count('location = /index.html'), 1)
        self.assertEqual(result.count('add_header Cache-Control'), 3)
        self.assertIn('try_files $uri =404;', result)
        self.assertNotIn('max-age=86400', result)

    def test_other_domains_unchanged_and_wrong_root_rejected(self):
        source = 'server { server_name other.example; root /other; }'
        self.assertEqual(cache.patch(source, 'ndclients.co.in', '/var/www/ndmf'), (source, 0))
        with self.assertRaises(ValueError):
            cache.patch(source, 'other.example', '/var/www/ndmf')

    def test_public_root_and_brand_alias_upgrade_preserve_tls_and_other_locations(self):
        source = '''server { listen 443 ssl; server_name ndclients.co.in; root /var/www/ndmf;
 ssl_certificate /etc/site.pem;
 location /brand/ { alias /old-site/brand/; expires 7d; }
 location = / { root /old-site; try_files /index.html =404; }
 location /uploads/ { proxy_pass http://127.0.0.1:5000; }
}'''
        updated, _ = cache.patch(source,'ndclients.co.in','/var/www/ndmf','/srv/smartstaff-public')
        self.assertNotIn('/old-site',updated)
        self.assertIn('root /srv/smartstaff-public;',updated)
        self.assertIn('alias /srv/smartstaff-public/brand/;',updated)
        self.assertIn('ssl_certificate /etc/site.pem;',updated)
        self.assertIn('location /uploads/ { proxy_pass http://127.0.0.1:5000; }',updated)
        self.assertEqual(cache.patch(updated,'ndclients.co.in','/var/www/ndmf','/srv/smartstaff-public')[0],updated)


if __name__ == '__main__':
    unittest.main()
