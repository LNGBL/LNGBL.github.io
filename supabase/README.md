# LangBlue backend

This directory documents the Supabase-backed account, learning, teacher, and administration services for LangBlue.

## Central administration

The central administrative identity is stored in the private-access-controlled `public.platform_admins` table. The browser never receives a service-role key or a shared administrative secret. Every privileged Edge Function validates the Supabase session and checks the authenticated user ID against this table on the server.

### Edge Functions

- `langblue-admin-access`: returns the authenticated account's central admin status and enabled management modules.
- `langblue-admin-workflow`: serves the central admin dashboard, teacher-profile review, class-offer publication, teacher-content moderation, learner contribution moderation, admin-team management, operational status, and an audit trail.
- `langblue-community-access`: handles user assistance requests and central-admin review decisions.
- `admin-create-code`: creates activation codes after server-side central-admin authorization.
- `langblue-research-dashboard`: returns protected research dashboard data after central-admin authorization.
- `activate-code`: redeems activation codes for authenticated users.
- `langblue-auth`: username/password bridge for the central account.
- `langblue-android-handoff`: Android device handoff workflow.

### Administrative workflows

1. A teacher submits a profile; it remains pending until a central admin approves or rejects it.
2. Approval activates the profile and synchronizes the public teacher directory through the database trigger. Rejection allows the teacher to revise and resubmit.
3. Teachers submit class offers as drafts and request review. Only a central admin can move a reviewed offer to the public `open` state.
4. Teachers submit educational material as drafts and request review. Only a central admin can publish it.
5. Learner content contributions remain ineligible for exam use until a central admin approves them.
6. Decisions are written to `public.admin_workflow_events`, which has RLS enabled and no client-role privileges.

The management page is `pages/admin.html`. The teacher submission interface is `pages/teacher-network.html`.

## Security requirements

- Never place the Supabase service-role key or any server secret in GitHub Pages or browser JavaScript.
- Do not treat a hidden frontend link as authorization; the Edge Function performs the actual permission check.
- Keep public teacher and class views free of authentication UUIDs.
- Keep RLS enabled and use narrowly scoped policies for user-owned drafts.
- Privileged workflow state changes are performed by the authenticated, server-authorized Edge Function.

## Deployment notes

The Supabase project configuration declares `verify_jwt = true` for administrative functions. After a database schema change, verify the migration, relevant RLS policies, Edge Function deployments, and Supabase security/performance advisors before considering the work complete.
