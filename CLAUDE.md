# Notes for AI coding assistants

- Plain ES modules, no framework and no build step. Run with `npm start`, test with `npm test`.
- Write readable code: one statement per line where it helps, short comments on intent. No minified one-liners.
- The time scrubber in `src/time-scrubber.js` is a fixed design (port of our calendar widget). Keep its geometry, colours, spring values and gestures unless we ask for a change.
- Anything that comes from the web or the AI must go through `esc()` / `safeUrl()` from `src/escape.js` before it reaches `innerHTML`.
- Never put API keys in the frontend or in git. Keys live in `.env`, read only by the server.
- The user's scraper prompt in `prompts/event-scraper.md` stays verbatim; change the JSON contract in `prompts/event-scraper-format.md` and the parser in `server/event-scraper.js` together.
- Event sources: `partner`, `host`, `ai`, `community`. Every event needs `id, source, host, title, interest, mode, start, end (ms), lat, lng`.
- Commit small working steps with clear messages.
