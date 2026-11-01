# LangBlue backend

This directory contains the first backend layer for LangBlue. It is intentionally additive: the existing browser account/subscription flow remains the compatibility path until Supabase Auth and the Edge Functions are deployed and tested.

## Database

Current backend migration:

- `supabase/migrations/20260926154258_harden_backend_and_indexes.sql`

The production project already contains the backend tables and redemption function. Keep this migration in version control so the security/index hardening is reproducible.

It creates the product catalog, plans, profiles, hashed activation-code store, subscriptions, and usage-session tables. Activation codes are never readable by the browser through RLS.

## Edge Functions

- `activate-code`: authenticated users redeem a code; the code is hashed server-side and the subscription is written server-side.
- `admin-create-code`: admin-only code generation. Requires a valid Supabase session and a matching row in `public.platform_admins`; the generated plaintext code is returned only to the authorized request that created it.\n- `langblue-admin-access`: reports the signed-in account’s central admin status and available management modules.\n- `langblue-community-access`: community-assistance administration is authorized through `public.platform_admins`; ordinary user request/status actions remain scoped to the signed-in user.\n- `langblue-research-dashboard`: research access is authorized through the same central `public.platform_admins` table.
- `langblue-auth`: username/password bridge that creates/confirms the internal Supabase Auth identity and returns a normal Supabase session; no user email is required.

Required Supabase secrets for `activate-code` are provided automatically by Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never place the service-role key or any server secret in GitHub Pages or frontend JavaScript. Admin authorization is checked server-side from the authenticated user ID; a frontend link is only a convenience and is not an authorization boundary.

## Rollout order

1. Apply the SQL migration.
2. Deploy the two Edge Functions.
3. Configure the admin secret.
4. Create a test activation code through `admin-create-code`.
5. Migrate LangBlue account login to Supabase Auth.
6. Enable `window.LangBlueBackendConfig.enabled = true` only after authenticated activation has been tested.
7. Remove the legacy client-side activation-code map.
