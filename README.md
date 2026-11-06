# SuspectFraud

A reporting skill/plugin by Daniel Kam, with a new Alkamy OSINT private app pilot. The plugin remains skills-only. It uses the tools available in the host; it supplies no mailbox, browser, credentials or reporting API. The workflow preserves private evidence and records verified submission outcomes.

Install the ZIP through a compatible plugin host, or use the bundled SKILL.md in a skill-capable assistant. For a case, supply evidence, jurisdiction and authorised reporting destinations. Future reports require the user’s authority.

No incident evidence or secrets are bundled. No automatic monitoring or unattended submissions are configured. Public directory approval and runtime reporting are separate from package installation.

## Quick checks

Ask “Does this message look like a scam?” with the message, link or screenshot. The skill gives a qualified assessment before deeper research. It works on content supplied in Dot or another compatible conversation host; it installs no background listener or notification system.

Website: https://danielk.am/tools/suspect-fraud/

## Alkamy OSINT app pilot

The [app/](app/) directory contains SuspectFraud 0.1.0: private case management, passive domain checks, screenshot OCR, reporting drafts and authenticated MCP tools. It includes constrained Docker services, consent-based offline training and verification records. See [setup and limitations](app/README.md). Hosting and public directory submission remain pending; no public evidence-upload service is enabled.
