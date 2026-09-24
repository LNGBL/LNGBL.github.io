# LangBlue backend

This directory contains the first backend layer for LangBlue. It is intentionally additive: the existing browser account/subscription flow remains the compatibility path until Supabase Auth and the Edge Functions are deployed and tested.

## Database

Run:

- `supabase/migrations/001_langblue_backend.sql`

It creates the product catalog, plans, profiles, hashed activation-code store, subscriptions, and usage-session tables. Activation codes are never readable by the browser through RLS.

## Edge Functions

- `activate-code`: authenticated users redeem a code; the code is hashed server-side and the subscription is written server-side.
- `admin-create-code`: admin-only code generation. Set `LANGBLUE_ADMIN_SECRET` as a Supabase secret. The generated plaintext code is returned only to the admin request that created it.

Required Supabase secrets for `activate-code` are provided automatically by Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Do not put the service-role key or the admin secret in GitHub Pages or any frontend JavaScript.

## Rollout order

1. Apply the SQL migration.
2. Deploy the two Edge Functions.
3. Configure the admin secret.
4. Create a test activation code through `admin-create-code`.
5. Migrate LangBlue account login to Supabase Auth.
6. Enable `window.LangBlueBackendConfig.enabled = true` only after authenticated activation has been tested.
7. Remove the legacy client-side activation-code map.
