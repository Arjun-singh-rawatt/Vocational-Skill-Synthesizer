# Editing the chatbot menu

1. The chatbot content is in `client/src/data/chatMenu.json`.
2. Add an option to a menu's `options` array to create a question button.
3. Every option needs a unique kebab-case `id`, `label`, and `type`.
4. A `menu` option needs a `target` menu id.
5. An `answer` option needs a `reply`; it can also have `replyNoSession`, `action`, and `next`.
6. A `report` option needs a report `section` and can have `next`.
7. Option types are `menu`, `answer`, and `report`.
8. `when` can be `any`, `session`, or `noSession`; it defaults to `any`.
9. Options appear in array order. Set `enabled` to `false` to hide one.
10. Replies support the placeholders listed in the JSON `_help` field.
11. Copy these options into the root menu's `options` array: `{ "id": "upload-help", "label": "How do I upload?", "type": "answer", "reply": "Choose a clip, then select Analyze." }` and `{ "id": "more-help", "label": "More help", "type": "menu", "target": "moreHelp" }`.
12. Add this sub-menu object under `menus`: `"moreHelp": { "prompt": "More help", "options": [{ "id": "back-tip", "label": "Where do I start?", "type": "answer", "reply": "Upload or record a clip." }] }`.
14. Run `npm run check:chat-menu --prefix client` to validate ids, replies, routes, and placeholders.
15. In development, invalid options are skipped and warnings are logged.
16. The dev server hot-reloads JSON edits; production needs a rebuild.
