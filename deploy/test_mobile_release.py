import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('mobile_release', Path(__file__).with_name('verify-mobile-release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class MobileReleaseTest(unittest.TestCase):
    def test_validates_both_architectures_and_rejects_tampered_apk(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            apk = root / 'test.apk'
            with zipfile.ZipFile(apk, 'w') as archive:
                for name in ['AndroidManifest.xml', 'lib/armeabi-v7a/libapp.so', 'lib/arm64-v8a/libapp.so']:
                    archive.writestr(name, 'fixture')
            metadata = dict(file=apk.name, version='test', versionCode=1, sizeBytes=apk.stat().st_size,
                            sha256=hashlib.sha256(apk.read_bytes()).hexdigest())
            (root / 'release.json').write_text(json.dumps(metadata))
            self.assertEqual(release.verify(root)['versionCode'], 1)
            data = bytearray(apk.read_bytes())
            data[0] ^= 1
            apk.write_bytes(data)
            with self.assertRaisesRegex(ValueError, 'checksum'):
                release.verify(root)

    def test_rejects_path_outside_downloads(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'release.json').write_text(json.dumps({'file': '../other.apk'}))
            with self.assertRaisesRegex(ValueError, 'path'):
                release.verify(root)
