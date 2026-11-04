# LangRed — Policy & Compliance

**Purpose:** Russian-language learning, cultural literacy, vocabulary, grammar, pronunciation, and spaced review.

## Operating principles
- Educational and culturally descriptive content; no political persuasion, war propaganda, or state-affiliated messaging.
- The Ukrainian flag in the loading screen is a visual reference to the wider Slavic cultural context. The Russian text is a language-learning welcome message, not a political endorsement.
- No blanket exclusion of Russian speakers or residents based solely on language, nationality, or an approximate IP country.
- Apply sanctions, export-control, payment-provider, and platform restrictions only where they actually apply to the operator, service, transaction, or user relationship. Reassess against current official rules and obtain qualified legal advice where needed.
- Do not treat browser geolocation, profile country, or a single IP lookup as verified legal residence.
- Use the LangBlue central account, authentication, subscription/access checks, and shared user-state storage. Keep the LangRed learning state namespaced under `langred_ru`.
- Use the existing Supabase publishable key in the browser. Never place service-role or secret keys in client code.
- Optional analytics must follow the central consent setting. Core learning should not depend on optional analytics.
- Unknown or unavailable region signals must not block ordinary learning access.
- Preserve user data deletion and account rights through the central account workflow.

## Implementation status
- Initial LangRed vocabulary/grammar notebook and spaced-review UI.
- Shared account integration through the existing LangBlue Supabase client and `user_state`.
- Local fallback if a learner is signed out or synchronization is unavailable.
- Legal compliance is not certified by this document.
