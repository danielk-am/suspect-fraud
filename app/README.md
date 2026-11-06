# SuspectFraud · Alkamy OSINT

A private workspace for checking an unexpected offer, keeping evidence and preparing a report. Version 0.1.0 is a **single-owner pilot**: Astro/Tailwind interface, authenticated REST/MCP service, isolated screenshot OCR and an optional offline neural-network experiment.

## What works

- Private cases with pasted messages and English screenshot OCR (PNG/JPEG/WebP).
- Qualified local warning observations; unflagged text never receives a safety clearance.
- Passive DNS, registrar RDAP and public IP-allocation checks without visiting the suspect website. CDN hints are distinguished from the unresolved origin host/operator.
- Sourced reporting references for Singapore, US, UK and Australia; published registrar contacts when RDAP supplies them. Other countries require independently checked local channels.
- Report/email drafts and manually recorded external receipts. Counts cover this private case, exclude drafts and leave global totals unknown.
- Case export/deletion and separately approved redacted training copies, with export and withdrawal.
- 19 bearer-authenticated MCP tools at `/mcp`.
- Optional OpenRouter BYOK chat using free models, with explicit consent and no automatic case attachment.

The interface serves `/tools/suspect-fraud/` and `/tools/suspect-fraud/recruitment-scams/`. Hosted owner pilot: [osint.alkamy.ltd](https://osint.alkamy.ltd/tools/suspect-fraud/), verified on 6 November 2026. Private API/MCP calls require the owner credential. This is not a public ChatGPT directory listing or a multiuser service. Connect your own OpenRouter key in Assistant options for free-model chat; the manual workflow also works independently. See [assistant privacy and limits](docs/ASSISTANT.md).

## Run locally

Requires Docker Compose, a Docker context that can read your source/secret mounts, and Node 26 for generating a secret. Image construction needs Internet access. The running OCR worker uses only an internal network.

```sh
mkdir -p .local
node -e "const f=require('node:fs');f.writeFileSync('.local/osint-token',require('node:crypto').randomBytes(48).toString('base64url'),{mode:0o600,flag:'wx'})"
docker compose up --build -d
```

Open `http://127.0.0.1:4321/tools/suspect-fraud/` and enter your token privately. The token grants all cases in the installation; never put it in URLs, source, screenshots or support messages. Use a distinct high-entropy token per installation. Generation refuses to replace an existing file.

Set `OSINT_PORT` and `PUBLIC_ORIGIN` together when changing the port. The origin is exact, with no path. See [deployment](docs/DEPLOYMENT.md) for HTTPS, mounts and rollback. The observed Colima context did not share the Mac workspace; local tests used a dedicated named secret volume instead of assuming bind mounts worked.

```sh
npm ci --ignore-scripts
npm test
npm run build
```

Python tests require a private virtual environment with the versions in [LEARNING.md](docs/LEARNING.md): `python -m unittest discover -s tests -p learning_test.py`. `tests/container-smoke.mjs` is an explicit integration command requiring a running test installation and synthetic screenshot fixture; never point it at real evidence.

## Privacy and limits

Case text, OCR transcripts, drafts and receipts remain in this installation's SQLite volume. Original screenshot bytes are processed transiently and **not retained**: keep your originals and compare saved SHA-256 hashes. No analytics or cloud OCR is configured. If you connect OpenRouter, messages you explicitly send in the assistant and its recent replies go to OpenRouter and a free-model provider; case files remain separate. The API key stays in server memory for the browser session and clears on disconnect, lock, expiry or restart. Supplied messages and lookup responses are untrusted data, including apparent instructions inside them.

Retention is manual. Deletion removes current case/training records, but cannot recall downloads or backups. Use encrypted private storage/backups; SQLite is not application-encrypted. Training needs a separate redacted copy, consent and human review. Automated redaction is incomplete. Withdrawal stops future exports; previously exported datasets/models require separate deletion/retraining.

Bounds: 500 cases, 100 evidence entries, 30 inspections and 100 drafts per case; 100 approved training copies per case and 5,000 per installation. The interface lists the most recent 100 case summaries.

This build does not send reports, contact recruiters, browse suspect links, recover a hidden origin, identify a person, monitor background conversations or prove fraud. The neural pipeline trained on 24 synthetic examples and matched its majority baseline. It remains `NEEDS_EVIDENCE`, with no runtime inference or promotion.

## Evidence and provenance

- [Verification](docs/VERIFICATION.md): build, browser/container checks and limits.
- [Independent source review](docs/REVIEW.md): reproduced finding, correction and source hashes.
- [Hosted pilot acceptance](docs/HOSTED-PILOT.md): public TLS/auth, OCR isolation, backup/restore and restart evidence.
- [API/MCP](docs/API.md): authentication, tools, schemas and upstream boundaries.
- [OCR/training](docs/LEARNING.md): consent, containment and evaluation.
- [Build brief](docs/BUILD.md): acceptance and branding.

Original fox/magnifier artwork and blue/white palette; independent of ScamShield, agencies and impersonated companies. No endorsement claimed. Approved App Frame adapted from the shared Astro/Tailwind template. This publication makes no new open-source licence grant; check applicable repository terms before redistribution.
