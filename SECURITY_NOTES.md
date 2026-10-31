# Security notes

## Open problem: the Firebase admin key is shipped inside the installer

`backend/serviceAccountKey.json` is a Google service-account key with full administrator access to the Firebase
project. electron-builder packs everything in `backend/`, so if the file exists on the build PC it ends up in every
customer's installer (found in the published 2.0.22 installer; earlier builds are very likely affected too).
Anyone who installs the app can extract it.

`scripts/check-package.cjs` runs after `npm run electron:build` and prints a warning while the key is still inside the
build. It also **fails the build** if a copy of the user list (`data/users.json`), license or AI settings, or the admin and
debug scripts are packaged (these are now excluded in `package.json`).

### Why the key can not just be deleted today
Every installed app uses it to read and write Firestore (users, licenses, devices) and to create or delete Auth users.
Deleting it in Google Cloud would break all installed apps at once.

### Plan
1. Ship an app version that talks to Firebase as the signed-in user (Firebase Auth REST + Firestore REST with the user's
   ID token) and Firestore security rules that stop users editing their own `is_active`, `account_type`, `license_*`.
2. Move the actions a user must not do for themselves (premium/license activation, delete user, bulk actions) to a small
   server (Cloud Functions / Cloud Run) or keep them on the admin's own PC, where the key stays outside the installer
   (load it from an environment variable or the user data folder instead of `backend/`).
3. Use the forced-update and "block outdated versions" tools in the admin panel to move everyone to that version.
4. Delete the old key in Google Cloud and create a new one that only exists on the admin's PC.
5. Review Google Cloud audit logs and the user list for activity that was not yours.
