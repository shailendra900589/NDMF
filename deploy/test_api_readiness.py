import contextlib
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('readiness', Path(__file__).with_name('wait-for-api.py'))
readiness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(readiness)


def response(payload=None):
    stream = io.BytesIO(json.dumps(payload if payload is not None else {'success': True, 'data': {'version': '2.2.0'}}).encode())
    stream.status = 200
    return stream


class ApiReadinessTest(unittest.TestCase):
    def check(self, sequence, attempts, **kwargs):
        output = io.StringIO()
        with patch.object(readiness.urllib.request, 'urlopen', side_effect=sequence), patch.object(readiness.time, 'sleep'), contextlib.redirect_stdout(output):
            result = readiness.wait_for_api('http://127.0.0.1:5000/api/v1/health', attempts=attempts, **kwargs)
        return result, output.getvalue()

    def test_restart_connection_refusal_then_stable_success(self):
        result, text = self.check([urllib.error.URLError('connection refused'), response(), response()], 3)
        self.assertTrue(result)
        self.assertIn('Waiting for API readiness', text)
        self.assertIn('API ready:', text)
        self.assertNotIn('ERROR:', text)

    def test_one_healthy_response_is_not_enough(self):
        result, text = self.check([response(), urllib.error.URLError('connection refused'), response()], 3)
        self.assertFalse(result)
        self.assertIn('ERROR:', text)

    def test_invalid_json_wrong_payload_and_http_errors_fail(self):
        for bad in [io.BytesIO(b'<html>proxy error</html>'), response({'success': False}), response([]), urllib.error.HTTPError('url', 503, 'unavailable', {}, None)]:
            with self.subTest(bad=bad):
                result, text = self.check([bad, urllib.error.URLError('connection refused')], 2)
                self.assertFalse(result)
                self.assertIn('did not become ready', text)

    def test_old_backend_cannot_pass_single_photo_deployment_check(self):
        result, text = self.check([response(), response()], 2, expected_face_mode='single_photo_only_v2')
        self.assertFalse(result)
        self.assertIn('Old attendance backend', text)

    def test_current_face_mode_requires_two_matching_responses(self):
        payload = {'success': True, 'data': {'version': '2.2.0', 'attendanceFaceMode': 'single_photo_only_v2'}}
        result, text = self.check([response(payload), response(payload)], 2, expected_face_mode='single_photo_only_v2')
        self.assertTrue(result)


if __name__ == '__main__':
    unittest.main()
