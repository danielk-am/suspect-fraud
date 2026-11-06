# Hosted owner pilot acceptance

Initial baseline verified 6 November 2026. App version 0.1.0, baseline runtime source commit `5ef7bb782892875aed1c01b79cf0d99042bef2d8`. Later documentation changes do not imply a new runtime build. All hosted acceptance records were synthetic and were deleted after verification. No incident report was submitted by the app.

- Workspace: https://osint.alkamy.ltd/tools/suspect-fraud/
- Recruitment route: https://osint.alkamy.ltd/tools/suspect-fraud/recruitment-scams/
- MCP: https://osint.alkamy.ltd/mcp

Current runtime is the BYOK/navigation repair `b1fb02a932f1a2579c961f974bff4a0bd22c5864` described below. The original acceptance table records the initial baseline.

## Observed initial acceptance

| Check | Result |
|---|---|
| Public ingress | Trusted browser-facing HTTPS through Cloudflare; Full (strict) to the matching origin certificate. HTTP redirects to HTTPS. Both app paths and health respond successfully. |
| Private access | Anonymous REST/MCP and invalid bearer rejected. Login uses Secure, HttpOnly, SameSite=Strict cookie. Missing mutation Origin and wrong Origin rejected; cookie-only MCP denied. |
| Runtime identity | Running app image `sha256:4c08f83a70b99453028bd9790e44663576768a2e441f81c44b83098b7e712fd0`; OCR `sha256:1966c3da5079005462925d5a64ca6a65775b8b484e0c258278a38d4442a0fec7`. |
| Confinement | Two healthy non-root containers, read-only roots, dropped capabilities, no published host ports, bounded CPU/memory/PIDs/logs. Exact generated networks and subnets verified. |
| OCR isolation | Worker has exactly its internal evidence bridge; outbound TCP denied. App reaches worker health and real Tesseract OCR through the public authenticated evidence route. |
| Evidence | Pasted text and synthetic screenshot transcript saved privately. Original image bytes absent from returned/stored evidence representation; no automatic training copy. |
| Reports | Draft excludes itself from count. One explicitly synthetic user-declared receipt produces count one; repeating the receipt keeps count one. No external submission made. |
| Training | Consent false rejected; approved redacted synthetic copy exported with pseudonymous case/campaign IDs; withdrawal removes the copy. No promoted model. |
| MCP | Initialization, 19-tool discovery, country-channel and private-count calls passed. |
| Research | Passive example.com DNS/RDAP/network inspection completed through the public app. No suspect website was visited. |
| Recovery | SQLite online backup restored into a separate temporary volume; integrity and synthetic case/evidence/report contents verified. Temporary restore volume removed. |
| Restart | Supported manager restart recreated healthy containers with expected images/networks. Synthetic evidence/count persisted, then case deletion returned 404 and database cases/training were confirmed empty. |
| Leakage checks | Both service logs and built public assets contained neither owner token nor the selected synthetic evidence markers. This bounded check is not a universal data-loss-prevention audit. |

Independent review separately checked public TLS/health/auth denials, reviewed actual runtime proof and the consistent separate-volume restore evidence. Final review scope is recorded in the private delivery pack. No physical-device, penetration-test certification or multiuser acceptance is claimed.

## Deployment findings and corrections

The manager's create response preceded asynchronous runtime completion. Its stopped configuration initially lacked route labels despite a saved app URL; supported PATCH regenerated routing before startup. The first start exhausted the host's default Docker subnet pool before containers existed. Dedicated, non-overlapping small ranges were reviewed and assigned without changing unrelated networks or daemon defaults. See [deployment](DEPLOYMENT.md) before importing Compose into Coolify: ordinary network declarations alone did not preserve OCR isolation under its parser.

The browser-facing hostname uses the existing Cloudflare Origin CA setup through a proxied record and strict TLS. No TLS validation was disabled when sending credentials. Default Python urllib User-Agent received Cloudflare error 1010; a truthful descriptive acceptance client User-Agent, Node client and browser-style checks reached the application. Client-specific edge filtering may affect other integrations; do not weaken zone-wide controls on that assumption.

## Limits and operating handoff

This is one private owner installation, not an open public upload service or a marketplace-ready OAuth integration. Retrieve the owner credential through the operator's approved secret store and enter it privately; it grants all cases in the installation. The MCP requires a bearer Authorization header, never a query-string credential. Cookie sessions expire after eight hours and are lost on service restart.

The backup exercise proves a same-host, synthetic-only restore. No recurring backup job, encrypted off-host backup or disaster-recovery service was installed. Before retaining valuable evidence, the operator must decide private backup retention, encryption and off-host recovery. Deletion cannot recall exports or backups. SQLite is not application-encrypted, and original screenshots must be preserved separately by the case owner.

The initial baseline assistant was disconnected; the current OpenRouter BYOK implementation is described below. Warning observations use bounded heuristics; neural training remains offline and NEEDS_EVIDENCE. Container isolation reduces exposure but shares the host kernel. Public ChatGPT listing remains blocked by the previously observed skills-only submission restriction; hosted deployment does not establish submission or approval.

Initial rollback is to stop only this new managed service and remove only its public route, preserving its external case volume, credential, reviewed source and images. Restart recovery was exercised; service removal and a failed-upgrade rollback were not exercised. The original source prerelease archive/checksum remains unchanged.

## BYOK/navigation repair rollout

Runtime source `b1fb02a932f1a2579c961f974bff4a0bd22c5864` is deployed through the existing management API. The app image is `alkamy/suspect-fraud-app:0.1.0-b1fb02a`, identity `sha256:7cbb1fb056ccc2c1491bdb1862cda58a2ab1e52e4eeb8c54525e14cf2219a7f5`; the OCR image is unchanged. Private routes resolve unlock and case prerequisites. OpenRouter BYOK chat uses explicit cloud consent, a session-memory key, a fixed free router and no automatic case attachment. See [assistant privacy and limits](ASSISTANT.md).

27 Node tests and the production build passed; independent bounded review cleared two reproduced timing races. Synthetic browser checks covered chat success, failure/cancellation, disconnection, new conversation, reload, session loss and lock. The affected layout was checked at 320/390/820/1440 pixel emulated widths. Public HTTPS login, assistant connection-state endpoint, invalid connection/disconnected-chat denial, disconnect and logout passed against the deployed service without an upstream model call. Database counts and content digests matched before and after rollout.

Actual OpenRouter generation remains unverified until the owner supplies a real key. Free-model availability and provider privacy-routing compatibility were not established by synthetic tests. The old app image and source remain available for an API-managed rollback; no case schema or volume migration was made.
