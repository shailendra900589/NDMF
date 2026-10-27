# Visit verification

## Employee flow

1. Open **My visits** on the mobile home screen.
2. Select **Start visit & take GPS photo**. The rear camera opens; this flow does not offer a gallery picker.
3. Allow camera and location permissions. A fresh location fix is required. The saved photo contains a visible latitude, longitude, capture time and scheduled-location watermark.
4. Enter the discussion, purpose, result, optional payment amount/promise date, next follow-up date and remarks.
5. Select **Complete verified visit**. The app saves the report on the phone before attempting upload.

If the connection fails, the report and photo remain in the app's private storage. Retry runs when connectivity returns and every 45 seconds while the app is running. Reopening **My visits** also retries. Android force-stop or clearing app storage prevents pending uploads until the app is reopened, or removes them when storage is cleared. Do not uninstall or clear storage before pending reports have uploaded.

## Administrator flow

Open **Visit schedules** to see assigned employee, customer/lead, contact number, planned time and visit status. Completed reports include purpose, outcome, discussion, payment promise, follow-up date, photo preview and a map link. Capture time and server photo-receipt time are shown separately in India Standard Time. **Schedule visit again** creates a new schedule; **Cancel visit** requires a reason. A manager cannot complete an employee's visit through the previous notes-only endpoint.

## Authenticated API

All paths are below `/api/v1`; send `Authorization: Bearer <session-token>`.

- `GET /workspace/visits`: visits visible to the signed-in user.
- `POST /workspace/visits/:id/start`: `{ "position": { "lat": 26.7, "lng": 83.3, "capturedAt": "2026-10-26T09:00:00Z" } }`.
- `POST /uploads/single`: multipart `file`, with `type=visit_photo`. Keep the returned file URL for completion.
- `POST /workspace/visits/:id/complete`: `discussion`, `purpose`, `result`, `photo`, `photoGps`, optional `paymentAmount`, `paymentPromiseDate`, `nextFollowUpDate` and `remarks`.

Purpose values: `recovery`, `shop_verification`, `document_collection`, `customer_meeting`, `other`.

Result values: `completed`, `customer_unavailable`, `shop_closed`, `payment_promised`, `revisit_required`.

Date-only fields use `YYYY-MM-DD`. GPS capture times use ISO 8601 UTC. The server records receipt time independently. Start and completion require the assigned employee, module permissions, a valid position and an existing company-owned photo. Completed submissions can be retried without replacing the original report.

The app captures fresh camera evidence; device GPS, capture time and the location text are supporting evidence. They are not cryptographic proof of physical presence. The watermark's location text is the scheduled address; the GPS coordinates identify the observed position.

## Release

Install mobile version **1.4.2 (25)** after deploying the backend and admin frontend. This version also isolates personal attendance from branch-manager team records and improves login connection recovery. Older apps do not contain these fixes. The website reads `/downloads/release.json` to choose the current APK.
