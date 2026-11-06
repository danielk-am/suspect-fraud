# SuspectFraud 0.1.0 verification

Checked 6 November 2026. All application test records were synthetic. No suspect website visited or registered through this app.

| Area | Observed result |
|---|---|
| Frontend | Build passed on Node 26.9.0, Astro 7.4.4/Tailwind 4.3.3. Small JS bundles external for self-only script CSP. |
| Node | 17 tests passed: auth/Host/Origin/CSRF, MCP, central capacity, partial upstream failure, receipts and consent/export/revoke. |
| Python | 11 OCR/training tests passed in private venv. |
| Dependencies | npm audit reported zero known vulnerabilities at check time. |
| Live lookup | example.com returned sourced registrar/DNS/network data; real DoH media-type issue reproduced and fixed. |
| Container workflow | Auth, case, real Tesseract OCR, drafts/counts, receipt, training/export/withdraw passed. Case/evidence/count survived restart; fixture deleted. |
| Health probe | Node fetch ignored supplied Host; changed to Node HTTP with explicit Host, then rechecked final image. |
| Isolation | OCR non-root/read-only/capability-free; outbound TCP denied. |
| Neural experiment | Real isolated PyTorch run, 24 synthetic examples, 18/6 campaign-disjoint split. Accuracy 0.5 equalled baseline; NEEDS_EVIDENCE, no promotion. |

## Browser

Desktop actual CSS widths 820/1199/1200/1440: no document overflow, correct breakpoint and internal centre scroll. Native resizing had a 500px floor; actual 320/390 widths checked through mobile emulation, without document or canvas horizontal overflow.

At 390px, navigation and assistant drawers made main content inert and focused inside. Shift-Tab stayed inside; Escape restored opener. Desktop separator End set navigation 340px. Collapse and dark appearance persisted only frame preferences. Light desktop 1440 and dark mobile 390 screenshots inspected inline. Storage.getItem/setItem throwing SecurityError left page/drawers usable, with no console error/warning.

Actual DOM workflow: login, case creation, evidence/warnings, report draft, receipt, training approval/withdrawal. Draft count 0 became 1 only after receipt. HTML-looking case title rendered literally, without inserted image. Reload restored case list through authenticated API. No case/token in browser storage.

Screenshot saving was denied by browser tooling; inline inspection is recorded, no saved screenshots claimed. No physical-device, screen-reader or full accessibility audit. Assistant provider disconnected, with no provider acceptance result or background Dot hook.

## Release boundary

Independent review reproduced a REST/MCP capacity mismatch and independently confirmed the central transactional correction. REVIEW.md records hashes and scope. Remote DNS/TLS/deployment, multiuser/OAuth, public directory acceptance and validated scam-detection accuracy remain unestablished.
