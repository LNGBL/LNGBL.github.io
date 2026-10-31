# LangBlue — Privacy-by-design implementation notes

**Status:** Audit and implementation proposal. This document is not a legal opinion and does not certify compliance.

## What the current audit found

- The Supabase project is hosted in **us-west-2 (Oregon, United States)**. EU/EEA user data may therefore be processed or stored in the United States; a lawful transfer mechanism, vendor DPA, subprocessors, and retention terms need to be checked before claiming GDPR compliance.
- `public.account_activity_registry` currently stores full IP addresses in an `inet` column. The live table has 56 rows associated with one account, and no expiry/retention column was found.
- The active `langblue-connection-policy` Edge Function sends a request IP to an external IP-intelligence endpoint when configured. It evaluates VPN, proxy, Tor, and hosting flags. Its current logic can suspend users or put them into a grace period based on connection signals.
- The current `langblue-behavior` Edge Function writes account-linked learning events to `behavior_events`; the inspected profile schema has no dedicated analytics-consent field and the function does not enforce an analytics opt-in.
- `profiles.country` is an account/profile value, not a verified legal-residence signal. It should not be treated as authoritative proof of the law applicable to a user.

## Recommended operating model

1. **Use coarse location only.** Prefer a trusted edge-provided country code (for example, a gateway-injected country header). Do not request browser GPS or precise location. Do not trust a client-supplied country field for legal decisions.
2. **Do not send raw IPs to a third-party intelligence service.** Remove the external IP-intelligence lookup from the connection policy. Do not penalize ordinary VPN/proxy use or suspend an account solely because an IP is classified as anonymized.
3. **Fail open for ordinary access.** If country detection is missing, conflicting, or unavailable, do not block sign-in, learning, account settings, or account deletion. Apply the more protective privacy defaults.
4. **GDPR / UK GDPR.** IP geolocation is only one contextual signal. Territorial scope can depend on establishment, offering services, and monitoring—not just the current IP country. Give users the applicable rights regardless of whether geolocation succeeds.
5. **United States.** Privacy obligations differ by state and by business/data thresholds. Country-only detection cannot reliably identify state-specific rights. Use a trusted state-level signal only when available; otherwise provide a universal baseline and make privacy requests/settings available to everyone.
6. **Iran and all other regions.** Apply the same privacy-first baseline: collect only what is necessary, keep optional analytics off until a user opts in, avoid extra onboarding prompts, and do not degrade learning access because of location uncertainty or ordinary VPN use.
7. **Optional analytics.** Add a separate, explicit analytics preference with a default of `false`; enforce it server-side in the event-ingestion function. Keep essential account/security processing separate from optional product analytics. Existing exam-contribution and peer-learning consents remain separate purposes.
8. **Retention.** Define and enforce short retention windows for raw IP/security metadata. Prefer short-lived keyed pseudonymous tokens only where a documented abuse-prevention or deduplication purpose genuinely requires them. Keep aggregated statistics that cannot reasonably identify a person.
9. **Transparency and control.** Provide a compact privacy centre inside the central account, not a blocking banner. Explain the purpose in plain language and let users change optional choices later.
10. **International transfers.** Review Supabase's DPA, subprocessors, region options, transfer terms, and any required SCC/transfer assessment before asserting GDPR compliance.

## Safe rollout sequence

- **Phase A — design preview:** create a standalone React-based design-system preview. It is not linked from the public landing page and does not modify existing user journeys.
- **Phase B — privacy migration:** add consent fields and server-side enforcement; replace raw-IP persistence with short-lived privacy-preserving deduplication only if still needed; remove third-party IP intelligence and connection-based suspension. Test with synthetic accounts and unknown-country cases.
- **Phase C — gradual UI adoption:** apply shared tokens/components to one representative page at a time, run regression tests, then roll out to the remaining products and admin/teacher pages.
- **Phase D — legal review:** confirm the actual entity/controller, users/markets, vendor terms, retention schedule, and state-specific applicability with qualified counsel.

## Important boundary

This audit has not changed production database rows, RLS policies, or active Supabase functions. The raw-IP and event-consent findings remain open until a tested migration and coordinated function rollout are approved.
