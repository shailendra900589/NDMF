#!/usr/bin/env python3
"""Wait for consecutive valid API health responses without noisy startup errors."""
import argparse
import json
import time
import urllib.error
import urllib.request


def wait_for_api(url, attempts=30, delay=2, timeout=5, consecutive=2):
    ready = 0
    reason = 'No response'
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                data = json.load(response)
                if response.status != 200 or not isinstance(data, dict) or data.get('success') is not True or not isinstance(data.get('data'), dict) or not data['data'].get('version'):
                    raise ValueError('Unexpected API health response')
            ready += 1
            if ready >= consecutive:
                print(f'API ready: {url} ({attempt} checks)', flush=True)
                return True
            reason = 'Confirming API readiness'
        except (OSError, urllib.error.URLError, ValueError) as error:
            ready = 0
            reason = str(error)
            if isinstance(error, urllib.error.HTTPError):
                error.close()
        if attempt < attempts:
            print(f'Waiting for API readiness ({attempt}/{attempts})…', flush=True)
            time.sleep(delay)
    print(f'ERROR: API did not become ready at {url}. Last result: {reason}', flush=True)
    return False


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('url')
    parser.add_argument('--attempts', type=int, default=30)
    args = parser.parse_args()
    if args.attempts < 2:
        parser.error('At least two readiness checks are required')
    raise SystemExit(0 if wait_for_api(args.url, attempts=args.attempts) else 1)
