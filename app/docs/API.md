# Private API and MCP — 0.1.0

This pilot is a **single-owner private workspace**, not a multi-tenant public service. The mounted owner token grants access to every case in this deployment. Do not share it with untrusted users. A case UUID is an identifier, not an access credential. Case data is stored locally in SQLite; screenshot bytes are sent only to the configured isolated OCR worker, and are not retained by this service.

## Runtime

Node 22.13 or later with `node:sqlite`; current development check used Node 26.9.0. Dependencies: `@modelcontextprotocol/sdk` 1.32.2 and Zod 4.6.7. Use the project lockfile for reproducible builds.

| Variable | Meaning |
|---|---|
| `OSINT_TOKEN_FILE` | Required readable mounted secret containing 32–256 characters. Never put its value in source or URLs. |
| `OSINT_DB_PATH` | SQLite path, default `data/cases.sqlite`; persist the containing directory, including WAL files. |
| `PUBLIC_ORIGIN` | Exact scheme/host/port, no path; default `http://127.0.0.1:4321`. Host and Origin are enforced. |
| `BIND_HOST` | Defaults to loopback. Containers use `0.0.0.0` behind explicit ingress. |
| `PORT` | Defaults to 4321. |
| `OSINT_DIST` | Absolute or working-directory-relative built static frontend, default `dist`. |
| `OSINT_OCR_URL` | Configured service URL, default `http://ocr:8080/ocr`; only isolated `ocr` or loopback names are allowed. |

Start from project root with `node server/index.mjs` after mounting the secret, building the frontend and making the private data directory writable to the runtime UID. No credentials or case payloads are logged. The SQLite file is chmod 0600, its new directory 0700. Volume and backup access must remain private.

## Authentication and errors

- `POST /api/login` body `{token}` with exact `Origin` signs into an eight-hour in-memory session. Cookie: HttpOnly, SameSite=Strict, Secure under HTTPS. Restart invalidates sessions. Token never returns in responses.
- `GET /api/session` returns `{authenticated:true, expiresAt, mode:'single-owner-private'}` or 401.
- `POST /api/logout` clears the session.
- Assistant routes require a live browser session cookie; bearer-only assistant access is denied. All other `/api/*` routes require the session cookie or `Authorization: Bearer <mounted token>`. MCP accepts bearer authentication only.
- Cookie mutations require an exact Origin. Any supplied cross-origin Origin is rejected, including bearer calls. No CORS access is granted.
- Login attempts are limited to 10 per 15 minutes per direct peer; API/MCP requests to 180/minute per peer. At most two asynchronous investigation/OCR/MCP requests run concurrently. A reverse proxy should add its own public rate limiting; internal peer limiting intentionally fails closed for shared peers.
- Errors are JSON `{error:{code,message,requestId}}`; unexpected exceptions return a generic message. JSON input rejects unknown fields and wrong types. Body limit is 12 MB; endpoint schemas impose lower text limits.
- GET `/healthz` is unauthenticated and exposes only health/version, no case or credential data.

## REST contracts

All paths below are relative to `/api`. Responses are JSON unless noted. Use JSON request bodies with `Content-Type: application/json`.

| Method/path | Input | Result |
|---|---|---|
| GET `/assistant` | Browser session | `{connected,model}`; never the key |
| POST `/assistant` | `{key,consent:true}` | Validates against OpenRouter and holds the key in session memory; strict schema, 48 KB body limit |
| DELETE `/assistant` | — | Aborts pending work and removes the key; `{connected:false}` |
| POST `/assistant/chat` | `{messages:[{role,content}]}` | `{text,model}`; alternating user/assistant, starting and ending user; max11 messages, 8k each and 24k total characters. Fixed free router, no tools/case context/paid fallback. |
| GET `/cases` | — | Up to 100 recent case summaries |
| POST `/cases` | `{title,country?,claimedCompany?,officialDomain?}` | 201 full case. country SG/US/GB/AU/OTHER, default SG; officialDomain is a domain only and remains an unverified user nomination. |
| GET `/cases/:id` | — | Full private case |
| DELETE `/cases/:id` | — | Deletes case and its current training copies; `{ok:true}` |
| POST `/cases/:id/inspect` | `{domain}` | Appends passive lookup result, returns full case |
| POST `/cases/:id/evidence` | `{text}` or `{imageBase64,mimeType}` | Appends text or OCR transcript, returns full case. text max50k, PNG/JPEG/WebP only; worker enforces bytes/pixels. |
| POST `/cases/:id/reports` | `{channelId,requestId:UUID}` | 201 report draft. Reuse the same requestId on uncertain retry. Conflicting reuse returns409. |
| POST `/cases/:id/receipts` | `{reportId,status,reference,submittedAt}` | Full case. status submitted/acknowledged; nonempty external reference and past UTC ISO timestamp ending in `Z` required (for example `2026-11-06T09:00:00.000Z`). User declaration, not independently verified. |
| POST `/cases/:id/training` | `{text,consent:true,redactionApproved:true,label,campaignId,source}` | Separate approved record; label suspected_scam/benign, text max20k, source max200, campaignId an alphanumeric/underscore/hyphen slug. Automatic checks are incomplete; human review required. |
| DELETE `/cases/:id/training` | — | Withdraws all current copies for the case; `{ok:true}` |
| GET `/training/export` | — | NDJSON download of only approved copies. Case UUIDs and campaign identifiers become stable hashed pseudonyms; grouping is preserved. No original evidence or screenshots. |
| GET `/channels?country=SG` | country enum | Curated official references plus global references |
| POST `/assess` | `{text}` | Local rule-based hints, no neural inference and no safety clearance |
| POST `/redact` | `{text}` | Suggested redacted text; no automatic training consent |

