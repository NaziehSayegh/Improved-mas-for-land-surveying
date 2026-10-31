# Security notes

## The Firebase admin key (status: migration implemented, rollout pending)

**Problem (found in the published 2.0.22 installer):** `backend/serviceAccountKey.json` is a Google service-account key with
full administrator access to the Firebase project, and electron-builder packed it into every customer's installer.

**What changed in the code**
* Customer copies no longer need the key. Without it the backend runs in *customer mode*: it signs in with Firebase
  Authentication (REST) and reads/writes Firestore (REST) **as the signed-in user** (`user_auth.py`, `rest_firestore.py`,
  `firebase_service.py`). What a user may do is decided by `firebase/firestore.rules`.
* The key is looked for in `PARCEL_TOOLS_SERVICE_ACCOUNT` / `GOOGLE_APPLICATION_CREDENTIALS`, then
  `%LOCALAPPDATA%\ParcelTools\serviceAccountKey.json`, then (development only) the backend folder. On the admin's own PC it
  gives full admin power as before.
* `package.json` no longer packages the key; `scripts/check-package.cjs` **fails the build** if the key, user data or admin
  scripts are inside the app.
* After this update every user is asked to sign in once more (their Firebase tokens did not exist before).

**Rollout order - do not skip steps**
1. Publish `firebase/firestore.rules` (see `firebase/README.md`). Old installs use the key, which ignores rules, so nothing breaks.
2. Put your own copy of the key where the admin PC looks for it (not in `backend/`).
3. Build and publish the new version. Test it with a throw-away account against the real Firebase first: sign up,
   verify, sign in, add a project, sign out and in, and (as admin) the admin panel.
4. Use *Forced update* / *Block outdated versions* until nearly everybody is on it.
5. Only then delete the OLD key in Google Cloud (IAM -> Service accounts -> Keys) and create a new one for your own PC.
6. Review the Google Cloud audit logs and the user list for activity that was not yours.

**Limits you should know about**
* Permanently deleting a Firebase *login* (not only the profile) needs the admin key, so it only works on the admin's PC.
* Customers edit their own `devices` and `account_type` fields, so someone who patches their copy of the app can bypass the
  device limit or claim premium. Paid features of a desktop app can never be fully protected on the customer's PC.
* The rules were checked with a model in the test-suite (`backend/test_customer_mode.py`), not by Firebase itself: use the
  Rules Playground after publishing.
