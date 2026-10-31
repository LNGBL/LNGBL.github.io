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

## Implemented in the privacy-first rollout

- Added `profiles.analytics_consent` with database default `false`. The event collector checks the field server-side before writing any event.
- Added a compact optional control inside the central account. There is no blocking banner, and the setting does not affect access to learning, account functions, or product pages.
- Retired IP-based connection enforcement. The function no longer queries an external IP-intelligence provider, no longer classifies VPN/proxy/Tor/hosting connections, and no longer suspends accounts based on connection type. A trusted edge country header may be returned as an approximate hint only; it is not persisted or treated as legal residence.
- Consolidated activity registry data to one row per account. Earliest registration/first activity, latest activity, maximum recorded active seconds, qualification state, and latest practice metadata were retained. The raw `ip_address` column and per-IP uniqueness constraint were removed.
- Activity heartbeats now update account-level activity and leaderboard metadata without reading request IP headers.
- Removed raw IP storage from exam incident records; incident type, session, account, metadata, and timestamp remain available for security review.
- Removed Android device/pairing IP-hash columns and the ineffective IP-match comparison. Pairing continues to use device-key hashes, one-time codes, and explicit account approval.
- Public page-view deduplication retains only a keyed IP hash for the 24-hour deduplication window. Expired hashes are purged after 24 hours by both request-time cleanup and an hourly database job; the cumulative page-view counter is preserved.

## Remaining work and limitations

- Historical `behavior_events` remain in place; approve a purpose-specific retention period before scheduling deletion.
- The public page-view counter still deduplicates by IP for 24 hours, but only a keyed hash is retained for that window; it is not an exact location signal. The hourly cleanup job is named `langblue-prune-landing-ip-hashes`.
- Supabase database backups and provider request/security logs may have independent retention periods. Review those settings with the hosting provider.
- Review Supabase DPA, subprocessors, international-transfer terms, and region choice with qualified counsel. This implementation is not a legal compliance certification.
- The activity registry now measures account-level activity rather than separate per-IP activity. Its consolidation uses the maximum per-IP active-seconds value to avoid double-counting simultaneous devices; the historical per-IP breakdown was intentionally removed.

