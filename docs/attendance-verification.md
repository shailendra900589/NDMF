# Attendance verification — mobile 1.5.2 (28)

## Employee flow

Enable precise location and open Attendance. Check-in and check-out require a fresh fix within 35 metres reported accuracy, taken within the last minute. Mock locations are rejected. The app provides a shortcut to Android location/app settings when permissions or location services are off. Android permission controls cannot be silently overridden.

The attendance and enrollment cameras now run inside the app. For attendance, the server issues a random, single-use, three-minute challenge bound to the signed-in employee and check-in/check-out purpose. The app captures a neutral face followed by the requested eyes-closed or open-mouth action. The server detects the face, compares both frames against enrollment and checks landmark changes. Identical uploaded frames, a wrong identity, missing actions and expired/reused challenges cannot authorize attendance. A completed face check produces a short-lived, one-use pass; a check-in pass cannot authorize checkout. The old optional company check-in flag cannot bypass employee/manager live verification.

The displayed percentage is the face model's similarity score, not a calibrated probability of identity. The action check reduces static-photo replay; it is **not certified presentation-attack detection**, and sophisticated screen/video/deepfake attacks require an independently evaluated liveness solution. Real-phone testing under representative lighting and face poses is required to tune usability and assess spoof resistance. Automated tests stub neural inference while exercising actual HTTP authorization, persistence, challenge consumption and attendance endpoints.

## GPS interpretation

Only usable, non-mocked fixes contribute to the route. Movement needs consecutive fixes, stationary drift is excluded from distance, and jumps/long gaps create disconnected segments instead of invented travel. The mobile map uses the server-approved route rather than temporarily drawing raw device fixes.

The route is an estimate from GPS observations, not exact road-by-road ground truth. Old recorded zigzags cannot establish the employee's actual past movement, so existing history is preserved. Poor reception can reduce coverage; samples are not snapped to a guessed road to make the route look smoother.

## Deployment

Pull the backend/frontend and install the published **1.5.2 (28)** APK from the website. Older apps must update. Existing enrolled reference photos remain available; enrollment resets are not required solely for this release.

## Guided live capture

Each attendance camera frame is checked before moving to the next step. A closed-eye or open-mouth reference can be retaken, and an incomplete action can be retried in the camera with specific guidance. Keep the requested pose throughout the countdown. These guidance requests do not create an attendance pass, count as identity failures, or consume the challenge. They are limited to twelve requests per unexpired challenge. The final two-frame identity, action and anti-replay checks still run; similarity percentage alone never authorizes attendance. No action threshold was relaxed. Both check-in and checkout use this flow.

The home shortcut strip is removed. Notices, visits and salary slips are available as organized rows in Profile; notice refresh and phone notifications remain active while home is open.

### Backend consistency correction

Action-photo presence is now explicit: missing action landmarks cannot be mistaken for an accepted reference-only frame. Guidance validates both identities and the requested action before returning ready. Its server-generated decision is bound to the SHA-256 of both uploaded files, the employee enrollment revision and the unexpired single-use challenge. Final submission uses this same decision for identical files, avoiding a second inference disagreeing with an already accepted capture. Modified files fall back to full verification; changed enrollment invalidates the decision. No client success flag is trusted and no photo is saved by this process. Existing mobile 1.5.2 uses this backend correction without a new APK.

## Tracking recovery and diagnostics

The app restores duty tracking after login, attendance refresh and resume, and refreshes on network reconnection. Failed GPS uploads remain in an employee-scoped queue and retry even without a new position. Interrupted location streams restart. A separate heartbeat reports location permissions, background permission, app version and service state; it never changes the GPS capture timestamp.

Fresh coarse observations up to 150 metres can identify an approximate live position, but fixes exceeding 35 metres do not add route distance. The dashboard distinguishes reduced GPS accuracy, location switched off, missing permission, GPS pending and stopped app updates. Stale data is never relabelled Live. Install this APK on each field phone, allow background location and review Android battery restrictions. A force-stopped app or disconnected phone cannot be made live remotely. Automated HTTP and queue tests verify recovery logic; actual field-phone background operation still needs device validation.
