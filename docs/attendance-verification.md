# Attendance verification — mobile 1.5.0 (26)

## Employee flow

Enable precise location and open Attendance. Check-in and check-out require a fresh fix within 35 metres reported accuracy, taken within the last minute. Mock locations are rejected. The app provides a shortcut to Android location/app settings when permissions or location services are off. Android permission controls cannot be silently overridden.

The attendance and enrollment cameras now run inside the app. For attendance, the server issues a random, single-use, three-minute challenge bound to the signed-in employee and check-in/check-out purpose. The app captures a neutral face followed by the requested eyes-closed or open-mouth action. The server detects the face, compares both frames against enrollment and checks landmark changes. Identical uploaded frames, a wrong identity, missing actions and expired/reused challenges cannot authorize attendance. A completed face check produces a short-lived, one-use pass; a check-in pass cannot authorize checkout. The old optional company check-in flag cannot bypass employee/manager live verification.

The displayed percentage is the face model's similarity score, not a calibrated probability of identity. The action check reduces static-photo replay; it is **not certified presentation-attack detection**, and sophisticated screen/video/deepfake attacks require an independently evaluated liveness solution. Real-phone testing under representative lighting and face poses is required to tune usability and assess spoof resistance. Automated tests stub neural inference while exercising actual HTTP authorization, persistence, challenge consumption and attendance endpoints.

## GPS interpretation

Only usable, non-mocked fixes contribute to the route. Movement needs consecutive fixes, stationary drift is excluded from distance, and jumps/long gaps create disconnected segments instead of invented travel. The mobile map uses the server-approved route rather than temporarily drawing raw device fixes.

The route is an estimate from GPS observations, not exact road-by-road ground truth. Old recorded zigzags cannot establish the employee's actual past movement, so existing history is preserved. Poor reception can reduce coverage; samples are not snapped to a guessed road to make the route look smoother.

## Deployment

Pull the backend/frontend and install the published **1.5.0 (26)** APK from the website. Older apps cannot complete the required two-frame challenge and must update. Existing enrolled reference photos remain available; enrollment resets are not required solely for this release.
