#!/usr/bin/env python3
"""Install HTML revalidation in the active Nginx vhost, preserving TLS and APIs."""
import argparse
from pathlib import Path
import re
import subprocess
import time

TOKEN = re.compile(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\#[^\n]*|\$\{[^}]*\}|[{};]|[^\s{};]+''')
HEADER = 'add_header Cache-Control "no-cache, no-store, must-revalidate" always;'


def patch(text, hostname, web_root):
    tokens = [m for m in TOKEN.finditer(text) if not m.group().startswith('#')]
    stack, blocks = [], []
    start = 0
    for i, token in enumerate(tokens):
        if token.group() == '{':
            stack.append((start, i))
            start = i + 1
        elif token.group() == '}':
            head, opening = stack.pop()
            blocks.append((head, opening, i))
            start = i + 1
        elif token.group() == ';':
            start = i + 1
    edits = []
    matched = 0
    for head, opening, closing in blocks:
        if [t.group() for t in tokens[head:opening]] != ['server']:
            continue
        body = text[tokens[opening].end():tokens[closing].start()]
        # Inspect only server-level directives; nested locations may use other roots.
        nested = [(h, o, c) for h, o, c in blocks if opening < o < c < closing]
        direct = body
        for h, o, c in sorted(nested, reverse=True):
            a = tokens[h].start() - tokens[opening].end()
            b = tokens[c].end() - tokens[opening].end()
            direct = direct[:a] + ' ' * (b-a) + direct[b:]
        names = re.search(r'\bserver_name\s+([^;]+);', direct)
        root = re.search(r'\broot\s+([^;]+);', direct)
        if not names or hostname not in names[1].split():
            continue
        # Redirect-only HTTP servers have no document root.
        if not root:
            continue
        if root[1].strip().strip('\"\'').rstrip('/') != web_root.rstrip('/'):
            raise ValueError(f'Active root differs from {web_root}; set ADMIN_WEB_ROOT to {root[1].strip()}')
        matched += 1
        locations = [(h, o, c) for h, o, c in nested
                     if [t.group() for t in tokens[h:o]] == ['location', '=', '/index.html']]
        if locations:
            h, o, c = locations[0]
            a, b = tokens[o].end(), tokens[c].start()
            content = text[a:b]
            content, replaced = re.subn(r'\badd_header\s+Cache-Control\s+(?:"[^"\\]*(?:\\.[^"\\]*)*"|[^;])+;', HEADER, content, flags=re.I)
            if not replaced:
                content = '\n    ' + HEADER + '\n' + content
            edits.append((a, b, content))
        else:
            pos = tokens[closing].start()
            edits.append((pos, pos, '  location = /index.html {\n    ' + HEADER + '\n  }\n'))
    for a, b, replacement in sorted(edits, reverse=True):
        text = text[:a] + replacement + text[b:]
    return text, matched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('hostname')
    parser.add_argument('web_root')
    args = parser.parse_args()
    config = subprocess.run(['nginx', '-T'], capture_output=True, text=True, check=True).stdout
    paths = set(re.findall(r'^# configuration file (.+):$', config, re.M))
    changes, count = {}, 0
    for name in paths:
        path = Path(name).resolve()
        if path in changes:
            continue
        original = path.read_text()
        updated, matched = patch(original, args.hostname, args.web_root)
        count += matched
        if updated != original:
            changes[path] = (original, updated)
    if not count:
        raise SystemExit('No active website root found; inspect nginx -T before publishing.')
    for path, (original, updated) in changes.items():
        Path(str(path) + '.console-backup-' + str(time.time_ns())).write_text(original)
        path.write_text(updated)
    try:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    except Exception:
        for path, (original, _) in changes.items():
            path.write_text(original)
        subprocess.run(['nginx', '-t'], check=False)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=False)
        raise
    print(f'HTML cache policy installed for {count} active server block(s).')


if __name__ == '__main__':
    main()
