# LangBlue Teachers — Product and implementation specification (draft)

## Product rules

### Free teacher presence
The following features are free and must not depend on a paid subscription:
- Create and maintain a teacher profile.
- Show the teacher's language(s), level, biography and optional portrait.
- Connect learners through the central LangBlue account, with learner confirmation.
- Display aggregate learner counts and eligible teaching metrics.
- Participate in ranking and qualify for Blue Star milestones.
- Set and display class prices and the available class format.
- Provide teacher-selected online-class links/contact methods.

### Optional paid content publishing
A teacher subscription is only for publishing educational posts and content on LangBlue. It is optional; it must not gate the teacher directory, learner connections, class listings, pricing, basic statistics, ranking, or Blue Star.
- Proposed initial free period: one month, beginning at activation of the content-publishing feature.
- Confirmed publishing-subscription prices (Iranian toman): 3 months = 350,999; 6 months = 650,999; 12 months = 950,999. These prices buy permission to publish/share teacher-created educational content only; they do not buy learner access, learner connections, a teacher profile, or access to students.
- Expiry disables new paid publishing only. It must not delete the profile, existing published content, connections, metrics, or class listings. Content visibility after expiry requires a separate product decision; default recommendation is to keep existing approved posts visible but prevent creating/editing paid content.

### Teacher-defined class pricing
Class prices are set by the teacher and kept separate:
- Individual / private class price.
- Group class price, with clear indication whether the price is per learner or for the whole group.
- Currency and class duration must be explicit.
- LangBlue must distinguish the teacher's class fee from any LangBlue content-publishing subscription.
- Do not imply LangBlue collects class payments unless a separate payment/escrow product is designed.

### Online class/contact methods
Teachers may select any supported contact methods, such as a work phone number, Google Meet, WhatsApp group, Skyroom, or another approved service. Each field is optional and explicitly published by the teacher. Validate URL schemes and display a warning before revealing a phone number or joining link. Do not expose a learner's phone, email, address, or other personal information to a teacher through the connection-count feature.

### Learner connections
- Use the central LangBlue Auth user ID.
- A learner must explicitly confirm a connection to a teacher.
- Enforce one active connection per learner/teacher pair at the database level.
- Count unique confirmed learners, not clicks, invitations, phone numbers, or unverified sign-ups.
- Provide revoke/unlink and abuse-report flows.
- Public counts and rankings are aggregate-only.

### Blue Star milestones
- Month 1: more than 50 unique confirmed learners.
- Month 6: at least 350 unique confirmed learners.
- Year 1: at least 680 unique confirmed learners.
- Issue a distinct badge for each reached milestone; issue the final Blue Star only after completion of year one and meeting the annual threshold.
- Record milestone dates and decisions server-side. A user must not be able to edit learner counts, start dates, token balances, or badge state directly.

### Teacher ranking
Use aggregate confirmed learner count, verified satisfaction, valid teaching hours and Blue Star status. Keep weights configurable, publish the ranking method, and avoid treating tiny review samples as reliable satisfaction rates. Teaching hours must represent valid educational activity, not simply a page left open.

## Token / trust policy — partially clarified; no implementation yet
- The stated base rule is 25 tokens per 50 unique confirmed learners.
- The “half” is intended to represent trust between the teacher and the LangBlue platform; the trusted-teachers section is related to that trust concept, not a paid access tier.
- The owner clarified that the 100-token threshold is tracked separately for each teacher, not across the entire trusted-teachers section.
- The precise arithmetic for the “half” allocation associated with each 50-learner token milestone still needs to be written unambiguously before implementation, including whether fractional tokens are allowed.
- The three-year condition and its start point also need a precise rule.
- Do not mint, transfer, or spend tokens until the arithmetic, scope of the 100-token threshold, and three-year clock are explicitly resolved. Once defined, token events should be append-only and idempotent.

