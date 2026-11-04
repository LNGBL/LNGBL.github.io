# LangBlue — Guardian Consent and Discount Policy (Design Specification)

**Status:** Product and compliance design only. This document does not authorize or implement payment collection, bank transfers, receipt handling, or financial activation.

## 1. Scope and principles

This policy covers accounts identified as under 18, guardian supervision, referral attribution, and promotional discount eligibility. Before launch, the operator must obtain jurisdiction-specific legal review and use a lawful payment provider operated by an appropriately responsible adult or legal entity.

Core principles:
- Best interests and safety of the minor.
- Clear, informed, affirmative guardian consent where required.
- Data minimisation, purpose limitation, access control, and retention limits.
- No public display of a minor's age, guardian identity, or purchase information.
- No dark patterns, pressure, or penalty for declining consent.
- A referral relationship must not be represented as parental consent or proof of payment.

## 2. Guardian connection

1. The minor may enter a LangBlue username belonging to a parent or legal guardian.
2. Entering a username creates only a **pending invitation**; it does not establish consent or supervision.
3. The guardian must sign in to their own account and explicitly accept the connection after seeing:
   - the minor account being linked;
   - what supervision means;
   - what account and purchase metadata the guardian can see;
   - how to revoke the connection.
4. Store a minimal consent record: guardian account ID, minor account ID, consent scope, policy version, timestamp, and status. Do not store identity documents unless a reviewed legal requirement makes them necessary.
5. The guardian can revoke consent. Revocation stops future guardian-dependent purchases and discounts; it must not erase lawful audit records or improperly remove already-paid entitlements.
6. If no guardian account exists, keep the status as **guardian confirmation required**. Do not infer consent from a checkbox entered by the minor alone.

## 3. First-purchase discount

- A verified eligible minor account may receive **7% off one first eligible purchase**.
- Eligibility is account-based and consumed only after the relevant purchase is confirmed by the authorised payment process. A draft order, abandoned checkout, or rejected payment must not consume it.
- The first-purchase benefit cannot be transferred, sold, stacked with another 7% promotion, or reissued by changing a referral link.
- If the first order is cancelled/refunded, eligibility restoration must follow a documented refund and consumer-rights policy; it must not be decided ad hoc.

## 4. Referral discount

- A qualifying referred account may receive **7% at most once per premium subscription period**.
- A period is the exact entitlement interval purchased, such as 7 days or 12 months. The eligibility key should be unique to the account and that entitlement period, not merely the calendar month.
- For each period, record whether the referral discount was reserved, consumed, released after a failed/cancelled order, or voided for abuse.
- The same period cannot receive the referral discount more than once, even if multiple referral links or network members are involved.
- A referral discount does not repeat on every transaction during the same entitlement period and does not automatically renew with the subscription.
- Referral attribution must be transparent. Do not reward self-referrals, fabricated accounts, coercive invitations, or undisclosed spam.
- A referral network must not expose the minor's contacts or social graph to other users. Show only the minimum information necessary to explain eligibility.

## 5. Non-stacking rule

Only one 7% benefit may apply to a single order:
- first-purchase discount, or
- referral discount for the relevant premium period.

Never add the two together. If both appear eligible, show the selected rule and the reason the other was not applied before the user proceeds.

## 6. Admin access and audit

Administrators should see only role-appropriate information:
- account identifier and eligibility state;
- guardian connection state and guardian account identifier;
- consent timestamp and policy version;
- discount type, period identifier, percentage, and eligibility outcome;
- purchase status supplied by the authorised payment provider.

Do not expose full payment credentials, card numbers, identity documents, or unrelated family information in the admin dashboard. Log privileged access and changes. Keep an append-only event history for consent and discount decisions, with a retention schedule approved for the applicable jurisdiction.

## 7. User-facing disclosures

Before a guardian accepts, explain in plain language:
- what is being approved;
- what the guardian can see and manage;
- whether approval is required for purchases;
- how to withdraw consent and contact support.

Before applying a discount, show the original price, the 7% reduction, the final price, the promotion type, and the one-use/period limitation.

## 8. Safety, privacy, and legal review gates

Do not enable production purchases for an under-18 account until:
- the operator has confirmed the applicable age and consent rules for each target country;
- the guardian's authority and consent flow have been reviewed;
- privacy notice, terms, refund/cancellation policy, and retention schedule have been reviewed;
- a lawful payment provider and responsible adult/legal entity operate the payment process;
- access controls, audit logs, and data deletion/retention handling have been tested.

This is a product-design checklist, not legal advice or a certification of compliance with GDPR, consumer law, or any other law.
