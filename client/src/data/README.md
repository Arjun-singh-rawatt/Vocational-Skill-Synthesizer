# Editing chatbot replies

The chatbot content lives in `client/src/data/chatIntents.json`.
1. Add an object to the `intents` array with a unique kebab-case `id` and `enabled: true`.
2. Add `match.exact` for whole-message matches, `match.phrases` for contained text, or `match.keywords` for help-cued terms.
3. Add a concise `reply`; use `replyNoSession` for a different answer before analysis and `action` to open a diary.
4. Example: `{ "id":"upload-help", "enabled":true, "match":{"phrases":["how do i upload","upload kaise karun"],"keywords":["upload*"],"needsHelpCue":true}, "reply":"Choose Upload Audio or Video, select your clip, then analyze." }`.
5. Exact matches compare the whole normalized message; phrases match when contained in the normalized message.
6. Keywords match a word; a trailing `*` matches a prefix. By default, a help cue is required unless the message is just that keyword.
7. Intent array order is priority because the first matching intent wins.
8. Disable an entry by setting `enabled` to `false`; it stays in the file but is ignored.
9. Put specific intents above general ones to avoid broad matches taking priority.
10. Replies support `{{maxFileSizeMB}}`, `{{maxDurationSec}}`, and `{{allowedFormats}}`.
11. The development server hot-reloads JSON edits; production requires a fresh build.
12. Run `npm test --prefix client` after editing to check routing and data validity.
