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
        self.assertIn('location = / { root /var/www/ndmf-public;', result)
        self.assertIn('proxy_pass http://127.0.0.1:5000;', result)
        self.assertEqual(cache.patch(result, 'ndclients.co.in', '/var/www/ndmf')[0], result)

    def test_existing_cache_directive_is_replaced_without_duplicate_locations(self):
        source = '''server { server_name ndclients.co.in; root /var/www/ndmf;
 location = /index.html { try_files $uri =404; add_header Cache-Control "public, max-age=86400"; }
}'''
        result, _ = cache.patch(source, 'ndclients.co.in', '/var/www/ndmf')
        self.assertEqual(result.count('location = /index.html'), 1)
        self.assertEqual(result.count('add_header Cache-Control'), 1)
        self.assertIn('try_files $uri =404;', result)
        self.assertNotIn('max-age=86400', result)

    def test_other_domains_unchanged_and_wrong_root_rejected(self):
        source = 'server { server_name other.example; root /other; }'
        self.assertEqual(cache.patch(source, 'ndclients.co.in', '/var/www/ndmf'), (source, 0))
        with self.assertRaises(ValueError):
            cache.patch(source, 'other.example', '/var/www/ndmf')


if __name__ == '__main__':
    unittest.main()
