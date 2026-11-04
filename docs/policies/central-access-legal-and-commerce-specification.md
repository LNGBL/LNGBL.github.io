# LangBlue Central Access — Legal, Subscription and Commerce Specification

**Document status:** implementation specification based on prior LangBlue decisions and the current website code.  
**Not legal advice. Not a statement of GDPR, US-law, Iranian-law, or other legal compliance.**  
**Production payment processing is out of scope for this implementation.** It must be operated by an appropriately responsible adult/legal entity through a lawful payment provider after jurisdiction-specific review.

## 1. Product and account model

- LangBlue has one central account for all active learning products: Grammar, Vocabulary, Deutsch, Arabic, Japanese, Kazakh, and Tajik.
- A subscription entitlement is attached to the central account, not separately to each product login.
- The server is the authority for entitlement status, included product IDs, start time, expiry, cancellation, and activation. Browser storage is only a display/cache layer and must never grant paid access by itself.
- A single entitlement may include several products. A code must not expand access beyond the product IDs attached to that entitlement.
- Current website code supports a 48-hour trial plan identifier (`trial_48h`). Earlier planning also mentioned a free allowance of 35 vocabulary words. The relationship between the 48-hour trial and 35-word allowance must be confirmed before they are combined or described as one offer.

## 2. Historic purchase and activation design

The previously discussed product flow was:
1. A learner selects products and a duration.
2. The learner sees the terms, final total, currency, discount eligibility and cancellation/refund information before any commitment.
3. Historically, the design used a manual Telegram contact at `@langBlue`, without a Telegram bot or payment API.
4. An administrator would review the purchase and issue a one-time activation/verification token.
5. The token would be checked by the server, consumed once, and attached to the learner's central account and permitted product IDs.
6. The token itself must never appear on a receipt or public page.

This is a record of the earlier product design, **not an enabled payment route**. This repository change does not collect money, bank details, payment references, transfer screenshots, or receipts, and does not confirm a payment. Production payments and any manual-payment administration must be handled by the responsible adult/legal entity through a lawful, reviewed process.

### Activation security requirements for a future authorised backend

- Generate tokens server-side using cryptographically secure randomness; store only a secure hash where practical.
- Bind each token to one account or a controlled claim process, a specific entitlement, allowed product IDs, duration, expiry, and status.
- Consume the token atomically so simultaneous requests cannot redeem it twice.
- Reject expired, revoked, already-used, malformed, or mismatched tokens with generic public errors.
- Never place secret tokens in source code, client JavaScript, URLs, analytics, logs, receipts, or public error messages.
- Keep activation/admin actions role-restricted and audit logged.
- Never treat a client-side success message, localStorage value, generated receipt, or user-provided screenshot as proof of payment or entitlement.

## 3. Subscription durations and price discrepancies

Earlier user planning recorded these durations: 7 days, 14 days, 21 days, 3 months, 6 months, and 12 months.

An older planning record contained these amounts:
- 7 days: 100,999 تومان
- 14 days: 263,999 تومان
- 21 days: 456,999 تومان
- 3 months: 734,999 تومان
- 6 months: 830,999 تومان
- 12 months: 950,999 تومان

The current `assets/js/langblue-commerce.js` contains different amounts:
- 7 days: 70,000 T
- 14 days: 140,000 T
- 21 days: 210,000 T
- 3 months: 900,000 T
- 6 months: 1,800,000 T
- 12 months: 3,650,000 T

These schedules conflict. Neither list should be silently presented as the legally approved production price list. A responsible operator must approve one current price table, currency/unit wording, tax treatment, and effective date before any real order or payment flow is enabled.

## 4. Discount rules and conflicts

### Latest documented 7% policy

- First-purchase benefit: 7% once on the account's first eligible purchase.
- Referral benefit: a qualifying invited learner may receive 7% once for each exact premium entitlement period (for example, one 7-day period or one 12-month period); it does not repeat on every transaction within the same period and does not auto-renew.
- No stacking: at most one 7% benefit applies to one order. If first-purchase and referral conditions both qualify, apply only one and identify the selected rule.
- Failed or abandoned orders do not consume the benefit.
- No self-referrals, fabricated accounts, coercive invitations, or public exposure of a minor's contacts/referral network.

### Older/current-code promotion logic that conflicts with the latest policy

- The current commerce code has a 10% discount for selecting all active products on the 12-month plan.
- The current commerce code defines 20% festival entries, but the 12-month display calculation applies half of that rate (10%).
- The current receipt script applies a 10% community-access discount when a Supabase request is approved.
- Earlier assistant-generated planning mentioned 15% for a 12-month all-products bundle; that value is not the current code value and was not a user-confirmed final policy in the retrieved record.

These promotions must not be stacked or combined with the 7% policy by guesswork. The 7% policy is the latest documented policy; bundle, festival and community discounts remain legacy code paths until an authorised operator formally resolves their precedence, eligibility, funding and effective dates. A client-side price calculation is never the authority for a real charge.

## 5. Minors and guardian consent

