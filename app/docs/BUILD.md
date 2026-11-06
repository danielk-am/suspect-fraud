# SuspectFraud · Alkamy OSINT

Approved task: private investigation of suspected fraud, from supplied domain/message/screenshot to sourced infrastructure findings and reviewable reporting drafts. Initial audience: a person assessing an unsolicited recruitment offer. Existing alternative: manual RDAP/DNS, screenshots, and separate agency forms. No market or classifier accuracy claim.

Journey: unlock private workspace → create case and choose country → add message or screenshot → check a domain passively → review findings and their limitations → select reporting channel → prepare/download report → manually submit to destination → record receipt. Exit by export/delete/logout. Training is a separate redacted-copy approval step.

Design: user-approved three-panel App Frame. Flat case navigation; central task in numbered stages; exact shared AssistantPanel on right (OpenRouter BYOK connected on demand; manual workflow also available). Original previously generated fox/magnifier icon retained. Blue/white palette inspired by official ScamShield campaign, with orange only in the original fox. No ScamShield logo, affiliation, or endorsement. Colours are our accessible approximations, not official brand specifications. Source: https://www.scamshield.gov.sg/scamshield-suite-campaign/ .

Acceptance: denied anonymous private calls; successful case/evidence/domain/report workflow; counts only recorded submitted receipts; no automatic external reporting; OCR without outbound internet; explicit opt-in redacted training export and revoke; bounded upstream failure; MCP tools list and calls; build and Docker restart/persistence; independent security/usability review. Synthetic disposable fixtures only during verification.

Boundaries: owner-only pilot, one operator per installation. No claim of multiuser tenancy, source-person attribution, background monitoring, verified fraud verdict, official aggregate reports, or validated neural-network accuracy. No arbitrary browsing of suspect sites. Public directory submission requires OAuth/multiuser hosting review beyond this owner pilot; do not represent a private bearer-token MCP as a ready public ChatGPT listing.

Naming: osint.alkamy.ltd/tools/suspect-fraud and /tools/suspect-fraud/recruitment-scams. MCP /mcp. Public launch follows tested build and applicable runtime controls.

Progress: implementation, local/browser/container checks and independent source review complete. Hosted owner pilot deployed and exercised with synthetic evidence on 6 November 2026, including public TLS/auth, real OCR, private backup/restore and managed restart persistence. See HOSTED-PILOT.md for scope and limitations. Existing skill-only portal draft remains blocked and unpublished.
