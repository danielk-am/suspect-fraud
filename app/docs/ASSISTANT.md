# OpenRouter BYOK assistant

SuspectFraud supports OpenRouter with the fixed `openrouter/free` router. Unlock the workspace, open Assistant options, enter your own OpenRouter API key and consent to sending this conversation to OpenRouter and a free-model provider. A ChatGPT login does not provide API access. Other provider choices remain unavailable.

Only messages explicitly sent in this chat and its recent replies are included. Case files, screenshot transcripts and investigation results are never attached automatically. Paste only the information you intend to share. Replies have no tools or live case access and cannot submit reports or change records. Output is rendered as plain untrusted text.

## Credentials and privacy

The browser sends the key over this installation's HTTPS connection to the server for validation against `https://openrouter.ai/api/v1/key`. The server holds it in memory for the authenticated browser session. It is never written to the database, browser storage or application logs. The input clears on submission. Disconnect, lock, session expiry or a server restart clears the key; expiry cleanup runs every 30 seconds. Reloading the page clears visible conversation history but keeps the connection while its server session is valid.

Chat requests go only to OpenRouter's fixed HTTPS API. Requests use `model: openrouter/free`, `provider.data_collection: deny`, and zero maximum prompt/completion prices. No paid fallback or automatic retry is configured. Free models have variable availability and limits. These restrictions may leave no eligible model. This is not a promise of zero retention: review [OpenRouter privacy settings](https://openrouter.ai/settings/privacy) and each provider's policies before sending private information. Use a dedicated revocable key from [OpenRouter](https://openrouter.ai/settings/keys).

## Operation and limits

The app retains recent chat in DOM memory only. Requests allow up to five preceding turns plus a new message, at most 24,000 characters overall. The composer allows 4,000 characters per user message. Responses are capped at 1,200 output tokens and 8,000 characters. Each provider request has a 30-second deadline, no retry, one in-flight request per session and 12 attempts per minute. Provider work also shares the installation's two-request work limit. A partial upload reserves its session before body parsing; disconnect cancels it before a key can be stored.

Send requires a connected provider and nonempty message. Stop cancels pending work, although a request may already have reached the provider. Drafts survive failure/cancellation. New conversation aborts pending chat and clears history; lock also clears the draft. Closing a drawer does not clear chat. The options form scrolls within the panel on short/mobile viewports.

## Evidence

Synthetic browser checks cover connection, safe literal output, rate limits, cancellation, disconnection, reload, new conversation and lock. Automated regressions cover session isolation, consent, Origin denial, bearer-only denial, no automatic case context, free-only request structure, invalid/provider/oversized responses, network/deadline failures, upload/disconnect races, concurrency and stale authorization responses. A bounded independent review cleared the two reproduced timing defects.

Actual OpenRouter generation and eligible free-provider availability remain unverified because no real user key was supplied. No paid calls or shared credentials were used.

Official references: [Free router](https://openrouter.ai/docs/guides/routing/routers/free-router), [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [retention distinctions](https://openrouter.ai/docs/guides/features/zdr).
