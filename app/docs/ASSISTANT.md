# Assistant integration contract

The starter includes UI only. Its submit control stays disabled. Drafts stay in the current DOM and are not sent or persisted. The approved panel structure stays consistent across apps; customize task copy and capabilities through its props. UI changes do not connect a provider by themselves.

| Choice | Required adapter | Included test state |
| --- | --- | --- |
| ChatGPT / Codex | A currently supported server integration, or a verified local CLI bridge for a desktop/local deployment | Unimplemented |
| Claude | A currently supported server integration, or a verified local CLI bridge | Unimplemented |
| Ollama | An authorized reachable endpoint and model; a remote deployment needs its own protected route | Unimplemented |
| Custom API | An authenticated server route with a validated request/response contract | Unimplemented |

Verify each provider's official current integration/authentication documentation before implementation; consumer sign-in does not establish arbitrary app OAuth. A deployed web app cannot automatically use the user's locally signed-in CLI.

Keep provider keys, endpoint credentials and tool secrets server-side. Public frontend settings can hold provider labels or public configuration only. Bind authorization to the actual user/project, validate structured output before effects, and treat references and model text as untrusted data. Do not pass model output to HTML or a shell.

A real adapter needs explicit disconnected, connecting, ready, working/streaming, cancelled and failed states. Show progress in the conversation, a bounded timeout, cancellation, visible error and safe retry. Preserve drafts on failure, allow history clearing, and show the selected context and local/cloud destination before sending. Proposed writes need application-authorized review/apply with receipts and Undo or a recovery path. Ordinary work remains usable without AI. Test rejected/stale proposals and denied access alongside success.

## UI extension points

- Keep `AssistantPanel.astro`'s header, welcome, full-width suggestions, composer and context/provider footer. Connection details live behind the three-dot and provider buttons. Default provider label is “Not connected”; replace it with the actual selected provider only after connection succeeds.
- `assistant.ts` supplies draft filling, new conversation, options Escape/outside dismissal and disconnected feedback. A connected app must replace the disconnected Enter/submit handlers with its validated adapter. Command+Return on Mac and Ctrl+Enter elsewhere send; plain Enter is also supported. Shift+Enter adds a newline, and IME composition must not submit. Keep the platform-aware keycaps and accessible labels in sync with the adapter. Send is enabled only for a non-empty allowed request with a ready adapter; show Stop during work.
- Intercept the cancelable `af:new-conversation` event to stop active requests and reconcile pending writes before allowing reset. Never erase unresolved effects by only clearing the DOM. Preserve unsent drafts across closing, resizing and drawer changes.
- Use real context and app-specific suggestions. Claim direct edits or Undo only when implemented. Long prompts and public progress summaries may collapse behind “More”; do not display private model reasoning. Streaming/loading feedback, errors and recovery remain visible in the conversation.