## Database and security design (proposed; not yet created)
Suggested tables:
- `teacher_profiles`: owner user ID, public profile fields, verification state.
- `teacher_connections`: teacher ID, learner ID, status, consent timestamps; unique learner/teacher pair.
- `teacher_content`: authored educational posts, moderation/publishing status.
- `teacher_content_entitlements`: content-publishing plan, start/end timestamps, payment/admin verification state.
- `teacher_class_offers`: individual/group pricing, currency, duration, format.
- `teacher_contact_methods`: explicitly public contact type/value and visibility.
- `teacher_activity`: validated teaching activity events.
- `teacher_reviews`: learner feedback, with anti-abuse limits.
- `teacher_milestones`: server-issued milestone badges.
- `teacher_token_ledger`: append-only token events, only after the token policy is finalized.

Use the existing central Supabase Auth identity. Keep all new exposed tables under RLS; use server-side validation for entitlements, milestones, ranks, and token events. Never trust editable user metadata or client-supplied token/count fields. Do not place activation/verification secrets in GitHub Pages JavaScript.

## Cross-product policy and landing-page visibility
- Treat the teacher network and referral offer as one platform-wide policy, not a separate benefit limited to a single learning module.
- The landing page must name all five current focus areas: LangBlue Grammar, LangBlue Vocabulary, LangBlue Deutsch, LangBlue Japanese, and LangDesert Arabic.
- Show a dedicated teacher-network section directly after the landing-page product grid so visitors can discover the policy from the main page.
- Explain the free teacher profile/directory and learner connections, the 35-registration / rolling-three-week referral condition, the one-time 5% teacher publishing-subscription reward, and the potential 3% learner discount for eligible products.
- Distinguish planned functionality from active functionality. Until the server-side referral, eligibility, and checkout rules are implemented and tested, the landing page must say the mechanism is being prepared and must not imply that discounts can already be redeemed.
- Do not treat the teacher content-publishing subscription as a fee for being listed in the directory.

## Teacher referral offer
- Each teacher may have a unique referral link.
- Attribute a learner to a teacher when the learner completes registration through that teacher’s unique referral link; a click alone does not count.
- If 35 unique eligible learners register through that link within a rolling three-week window, the teacher earns a 5% discount on their own teacher content-publishing subscription once per teacher (not repeatedly for every later group of 35).
- The offer is a shared platform policy across LangBlue Grammar, LangBlue Vocabulary, LangBlue Deutsch, LangBlue Japanese, and LangDesert Arabic; it is not five separate referral schemes.
- Referred learners may receive a 3% discount on eligible LangBlue products. Each teacher can choose which of their own teacher-created products/content are eligible for this offer; do not automatically discount every product or subscription. Product eligibility must be explicit and checked server-side at checkout.
- These referral discounts do not stack with the all-products discount or the 10% 12-month discount. The checkout must apply the non-stacking rule deterministically and show which discount was applied.
- Count unique eligible registrations server-side; exclude repeated clicks, duplicate accounts, self-referrals, and unverified registrations. Record the referral window, attribution, eligibility, and discount redemption server-side. Do not grant rewards client-side.
- Until implementation and server-side tests are complete, this offer is a published product plan only and must not be represented as redeemable.

## Humanity
The verified-institutions directory is out of scope for now. Do not create or show a Humanity institutions section until the owner provides the institutions to list.

## Explicitly removed
The social discount / “fair access to learning” program for ages 10–69 is discontinued. Do not reintroduce its page, welcome overlay, checkout discount, or promotional copy. Historical database records should be retained but not used for new discounts unless the owner later requests a data-retention action.

## Implementation order
1. Complete audit of current GitHub pages, Supabase policies, subscriptions and payment-request flow.
2. Review this specification and confirm the token split and publishing-subscription prices.
3. Add schema via a reviewed migration; do not rewrite existing central-account tables unnecessarily.
4. Implement server-validated connections, publishing entitlements, badges and metrics.
5. Build teacher directory/profile/content/class-offer pages.
6. Test RLS with anonymous, learner, teacher and admin identities; test duplicates, expiry, revoked connections and forged token/count requests.
7. Deploy only after tests and a reviewable pull request.
