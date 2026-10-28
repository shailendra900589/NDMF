# Attendance face verification — mobile 1.6.1 (30)

## Current employee flow

Tap Check In or Check Out. The front camera opens inside the app, detects one clear, frontal face and automatically captures a single frame after a brief stable interval. There is no shutter button, countdown, blink, eyes-closed or mouth-open requirement. Local detection selects the image only; it cannot identify the employee or approve attendance. The server compares that one image with the employee's registered reference photos and returns the similarity score. The percentage is a model similarity score, not a calibrated probability of identity.

The server issues a three-minute, single-use challenge in `auto_single` mode, bound to the account and check-in/check-out purpose. A successful identity match creates a short-lived one-use face pass. A check-in pass cannot authorize checkout. The client cannot authorize a punch by sending `faceVerified: true`, switch a stored challenge mode, reuse a consumed challenge or revive a reset enrollment. Inference concurrent with enrollment changes is rejected. No captured attendance photo is retained on the server; temporary app files are removed after use or cancellation.

**Single-image face matching does not establish anti-spoof liveness.** A printed photo, screen replay or manipulated image is not reliably distinguished by this flow. Fresh in-app capture is the normal client workflow, not cryptographic proof of a live person. Accordingly single-image results and attendance audit fields record identity verification and `livenessVerified: false`; the product labels this Face verification. This simplified mode was explicitly requested by the owner. Strong anti-spoof requirements need a separately validated passive liveness solution or an interactive challenge.

Existing reference enrollment remains valid. No enrollment reset is required merely to install this update. Wrong identities, missing/multiple/small faces and unreadable captures still fail; matching thresholds have not been relaxed. Previously deployed guided/automatic-blink clients retain their previous challenge validation and should update to receive the single-capture interaction.

## GPS and responsiveness

GPS is acquired alongside camera capture. A real non-mocked position no more than ten seconds old can be reused if its reported accuracy is within 35 metres. Older or poor positions require a fresh acquisition. A punch still requires precise location enabled and a usable position; Android permissions cannot be overridden silently. The success acknowledgement appears after the server saves attendance without waiting for a full history reload.

The interaction targets 3–5 seconds with good lighting, GPS and connectivity; this is not a measured device guarantee. Camera startup, poor GPS, network delay and cold server inference can take longer. No physical phone was available for end-to-end camera/latency validation. Automated tests cover frame selection/encoding and real HTTP authentication, identity decisions, purpose binding, one-use consumption, wrong identities and enrollment reset races, with deterministic model inference fixtures.

## Tracking interpretation

Only usable, non-mocked fixes contribute to travelled distance. Movement needs consecutive observations, stationary drift is excluded, and jumps/long gaps create disconnected segments. Routes estimate GPS observations rather than exact road-by-road ground truth; missing historical movement is never invented.

Duty tracking resumes after login, attendance refresh and app resume. Network reconnection refreshes state. Failed GPS uploads retry from an employee-scoped durable queue, including without a new fix, and interrupted streams restart. Independent phone heartbeat reports permissions, app version and service state without rewriting the GPS capture timestamp.

Fresh coarse observations up to 150 metres may show approximate live positions but do not add travelled distance above the 35-metre quality limit. Dashboard states distinguish reduced accuracy, location switched off, missing permission, GPS pending and stopped app updates. Stale data is never labelled Live. Allow background location and review Android battery restrictions; a force-stopped or disconnected phone cannot be made live remotely.

## Deployment

Deploy the backend first, then install **1.6.1 (30)** from the website. Both are required for `auto_single`. The website chooses its APK from `/downloads/release.json`; deployment verifies the committed binary's size and checksum. Android minimum remains API 24 (Android 7), with armeabi-v7a, arm64-v8a and x86_64 libraries.
