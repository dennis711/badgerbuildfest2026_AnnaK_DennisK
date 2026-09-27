# Out There

Project for **badgerbuildfest2026_AnnaK_DennisK** — BadgerBuildFest 2026.

A map-first social discovery app. Open it and you see a quiet map with events picked for you. Scrub through days, weeks and months with the time scrubber, tap a marker, join, and meet people in person.

## How events reach the map

| Marker | Source | How it works |
|---|---|---|
| Gold | **Partner (sponsored)** | Organisers pay to be shown and get a clearly labelled boost in For You. This is the business model. |
| Navy | **Verified host** | Trusted hosts publish their own events. Ratings build reputation, which lifts them in For You. |
| Green | **Found by AI** | The AI event scraper searches the web for real events at your location and date (Claude + web search). |
| Red | **Community meetup** | The Event-Creator agent notices when enough people nearby want the same thing at the same time, checks the weather and proposes a meetup. Once enough people are in, it appears on the map. |

For You ranking (`src/logic.js → fyScore`): interests + connections going + host reputation + sponsored boost − distance; ended events sink.

## How Out There learns (adaptive layer)

Observe first, ask only when useful. No long questionnaire and no separate chatbot.

- **First run:** one screen, “What gets you out there?”, a few chips, then straight to the map.
- **Launch:** a ~3 s splash with the Out There figure and wordmark eases into the map (tap to skip).
- **Filters live in Profile:** “Discovery & event filters” (show, categories, distance, timing, budget, connections). The map header stays clean; a small “n filters” chip appears only when filters are on.
- **No empty-state card:** when nothing matches, the map stays calm with one quiet hint (“see the whole week”, “n more just outside this view”).
- **Map stays home:** a small greeting and “What are we feeling?” chips (Move, Meet people, Food, Something random) filter the map instantly. “Ask Out There” sits in the same row.
- **One-tap moments:** a single contextual card at a time above the timeline (e.g. “Free today?”, “You’ve got some time tonight.”, outdoor priority, optional calendar).
- **Why this:** every event card shows short reasons (interest, minutes away, fits your evening, partner event) and a “Not for me” button that teaches the ranking.
- **What Out There knows:** Profile → a transparency page with a Personalization switch, every learned signal (edit or remove) and connected sources (calendar uses free/busy only).
- **Ask Out There:** a small sheet with suggestions and free text. The app filters candidates with what it already knows; Claude (fast model) picks up to three and writes one sentence. Without a key a local parser answers. Results lead to View & join, Save or Invite.
- **Demo stages:** Profile → “Prototype · how Out There grows” switches between **Day 1**, **Week 1** and **Later** (calendar connected, “You have a window Saturday afternoon” concierge card).

Logic lives in `src/rhythm.js` (ranking, reasons, learned signals, request parsing), UI pieces in `src/moments.js`, the concierge endpoint in `server/ask.js`.

**Demo script:** pick interests → Start exploring → tap *Move* → open a marker → see *Why this* → *Not for me* → Profile → *Week 1* → back to the map for the tonight / outdoor / calendar cards → Profile → *What Out There knows* → *Later* → map shows the Saturday window → *Ask Out There* → “Sarah and I have Saturday afternoon free.” → *View & join* → Join.

## Run it (laptop + phone)

Requires Node.js 20 or later.

```sh
npm install
cp .env.example .env      # then paste your Anthropic API key into .env
npm start
```

The terminal prints two addresses:

- **Laptop:** `http://localhost:5173`
- **Phone:** `https://<your-laptop-ip>:5174` — phone and laptop must be on the same Wi-Fi. The certificate is self-signed, so accept the warning once ("Show details → visit this website" on iPhone, "Advanced → Proceed" on Android). HTTPS is required for the phone to share its location.

**Fullscreen on the phone:** open the address in Safari (iPhone) or Chrome (Android) → Share / menu → **Add to Home Screen**. Starting it from the home screen opens it fullscreen without browser bars.

Without an API key the app still runs with the demo partner/host events in Madison, and meetup proposals use template texts.

## The AI event scraper

`GET /api/events?lat=…&lng=…&from=YYYY-MM-DD&to=YYYY-MM-DD`

1. The server turns the coordinates into a city (OpenStreetMap Nominatim).
2. It sends the prompt in [`prompts/event-scraper.md`](prompts/event-scraper.md) (our original prompt, unchanged) plus the JSON format in [`prompts/event-scraper-format.md`](prompts/event-scraper-format.md) to Claude with the web search tool. The user message is only the city and the date or date range.
3. The answer is parsed, validated (date in range, location within ~60 km, only http(s) links), missing coordinates are looked up from the address, and everything is cached in `.cache/` for 12 hours.

The scrubber decides the date: **Day** asks for that day, **Week** for Mon–Sun, **Month** for the whole month (top 20 each). A request happens only when you stop scrubbing, and each range is asked only once. One request takes roughly 20–60 seconds and uses up to 8 web searches.

Change model, search count or cache time in `.env`.

## Time scrubber

`src/time-scrubber.js` is a plain-JS port of our calendar widget design (scaled down, in the marker colour, and collapsible with the chevron or a swipe down on Day): spring physics, drag sideways to move, swipe up for Week and again for Month, swipe down to go back. Mouse wheel, arrow keys and the Day / Week / Month labels work too. Dots inside a pill show how many events that day, week or month has.

## Structure

- `server.mjs` – local server (HTTP + HTTPS on the LAN), static files and the API routes
- `server/event-scraper.js` – AI event scraper (prompt, validation, geocoding, cache)
- `server/proposals.js` – Event-Creator agent: interest clusters, weather (Open-Meteo), AI-written invitations
- `server/claude.js` – minimal Claude Messages API client (handles `pause_turn` during long searches)
- `server/geocode.js` – Nominatim reverse/forward geocoding, rate limited to 1 request per second
- `src/app.js` – app shell, state, tabs, location, AI loading
- `src/time-scrubber.js` – the Day / Week / Month scrubber
- `src/event-store.js` – one pool for all four event sources
- `src/map-view.js` – Leaflet + MapLibre vector map without shop/POI clutter, marker clustering
- `src/event-card.js` – preview/full event sheet with swipe gestures
- `src/wallet.js` – My Events (upcoming, saved, private history)
- `src/logic.js` – filters, For You ranking, time helpers
- `src/escape.js` – everything from the web is escaped before it is shown
- `prompts/` – the AI prompts

## Tests

```sh
npm test
```

## Prototype limits

- The people behind meetup proposals are simulated personas placed around your location.
- Partner payments, host verification, ratings and connections are mocked.
- Event times are shown in the phone's timezone (assumed to be the event's city).
- Map tiles: [OpenFreeMap](https://openfreemap.org/) vector tiles; geocoding: [Nominatim](https://operations.osmfoundation.org/policies/nominatim/) (fair-use limits apply); weather: [Open-Meteo](https://open-meteo.com/).