- For a learner under 18, entering a guardian username or sharing a referral link is not consent.
- The guardian must sign in to their own account and explicitly accept a clearly described consent request.
- The learner and guardian must be shown what the guardian can see, which actions require consent, and how consent can be revoked.
- Store only the account identifiers, consent scope, policy version, status and timestamps needed to operate the relationship. Do not request identity documents by default.
- Revocation stops future actions that require guardian approval. Existing entitlements and legally required records must be handled under reviewed terms and applicable law.
- Do not expose a minor's contacts, referral network, purchase history, or family details to other learners.
- The guardian request/reject/revoke schema and JWT-protected Edge Function are deployed. Acceptance fails closed until a trusted, independent adult age-verification integration records a valid verification. Feature-specific server-side enforcement is not yet wired into all existing product APIs.

## 6. Consumer information, cancellation and refunds

Before a real purchase can be offered, the responsible operator must publish clear, locally reviewed information covering:
- legal seller/operator identity and contact details;
- exact product scope and subscription duration;
- total price, currency, taxes and any unavoidable fees;
- when access begins and when it expires;
- renewal behavior (no automatic renewal unless separately and clearly agreed);
- cancellation method and effective time;
- refund eligibility, timing, method and any lawful exceptions;
- complaint/support channel and response expectations;
- what happens to access after cancellation, expiry, refund, chargeback, or account deletion.

No specific refund window, withdrawal waiver, non-refundable term, tax treatment, or automatic-renewal rule is established by the retrieved user decisions. Do not invent one or claim the user has waived statutory rights. These terms require jurisdiction-specific legal review before launch.

## 7. Privacy, geography and security

- Privacy is a priority for all learners, including users in Iran.
- Where country-specific access or pricing is eventually required, use the minimum coarse country/region signal needed. Do not retain raw IP addresses as a routine profile attribute or use IP as identity proof.
- Explain when approximate country detection is used, what it changes, and how a learner can correct an incorrect result.
- Do not infer age, identity, or legal consent from IP location.
- Analytics consent must remain separate, optional, and revocable; refusing analytics must not block ordinary learning access.
- Collect only information necessary for the account, consent and entitlement.
- Never collect or store full card numbers, CVV, passwords for payment accounts, or unnecessary bank credentials in LangBlue.
- Restrict administrator views by role; log sensitive administrative decisions; expose only the minimum account and entitlement details needed for support.
- Define and publish retention periods. Separate records that must be retained for legal/accounting reasons from ordinary profile and learning data.
- Account deletion should be carried out immediately after a verified request, without an arbitrary waiting period. Any records that must legally be retained are separated from the active account, minimised, access-restricted, and retained only for the legally required period; do not promise deletion of records that law requires the operator to keep.
- This specification does not certify compliance with GDPR, US state privacy laws, Iranian law, or any other regime. The responsible operator must obtain advice for each market in which the service is offered.

## 8. Receipts and administration

- A client-generated summary is not a tax invoice, payment receipt, proof of transfer, or proof of activation.
- A receipt/request reference must never contain an activation token or sensitive financial data.
- No payment credential or transfer screenshot should be requested in this website UI.
- Admin functions must require server-side role checks; hiding a button in the browser is not authorisation.
- Admin actions affecting entitlement, guardian consent, discounts, refunds, or account status must be auditable.
- Do not expose payment details, identity documents, or unrelated family information in an admin dashboard.

## 9. Current implementation boundary

The Central Access website UI may:
- display the signed-in account and server-reported entitlement status;
- display included products and expiry based on trusted server data;
- explain the policy and clearly label any unimplemented process;
- keep optional analytics consent separate from core access.

It must not, in this implementation:
- collect or process real payments or bank transfers;
- request payment credentials, transfer screenshots, or financial receipts;
- claim a payment is verified;
- issue or redeem real activation tokens from the browser;
- activate paid entitlements from localStorage or client-only discount calculations;
- represent guardian consent as accepted unless the server has recorded the guardian's explicit action.

## 10. Release checklist

- [ ] Responsible adult/legal entity and lawful payment provider identified for production.
- [ ] Current prices, currency, tax treatment and effective date approved.
- [ ] Legacy 10% community, 10% bundle, festival and older 15% bundle rules reconciled with the 7% policy.
- [ ] Authoritative paid-order ledger available before 7% discount eligibility can be activated.
- [ ] Country-specific legal review completed for every market.
- [ ] Consumer cancellation/refund/renewal terms reviewed and published.
- [x] Guardian consent request/reject/revoke backend deployed with RLS and restricted RPCs.
- [ ] Trusted independent guardian age-verification integration configured and acceptance tested.
- [ ] Guardian consent scopes enforced by every feature/API that requires them.
- [ ] Entitlement/token issuance and redemption are server-authoritative, atomic and audited.
- [ ] Admin roles and audit logging verified.
- [ ] Privacy notice, retention periods, account deletion and analytics consent reviewed.
- [ ] Security tests pass; no secrets or financial credentials are exposed to the browser.
