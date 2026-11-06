# Independent adversarial review

Reviewed 2026-11-06, Node v26.9.0. Scoped acceptance: PASS after correction of the reproduced case-ceiling defect. No unresolved defect was reproduced within this review's bounded scope. This is not a certification of deployment security or model accuracy.

## Finding resolved

**P2 — MCP bypassed the 500-case workspace ceiling.** The original REST branch rejected case 501, while MCP `create_case` called the unrestricted shared store and successfully created it. A reviewer regression reproduced the difference before the fix. `CaseStore.create` now checks and inserts under `BEGIN IMMEDIATE`, so REST and MCP reject the same over-limit operation. The reviewer test confirms the database remains at 500 cases. Additional backend regressions cover separate connections, restored capacity after deletion, and atomic training limits of 100 per case and 5,000 per workspace.

## Evidence and checks

- `node --test tests/server.test.mjs tests/review-security.test.mjs`: 17/17 passed on the reviewed bytes.
- `../../work/learning-venv/bin/python -m unittest discover -s tests -p learning_test.py`: 11/11 passed.
- Four reviewer tests exercise authenticated control writes alongside unauthenticated rejection, direct hostile Host rejection, missing-Origin cookie write rejection, bearer-only MCP, static/private path isolation, secret-free errors, transport case-cap parity, explicit training approval, export exclusion of original evidence and case IDs, and consent withdrawal.
- Traced parameterized SQL, evidence rendering with `textContent`, exact origin/host checks, bounded requests and tasks, and absence of external report-sending tools. Passive domain inspection uses fixed/authoritatively selected services and does not visit the suspect site.
- Narrow incident-detail scan of source, documentation and configuration found no supplied suspect contact, referral code, incident domain or private company recipient. Example environment configuration contains a token file path rather than a token value.

## Limits

No independent live-browser, Docker-runtime or deployment check was performed by this reviewer. Docker isolation was inspected as configuration only. No mutation-testing run was performed. Automated redaction is incomplete and depends on explicit human review. Training smoke tests establish pipeline execution, not predictive validity; model promotion remains blocked by missing evaluation evidence. Report counts are private user-recorded receipts, not independently verified global statistics. Prepared reports are drafts and this review sent nothing externally.

## Exact source identity

The app directory was not a Git repository when checked; no commit identity is claimed. SHA-256 hashes below pin reviewed source. Later changes require proportionate re-review.

| File | SHA-256 |
| --- | --- |
| `server/app.mjs` | `ed67049f9d47df591c1a4b426238bb1bce3959c13f03185fcaa695c2843a2650` |
| `server/store.mjs` | `95601767a1109f48f826d3a9bf9c9466300f7978e3f1a5f41a6b266c7731e09c` |
| `server/mcp.mjs` | `c0cb4ea657fac09fe90e5b232b7031d8a8583bd58cd460d49961909f42cc2109` |
| `server/investigate.mjs` | `68af63402e6ae9e20ba6feca7889bab3beb46b650d5461d502a320f5106b4d3d` |
| `server/domain.mjs` | `c3b2ae5fe7b7665d775a1cd0a457cbaa1dd0120731f62dc371edcbb28a4d3630` |
| `workers/ocr/worker.py` | `c16e5856f585c7dfa25c4159d447ef1874480ae596644ca7573a99d3c236f92c` |
| `training/data.py` | `d02e7afa22ec3c59073c14df2a7dfd0613746c7ecece9123b7266d834761610e` |
| `training/train.py` | `56fec56449c5b51f55685c1fbb1a476f84dbbf96aafbb78f4a67e2a2f4f11bd2` |
| `src/scripts/product.ts` | `eadd81415c84b644696fb6828225d40f412af58f74c7e026f01501c71ee8d4ae` |
