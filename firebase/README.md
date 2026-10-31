# Firebase setup for Parcel Tools

## 1. Publish the security rules (do this BEFORE releasing the build that has no admin key)
1. Firebase console -> your project -> **Firestore Database** -> **Rules**.
2. Replace everything with the contents of `firestore.rules`, then **Publish**.
3. Open the **Rules Playground** and try, as a normal signed-in user, to read another user's `users/<uid>` document
   (must be denied) and to update your own `is_active` (must be denied).

The old installed apps use the admin key, which ignores these rules, so publishing them does not break existing installs.

## 2. Keep the admin key on YOUR PC only
Save the service-account key as one of:
* Windows: `%LOCALAPPDATA%\ParcelTools\serviceAccountKey.json`
* or set the environment variable `PARCEL_TOOLS_SERVICE_ACCOUNT` to the file's path.

With the key present, your copy of the app has full admin power (permanently deleting logins, reading verification status).
Builds no longer package the key; customer copies sign in as the user and are limited by `firestore.rules`.

## 3. Revoking the old key (last step)
After almost everybody runs the new version (use *Forced update* / *Block outdated versions* in the admin panel):
Google Cloud console -> IAM & Admin -> Service accounts -> `firebase-adminsdk...` -> **Keys** -> delete the old key,
create a new one and store it only as described above.

## What customers can and cannot do now
* Read/update only their own profile, and only these fields: `last_login`, `devices`, `machine_id_hash`, `app_version`,
  `license`, `license_key`, `license_updated_at`, `account_type`.
* Cannot read other users, list users, delete their profile, change `is_active`, `is_admin`, `max_devices`,
  `trial_start`, `suspended_*` or `created_at`.
* Known limit: `devices` and `account_type` are edited by the app itself, so a person who patches their own copy of the
  app can bypass the device limit or claim premium for themselves. Paid features of a desktop app can never be fully
  protected on the customer's PC.
