# Mobile API release verification — 2026-10-24

## Automated results

- Backend: 32 passing tests, including a new isolated real-HTTP audit covering 50 distinct method/path combinations. PostgreSQL persistence is mocked for these tests; no production employees or companies are modified.
- Mobile audit covers login for Admin/Branch Manager/Employee, profile/password, public settings, uploads and signed media access, face enrollment validation, attendance in/out, GPS ping/live/history/route/day queries, company branches, team creation/update, customer submission/assignment/two-stage approval, approved-customer verification, call logs and pay-slip permission boundaries.
- Existing attendance tests cover durable enrollment, signed photo normalization, failed enrollment, reset races and matching contracts using a deterministic face engine. This does not validate real camera recognition quality.
- Flutter tests cover confirmed enrollment caching, customer verification parsing, feature header controls, credential/session failure distinctions and route registration.
- Console: 10 passing tests and production build. Deployment: 9 Python tests; APK checksum, ZIP integrity and both ARM ABIs verified separately.

## Fixes

Feature header Profile/Logout controls and marked empty-state create buttons removed. Customer listing filters now show Rejected rather than the obsolete Approved queue. Customer filters describe their actual behavior (Recent / With GPS). Customer detail fetches complete verification media instead of reusing an incomplete list row. Empty route responses clear old paths. Background refresh updates session permissions before pulling data; active customer/listing views follow refresh notifications. API expiry handling recognizes JSON error envelopes while preserving valid sessions on permission denials and incorrect current passwords. Calling a customer retains the shared call service path.

## Scope and deployment

Production public HTTPS health was reachable during verification. Mutating API checks use isolated fixtures, not production. Unmounted legacy lead/loan helpers remain unsupported; they are not exposed as working mobile modules. Hardware, background OS behavior, network loss and installation need physical-phone acceptance. Server database/environment readiness is checked by the updater when the user deploys.

Run git pull and deploy/update-production.sh to publish website, APIs and the prebuilt APK. A pull alone does not restart services or copy published website files.
