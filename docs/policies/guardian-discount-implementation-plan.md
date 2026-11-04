# LangBlue — Guardian and Promotion Implementation Plan

**Status:** Non-production implementation blueprint. No payment processing or financial activation is included.

## A. Suggested data model

### `guardian_links`
- `id` UUID primary key
- `minor_user_id` UUID, references the minor's auth user
- `guardian_user_id` UUID, references the guardian's auth user
- `status` enum: `pending`, `active`, `revoked`, `expired`
- `consent_scope` JSONB with explicit, versioned permissions
- `policy_version` text
- `requested_at`, `accepted_at`, `revoked_at` timestamptz
- Unique active link constraint per minor account unless a reviewed product rule explicitly permits more than one guardian.

A username entry must never directly set `status='active'`. Only an authenticated action from the guardian account may accept the invitation.

### `promotion_eligibility`
- `id` UUID primary key
- `user_id` UUID
- `promotion_type` enum: `first_purchase`, `referral_period`
- `entitlement_period_id` UUID nullable; required for `referral_period`
- `status` enum: `eligible`, `reserved`, `consumed`, `released`, `voided`
- `discount_percent` numeric constrained to 7
- `created_at`, `reserved_at`, `consumed_at`, `released_at` timestamptz

Use a partial unique index to ensure one first-purchase benefit per user and one referral benefit per user per entitlement period. Enforce eligibility in a trusted server-side transaction, not browser JavaScript or localStorage.

### `promotion_events`
Append-only event log:
- `id` UUID primary key
- `actor_user_id` UUID nullable for system events
- `subject_user_id` UUID
- `promotion_eligibility_id` UUID
- `event_type` text
- `policy_version` text
- `metadata` JSONB limited to non-sensitive decision evidence
- `created_at` timestamptz

Clients may read only their own relevant status. Only trusted server-side code may insert events. Ordinary clients must never update or delete audit events.

## B. Eligibility state machine

1. **First purchase:** `eligible → reserved → consumed`. A failed or abandoned checkout releases the reservation. Consumption occurs only after an authorised provider confirms the purchase. A cancellation/refund follows a separately reviewed restoration rule.
2. **Referral period:** create one eligibility record for the referred account and exact premium entitlement period. Use `eligible → reserved → consumed`; do not issue another record for the same user and period.
3. A referral relationship alone never proves age, guardian authority, consent, payment, or purchase.
4. Do not permit two 7% promotions on one order. If both rules qualify, select one deterministically and explain the choice.

## C. Access-control requirements

- Enable Row Level Security on all user-related tables.
- Minor: read their own guardian-link and promotion status.
- Guardian: read only linked minor records covered by the accepted consent scope.
- Admin: use a narrowly scoped server-side role and log privileged reads/changes.
- Never expose service-role keys or privileged credentials to browser code.
- Avoid collecting date of birth or identity documents unless a documented legal requirement and retention basis have been reviewed.
- Store referral attribution as an opaque inviter ID; do not publish contact lists or the minor's network graph.

## D. Required tests before production

- A username-only guardian request remains pending.
- A guardian can accept only while authenticated as the guardian account.
- Revocation blocks future guardian-dependent purchases.
- First-purchase benefit cannot be consumed twice under concurrent requests.
- Referral benefit cannot be consumed twice for the same entitlement period.
- A different entitlement period can be evaluated independently.
- Failed checkout does not consume a benefit.
- One order never receives both 7% discounts.
- A minor cannot read another minor's guardian or referral records.
- Admin access and consent changes are auditable.

## E. Release gates

This blueprint must be reviewed against the laws applicable to each market, including children's privacy, parental consent, consumer protection, cancellation/refund rights, and payment-provider requirements. Production payment processing must be operated by an appropriately responsible adult/legal entity through a lawful payment provider. This document is not legal advice and is not a compliance certification.
