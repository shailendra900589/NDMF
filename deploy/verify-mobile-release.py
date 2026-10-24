#!/usr/bin/env python3
"""Validate the prebuilt Android artifact before publishing; no Flutter needed."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

def verify(root):
    root = Path(root).resolve()
    release = json.loads((root / 'release.json').read_text())
    apk = (root / release['file']).resolve()
    if apk.parent != root or apk.suffix != '.apk':
        raise ValueError('Invalid APK path')
    if apk.stat().st_size != release['sizeBytes']:
        raise ValueError('APK size mismatch')
    if hashlib.sha256(apk.read_bytes()).hexdigest() != release['sha256']:
        raise ValueError('APK checksum mismatch')
    with zipfile.ZipFile(apk) as archive:
        if 'AndroidManifest.xml' not in archive.namelist():
            raise ValueError('Android manifest missing')
        for abi in ('armeabi-v7a', 'arm64-v8a'):
            if f'lib/{abi}/libapp.so' not in archive.namelist():
                raise ValueError(f'Missing architecture: {abi}')
        if archive.testzip():
            raise ValueError('Corrupt APK ZIP entry')
    print(f"Verified Android {release['version']} ({release['versionCode']}): {apk.name}")
    return release

if __name__ == '__main__':
    verify(sys.argv[1])
