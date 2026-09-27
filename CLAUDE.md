# Notes for AI coding assistants

## Project in one paragraph

**Out There** (BadgerBuildFest 2026, Anna K + Dennis K) is a map-first social discovery app. The home screen is a quiet full-screen map with events picked for you. Events come from four sources: paying partners (sponsored), verified hosts, events found on the web by an AI scraper, and community meetups the app proposes when enough people nearby want the same thing. People connect in person, not through profiles or chat. The app quietly learns the user's rhythm (interests, saves, skips, free time, optional calendar) and turns it into "what makes sense for me right now". Demo city: Madison, WI. UI language: English.

## Current state (end of day 1)

- Runs locally, phone reaches it over Wi-Fi via self-signed HTTPS (`npm start`, see README).
- Time scrubber (day / week / month) is a port of our calendar widget, scaled down, navy accent, collapsible.
- AI event scraper (`/api/events`) uses the user's prompt + Claude web search; results cached in `.cache/`.
- Adaptive layer: onboarding chips, "What are we feeling?" mood chips, one contextual card at a time, "Why this" + "Not for me", "What Out There knows" page, "Ask Out There" sheet (`/api/ask`), demo stages Day 1 / Week 1 / Later in Profile.
- 22 tests pass (`npm test`). Claude calls were only tested against a simulated API; the first real run with a key is still open.
- The demo flow to present is listed in README → "Demo script".

## Where things live

- `src/app.js` – app shell, state, tabs, wiring of everything
- `src/rhythm.js` – learning model: ranking, reasons, learned signals, request parsing (pure, tested)
- `src/moments.js` – HTML for onboarding, greeting, context cards, knows page, ask sheet
- `src/time-scrubber.js` – the timeline; `src/map-view.js` – map + markers; `src/event-card.js` – event sheet
- `src/data.js` – demo events/hosts/connections (dates relative to today; "sat" rows = next Saturday window)
- `server/` – scraper, proposals (meetup agent), ask concierge, Claude client, geocoding

## Rules

- Plain ES modules, no framework and no build step. Run with `npm start`, test with `npm test`.
- Keep the existing visual identity, map-first layout and navigation. Don't redesign; extend.
- Write readable code: one statement per line where it helps, short comments on intent. No minified one-liners.
- The time scrubber is a fixed design. Keep its geometry ratios, spring values and gestures unless asked.
- Anything that comes from the web or the AI must go through `esc()` / `safeUrl()` from `src/escape.js` before it reaches `innerHTML`.
- Copy tone: calm and human. Avoid "we noticed / we tracked / we know", avoid overusing "AI".
- Never put API keys in the frontend or in git. Keys live in `.env`, read only by the server.
- The user's scraper prompt in `prompts/event-scraper.md` stays verbatim; change the JSON contract in `prompts/event-scraper-format.md` and the parser in `server/event-scraper.js` together.
- Event sources: `partner`, `host`, `ai`, `community`. Every event needs `id, source, host, title, interest, mode, start, end (ms), lat, lng`.
- Commit small working steps with clear messages; `main` must always run.
