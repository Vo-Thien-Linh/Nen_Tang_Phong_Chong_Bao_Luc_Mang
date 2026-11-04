# Service boundaries and API ownership

## Decisions

- FastAPI `/api/auth/*` is the only JWT issuer. Express services validate those JWTs with the shared secret; they do not issue replacement tokens.
- FastAPI currently owns messaging REST endpoints and the `/api/messages/ws/{user_id}` WebSocket. The Express notification service owns notification APIs and the SSE stream. Chat is not part of the notification service.
- Express post service owns posts, comments, reactions, uploads, and content visibility state.
- Express moderation service owns reports, appeals, moderation decisions, and the admin review dashboard APIs.
- The standalone AI Inference Service owns `/api/v1/moderate/*` and `/api/moderate/*`. It imports the inference router and model code, but no longer imports the complete `backend.main` application.
- The Node user service owns `/api/users/*` profile and role management today, while FastAPI owns auth and issues JWTs. This means the User/Auth context is still split across Node and FastAPI. Do not describe it as a single independently deployed User/Auth service until those APIs are consolidated.

## API routing

| API path | Current receiving service | Responsibility |
| --- | --- | --- |
| `/api/auth/*`, `/api/v1/auth/*` | FastAPI platform application (port 8000) | Register, login, OTP, password recovery; sole JWT issuer |
| `/api/users/*` | Express user service (port 5001) | Profiles, roles, sanctions, user administration |
| `/api/posts/*`, `/api/upload/*` | Express post service (port 5002) | Posts, comments, reactions, shares, uploads, image appeals |
| `/api/reports/*`, `/api/appeals/*`, `/api/admin/*` | Express moderation service (port 5003) | Reports, appeals, decisions, moderation dashboard |
| `/api/notifications/*`, `/api/realtime/stream` | Express notification service (port 5004) | User notifications and SSE broadcast stream |
| `/api/friends/*`, `/api/messages/*`, `/api/settings/*`, `/api/search/*` | FastAPI platform application (port 8000) | Friendships, chat, settings, search |
| `/api/v1/moderate/*`, `/api/moderate/*` | Standalone AI inference service (port 8001) | Text and image analysis |

`/api/*` is the canonical public route family. `/api/v1/*` remains as a compatibility alias where the FastAPI app currently exposes it.

## Gateway configuration

The gateway route registry is in `gateway/server.js`. Upstream URLs can be configured with `PLATFORM_SERVICE_URL`, `AI_SERVICE_URL`, `USER_SERVICE_URL`, `POST_SERVICE_URL`, `MODERATION_SERVICE_URL`, and `REALTIME_SERVICE_URL`. Local defaults use loopback; Docker Compose sets service DNS names. Browser API calls use the gateway as their base URL. Only the gateway and frontend publish host ports in the microservices Compose file.

Current limitation: the AI service has its own FastAPI app, but its router and inference modules still live under `backend/app`. Node route modules have moved under their owning service folders, and user/notification controllers and the notification repository have moved too. The remaining controllers and repositories still live in `backend/src` and are imported by the service-local routes; continue extracting those layers incrementally. PostgreSQL `NOTIFY` carries feed events between Social Content, Moderation, and Realtime processes during the shared-database phase. The User/Auth APIs are not yet consolidated into one runtime service.

Table write owners and the migration path are recorded in `database/service-ownership.md`.
