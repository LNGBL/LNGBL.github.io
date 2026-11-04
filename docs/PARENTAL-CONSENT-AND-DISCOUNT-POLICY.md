# LangBlue — Parental Consent, First-Purchase and Referral Discount Policy

**Status:** Product/compliance specification only; not legal advice and not a production payment implementation.

## 1. Safeguards for users under 18

- A minor account must not finalize a paid order without verifiable approval from a parent or legal guardian.
- A username entered by the child is only a link request. It is not proof of identity, parental responsibility, or consent.
- The guardian must authenticate to their own account and explicitly accept the link request.
- Conservative default: the guardian separately approves **each purchase request**, including selected products, term, discount, and final price. Linking is not blanket purchase consent.
- Show the exact total and term before approval. No preselected add-ons, hidden renewal, or silent price changes.
- This specification does not collect bank-card details, bank credentials, or payment-card images. Any future real payment service must be operated by an appropriately responsible adult/legal entity through a compliant payment provider.
- Do not collect identity-document images by default. Any age/guardian verification must be proportionate and reviewed by a qualified privacy professional.

## 2. Guardian-link states and data

Suggested states: `not_linked`, `link_requested`, `guardian_confirmation_pending`, `linked`, `rejected`, `revoked`.

A link request expires after a configurable period. Either party can revoke it. Revocation blocks new paid requests. Free learning features remain available.

Store only: child account ID, guardian account ID, link state, consent purpose/policy version, timestamp and actor for request/approval/rejection/revocation. General admin lists should not expose birth dates, identity documents, contact details, or financial information.

## 3. First-purchase discount — 7%

- Available to an eligible under-18 account once only.
- Consumed only after the first eligible purchase is approved and successfully activated, not when a quote is viewed or a request is rejected/cancelled.
- Never applies to later purchases.
- Eligibility and final price must be decided server-side; browser values are display-only.
- Keep an auditable record of base price, rule/version, discount amount, final price, and activation reference.
- Default: discounts do not stack. The first-purchase and referral discounts cannot both apply to the same order.

## 4. Referral-network discount — 7%

- A verified referral relationship may create eligibility for one 7% discount use during a selected premium term.
- This is **one use per selected premium term**, not a discount on every purchase and not a recurring percentage of network purchases.
- A 7-day term and a 12-month term are separate term choices. The entitlement can be consumed at most once within the selected term.
- A used entitlement cannot be restored by changing plans, refreshing, changing devices, or creating another request.
- Reset only when a genuinely new premium term begins after the previous term ends, as stated in the published terms.
- Self-referrals, duplicate accounts, automated sign-ups, and coercive invitations must not create benefits.
- No cash commission, transferable balance, or unlimited multi-level reward is created.
- **Open product decision:** the beneficiary (inviter, invited account, or both) must be explicitly chosen and shown in published terms before implementation. Until then, keep referral discount disabled.

## 5. Consent and audit trail

For each minor purchase request, record child and guardian account IDs, products, term, base price, discount type/percentage/amount, displayed final price, policy version, guardian decision and timestamp, request state, and activation state/time if applicable.

Use append-only audit events for consent and admin decisions. Correct errors with a correction event rather than silently rewriting history. Never record full payment credentials or unnecessary sensitive information.

## 6. Consumer transparency

Before a purchase request, show selected products, exact term, original price, the single applicable discount, and final price. Explain when the discount is consumed/expired, whether the plan is one-time or recurring, cancellation/refund/complaint procedures, and support contact. Provide durable confirmation of the request and guardian decision.

No auto-renewal by default. Any future recurring plan requires separate explicit opt-in and a legally reviewed cancellation flow.

## 7. Privacy and security

- Apply purpose limitation, data minimisation, retention limits, and clear child-friendly notices.
- Distinguish consent to a purchase contract from the legal basis for processing personal data.
- Restrict guardian-link and purchase records with row-level access controls: child sees own status; guardian sees only linked child requests; staff access is role-limited and logged.
- Never trust client-side age, guardian IDs, discount flags, referral IDs, or prices for authorization.
- Never expose privileged database keys in browser code.
- Provide appropriate access, correction, deletion, and complaint processes, subject to lawful retention duties.

## 8. Legal review before production

This is a conservative product baseline, not a legal opinion. LangBlue serves multiple countries. Obtain qualified local advice before enabling paid services in each target market, covering minors' capacity and contracts, guardian verification, privacy/age thresholds, international data transfers, consumer information, digital-content cancellation/withdrawal, refunds, taxes, trader identity, marketing/referral rules, and accounting.

For Germany/EU, review the BGB rules on minors' legal capacity and consent, GDPR child-data safeguards, and EU consumer-information requirements. GDPR consent age and capacity to enter a paid contract are distinct legal questions.

## 9. Acceptance tests

1. Typing a guardian username alone never marks a child as linked.
2. Only the guardian's authenticated account can accept/reject a link.
3. A linked guardian approves each minor purchase request separately.
4. Rejected/cancelled requests do not consume the first-purchase discount.
5. Successful activation consumes the first-purchase discount exactly once.
6. A referral entitlement can be consumed only once per eligible term.
7. First-purchase and referral discounts never stack by default.
8. Browser edits to price, age, guardian ID, or discount flags do not affect server decisions.
9. Revoking a guardian link blocks new paid requests.
10. Ordinary admins cannot view bank credentials or unnecessary identity data.
