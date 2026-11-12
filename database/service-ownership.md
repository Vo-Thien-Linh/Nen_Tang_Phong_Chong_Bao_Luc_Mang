# PostgreSQL ownership by service

The project can keep one Supabase PostgreSQL instance while services are being separated. Each table still needs one write owner. Other services should use the owning service API or a read-only projection.

| Data | Write owner | Intended use by other services |
| --- | --- | --- |
| `users`, `role_audit_logs`, `verification_codes`, `user_settings`, `friendships` | User/Auth | Profile, auth, role and friendship reads through User/Auth APIs |
| `posts`, `comments`, `post_reactions`, `community_groups`, `community_group_members`, `community_group_posts`, `community_group_moderation_logs` | Social Content | Moderation reads through `moderation_content_read_model`; state changes become commands to Social Content |
| `reports`, `appeals`, `moderation_logs`, `ai_override_logs`, `user_trust_logs` | Moderation | Admin dashboard reads through Moderation APIs |
| `notifications` | Realtime / Notification | Producers request notification creation through this service; feed events use PostgreSQL `NOTIFY` during the shared-database phase |
| `conversations`, `messages` | Messaging (currently the FastAPI platform API) | Other services use Messaging API |

## Current migration debt

The current shared DB credentials do not enforce these owners yet. Some Node repositories write moderation state into `posts`/`comments`, update account sanctions in `users`, and insert rows in `notifications`. The FastAPI auth routes and Node user service both write user data. These paths must move behind owner APIs before per-service DB roles can safely restrict writes.

The Moderation service remains the aggregation API for the admin dashboard. Its image review queue and uncertain-image export read `moderation_content_read_model`; report and appeal lists read `moderation_report_read_model` and `moderation_appeal_read_model`. Migration `010_moderation_content_read_model.sql` defines these read projections. They are read-only by convention; DB grants should enforce that after service-specific DB roles are introduced.

## Enforcement path

1. Keep a single PostgreSQL instance, but create a DB role per service and grant writes only to the owning service's tables.
2. Replace cross-owner writes with commands over internal APIs. Keep foreign keys and stable IDs during this stage.
3. Grant dashboard/reporting reads through explicit views or the Moderation API; avoid broad write access for the dashboard.
4. Split schemas or databases only when the team needs independent scaling or deployment and has removed cross-service joins.
