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

`src/time-scrubber.js` is a plain-JS port of our calendar widget design: spring physics, drag sideways to move, swipe up for Week and again for Month, swipe down to go back. Mouse wheel, arrow keys and the Day / Week / Month labels work too. Dots inside a pill show how many events that day, week or month has.

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