Full case shape:

```
{id,title,country,claimedCompany,officialDomain,createdAt,updatedAt,
 evidence:[{id,text,sha256,engine,truncated,createdAt,assessment}],
 inspections:[{domain,checkedAt,registrar,registrationDate,expiryDate,
   nameservers,addresses,networks,cdnHints,originHost:null,sources,channels,errors,status,...}],
 reports:[{id,requestId,channelId,channel,subject,body,status,createdAt,...}],
 training:[], companyVerification:{status:'unverified_user_nomination',...},
 counts:{submitted,acknowledged,total,scope,externalTotal:null}, channels:[]}
```

Prepared reports never increment submitted counts. Submitted and acknowledged statuses are mutually exclusive per report; total counts their union. A repeated reference within a channel is rejected across report drafts. These are user-recorded submissions for one private case, not the number of independent victims or global complaints.

## Passive investigation boundary

Only fixed DNS and IANA bootstrap services, IANA-selected HTTPS RDAP servers and the fixed ARIN IP RDAP service are queried. User-supplied domains are never visited as websites. IP literals, credentials, URL paths, reserved/local names and non-public IP ranges are rejected or excluded from network lookups. HTTPS RDAP server hosts are checked for public resolution and redirects are disallowed. DNS answers that point to private addresses are displayed as such, never fetched.

Each external response is bounded to 1 MB and a nine-second request deadline; RDAP upstream hostname resolution has a separate three-second cap. Stages fail independently with visible partial results. ARIN referrals are left unresolved instead of following arbitrary destinations. Nameserver hints distinguish DNS/CDN indicators from the origin host. Registry/RIR allocations cannot establish the site operator or hosting origin. No reputation API or global report-count service is configured; the tool does not invent their results.

Registration records often omit registrar abuse contacts. An RDAP-listed abuse email is returned only when an actual abuse-role vCard supplied it, with its source/time. It remains an observed contact to recheck independently. A checked Jazwares general Contact Us reference is included, without guessing a dedicated legal inbox. Other company identification/contact verification requires an independent official source; a nominated domain and claimed company alone do not authenticate the recruitment approach. No email address is guessed.

## MCP

Endpoint: `/mcp`, stateless Streamable HTTP POST. Official SDK creates a fresh server/transport per request; no shared MCP session state. Supports SDK initialize/tools/list/tools/call. Send `Accept: application/json, text/event-stream` and bearer authentication. GET/DELETE are 405 in this stateless deployment. Host and optional Origin validation are the same as REST.

Tools share the REST service/store rules:

- `inspect_domain`, `find_reporting_channels`, `find_company_contact`, `assess_text`
- `list_cases`, `get_case`, `create_case`, `attach_evidence_text`, `extract_screenshot_text`, `inspect_case_domain`
- `prepare_report`, `draft_email`, `get_report_count`, `record_report_receipt`
- `preview_redaction`, `approve_training_example`, `withdraw_training_examples`, `export_training_examples`, `delete_case`

There are no sending, filing, registrar-submission or browsing tools. `draft_email` produces the same reviewable draft as `prepare_report`; authorities using web forms get a form-ready body, not an invented recipient. Deletion/withdrawal cannot recall exports or undo already trained models.

Static bearer authentication is suitable for this owner-controlled pilot. Public ChatGPT directory delivery still needs the platform’s currently accepted authentication/integration requirements; this document does not claim public submission readiness.

## Verification and limitations

`node --test tests/server.test.mjs` exercises domain/IP denial, risk-hint qualifications, case persistence/deletion, receipt dedupe, consent/withdrawal/export pseudonyms, HTTP cookie/Bearer/Origin denial, stateless MCP initialize/list/call, isolated OCR response integration, partial upstream failure, and absence of suspect-site fetches. OCR codec/container behaviour is separately covered by worker tests.

Central REST/MCP bounds: 500 cases; 100 approved training copies per case and 5,000 per installation. Deletion/withdrawal restores capacity.

Retention is manual deletion in this pilot. Take encrypted private backups or use full-volume encryption; SQLite is not application-encrypted. The owner token grants all workspace cases. No multiuser release, neural-network accuracy claim, public complaint database, automatic reporting or silent cloud OCR is implied.

Assistant credential lifetime, upstream destinations and limits: [ASSISTANT.md](ASSISTANT.md). These routes do not add MCP tools.
