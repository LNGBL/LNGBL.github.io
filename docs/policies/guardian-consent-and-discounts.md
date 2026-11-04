# LangBlue — Guardian and 7% Discount Policy

**Status:** Product policy only. This PR does not implement payments, bank transfers, receipt uploads, or purchase activation.

## Guardian approval

- A user under 18 may enter a parent/legal guardian's LangBlue username to send an invitation.
- The link stays **pending** until the guardian signs in to their own account and explicitly accepts.
- Before acceptance, show what the guardian can view, what approval covers, and how to revoke it.
- A username entry or referral link is never proof of consent.
- Revocation stops future actions that require guardian approval. Handle existing entitlements and legally required records under the published terms and applicable law.
- Collect only the account identifiers, consent scope, policy version, status, and timestamps needed to operate the link. Do not collect identity documents by default.

## Discount rules

- **First purchase:** 7% may be used once on the account's first eligible purchase.
- **Referral:** a qualifying invited user may receive 7% once for each exact premium entitlement period, such as 7 days or 12 months. It does not repeat on every transaction in that period or renew automatically.
- **No stacking:** one order can receive only one 7% benefit. If both rules qualify, apply one and explain which rule was selected.
- A failed or abandoned order does not use the benefit. Production eligibility must be confirmed by the authorised payment process; this PR does not build that process.
- Do not allow self-referrals, fabricated accounts, coercive invitations, or public exposure of a minor's contacts/referral network.

## Privacy and administration

- Minors and guardians should see only the information needed for their own linked accounts and accepted consent scope.
- Admin access must be role-restricted and logged. Show only account identifiers, guardian-link state, consent status, promotion type/period, and the minimum purchase status needed for support.
- Never expose card numbers, payment credentials, identity documents, or unrelated family information in the dashboard.
- Keep consent and discount decision records only for a documented, legally reviewed retention period.

## Before any production launch

The responsible operator must obtain jurisdiction-specific legal review for age/guardian consent, privacy, consumer rights, cancellation/refunds, and payment-provider requirements. Production payments must be operated by an appropriately responsible adult or legal entity through a lawful payment provider.

This is a product-design policy, not legal advice or a claim of GDPR or other legal compliance.
