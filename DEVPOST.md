# Out There — Devpost story

*BadgerBuildFest 2026 · Anna K. & Dennis K. · Madison, Wisconsin*

## Inspiration

Almost everyone we know says the same thing: *"I want to get out more."* And then the evening ends on the couch anyway.

It is never a lack of willingness. It's the last mile. You want to do something — a first date, a run with friends, just anything that isn't a screen — and you get stuck on the small stuff. What is even happening tonight? Who would come? When is everyone free? Somebody has to search, somebody has to propose a time, somebody has to keep the group chat alive. Most good ideas die right there.

The numbers say we are not imagining it. Americans spend about **51 minutes less per day outside the home** than in 2019. Daily socializing is down to **35 minutes**, from 41 in 2015. Time with friends fell from **60 to 20 minutes a day** since 2003, and for 15–24 year olds it dropped by roughly **70 %**. The U.S. Surgeon General has called loneliness an epidemic and compared the health risk of weak social connection to smoking **up to 15 cigarettes a day**. Meanwhile the places where people used to meet by accident — cafés, libraries, clubs, churches — are thinning out.

And yet the demand is there: **79 %** of 18–35 year olds want to attend *more* events this year, **89 %** want events that connect them to their community, and **79 %** say spontaneity beats a perfect plan.

So the gap is not "people don't want to go out." The gap is that nobody organizes the thing they would have gone to. That is the hole we wanted to fill: let the AI collect all those scattered intentions — the interests, the free evenings, the "we should really do that sometime" — and turn them into one real plan where people actually meet, become friends, and build a network that exists offline.

## What it does

**Out There** is a map-first app. You open it and you see a quiet map — no shops, no clutter — with events chosen for you. There are five ways an event can land on that map:

- **Gold pin — paying partners.** Organizers pay for visibility. Always clearly labelled.
- **Navy pin — verified hosts.** Their reputation, built from ratings, lifts them in your feed.
- **Green pin — found by AI.** A Claude agent with web search scrapes real, currently announced events for your exact location and the day, week or month you are looking at, and returns them as structured JSON: coordinates, organizer, time, cost, capacity, registration required yes/no, link, and hashtags.
- **Red pin — community meetups.** An agent clusters what people nearby want to do, checks the weather, and proposes a gathering once enough people overlap.
- **"?" pin — our favorite.** This is the one we built the whole night for.

**The "?" is the USP: the AI creates its own events.** When several people nearby (and some of your connections) want the same thing but nobody has fixed a time, a dashed **"?"** appears on the map. Tap it, and instead of a fixed schedule you get a question: *when works for you?* You pick a window — morning, afternoon, late afternoon, or "anytime" — and that counts as your RSVP. **24 hours before**, Out There locks in the slot where the most participants are free, notifies everyone, and the "?" turns into a normal, confirmed event pin.

In our demo: *Lake Mendota Canoe & Paddle* at the Hoofer Outdoor Club, next Monday. 16 people interested, votes spread across four windows, and the AI resolves it to **Monday, 4:30 PM**. Nobody organized it. It organized itself.

Around that sits a layer that learns quietly. Our design rule was **"Observe first. Ask only when useful."** Onboarding is a single screen with a handful of interest chips and the line *"That's enough for now. Out There learns what works for you as you go."* After that it learns from what you save, join and skip, from the time of day, the distance, and — only if you offer it — your calendar's free/busy windows. It asks in one-tap moments: *"Free today?" · "You've got some time tonight." · "Want me to work around your schedule?"* Every recommendation explains itself under **Why this** ("You like movement · 12 min away · Fits your evening · Sarah is going"), and **"Not for me"** teaches it instantly. Everything it has learned lives on one page, **"What Out There knows"**, in plain language, where each line can be edited or deleted and personalization can be switched off entirely.

There is also a small **"Ask Out There"** sheet — not a giant chatbot — where you can say *"Sarah and I have Saturday afternoon free"* and get three plans that fit both of you, each one leading straight to join, save or invite.

And the whole thing is privacy-first by design: no public profiles, no browsing strangers, no contact details in the app. You meet in person, and only then do you connect.

## How we built it

We had 19 hours left when we started this version, so every decision was about shipping something real rather than something impressive on paper.

**Stack:** plain ES modules. No framework, no build step, no bundler. Leaflet with a MapLibre vector basemap (POIs filtered out so the map stays calm), and a dependency-free Node server. It sounds old-fashioned; it meant zero minutes lost to tooling and instant reloads all night.

**AI:** Claude Sonnet 5 with the web search tool powers the event scraper — we kept the scraper prompt we had written ourselves and only added a strict JSON contract on top, so the prompt we designed is literally what runs in production. Claude Haiku 4.5 writes the meetup invitations and picks the best matches in "Ask Out There". Open-Meteo supplies weather, Nominatim handles geocoding — both free, no keys.

**Time scrubber:** the calendar widget we designed became a hand-ported, spring-animated control. Drag sideways through days, swipe up for weeks, again for months. It drives everything: the day you're looking at is the day the AI searches for.

**Delivery:** the server serves over HTTPS on the local network with a self-signed certificate, because phones refuse to share location over plain HTTP. Add it to the home screen and it runs fullscreen like a native app.

**Process:** VS Code + Claude Code, everything versioned on GitHub, small commits, `main` always runnable, 24 automated tests covering the time filters, the privacy rules, the ranking, the request parser and the "?" consensus logic. API keys live only in `.env`, never in the repo, and every piece of text the AI brings back from the open web is escaped before it touches the DOM.

## Challenges we ran into

- **The 500+ question catalog.** Before writing meaningful code we worked through a catalog of over five hundred product questions — about onboarding, privacy, edge cases, monetization, tone. It was exhausting and it was the single most valuable thing we did. It is why we could answer "what happens if nobody shows up" or "what does the AI actually know about me" without hesitating.
- **Making AI feel embedded, not bolted on.** Our first instinct was a chat interface. Mentors pushed back, and they were right: intelligence should be felt through *timing and quality*, not through a chat bubble. We rewrote it into small contextual cards with one-tap answers.
- **Language discipline.** We banned "we noticed", "we tracked", "we know that you". A system that learns must never sound like surveillance. Rewriting copy took longer than writing the logic.
- **Consensus math that actually works.** "Anytime" votes have to count toward every real slot; the resolved time must be reproducible and testable. We got this wrong twice before it held up in tests.
- **Cost control.** Live web search per day, per week and per month would have burned through budget in minutes. We debounce until the scrubber stops, request each range only once, and cache results for 12 hours.
- **Phones are strict.** Geolocation demands HTTPS. That sent us into self-signed certificate territory at 2 a.m.
- **Git and two folders.** Two copies of the project on one machine, a rewritten commit history, `EADDRINUSE` on port 5173 — the least glamorous hour of the night, and a genuinely useful lesson.
- **Scope.** New ideas kept arriving through the night, several of them from mentor conversations. We implemented the ones that made the story clearer — the launch splash, filters moved into the profile, the stronger timeline gradient, and the "?" event itself — and wrote the rest onto the roadmap instead of half-building them.

## Accomplishments that we're proud of

- **A genuinely deep idea, not a demo shell.** Business model, privacy model, ranking formula, tone of voice, five event sources and an honest list of prototype limits — all worked out and written down.
- **The "?" event works end to end.** Voting, the 24-hour consensus, the notification, and the transition into a confirmed pin. The resolution logic is real and covered by tests, not a hardcoded screen.
- **We answered 500+ product questions** and let the answers shape the app instead of letting the app shape our answers.
- **We kept improving it all night.** Ideas that arrived at 11 p.m. were running by 1 a.m.
- **It runs on a real phone, fullscreen**, pulling real events for wherever you are standing.
- **24 passing tests, zero frameworks, zero build steps** — and `main` never broke.
- **Transparency as a feature.** "What Out There knows" is something most products would hide in settings. We made it a page we're proud to show.

## What we learned

The biggest lesson had nothing to do with code: **together you get much further than alone.** Over these 24 hours the exchange between the two of us was relentlessly positive and motivating. We both pushed ourselves harder than we would have on our own, and we worked on this with full conviction — not because we had to ship something, but because we genuinely believed in it by hour three.

Talking to the mentors changed the product. We came in with a feature list and left those conversations with a *philosophy* — ask less, observe more, explain every recommendation, and always move toward an action. Several concrete features in the final build came directly out of those five-minute hallway conversations.

Technically, the most useful insight was about the division of labor with AI: **let the app do the filtering and let the model do the judgment.** We pre-filter candidate events with everything we already know — time window, interests, distance, budget — and only then ask Claude to choose and phrase. It is faster, far cheaper, and it degrades gracefully: with no API key the app still answers on its own.

And we learned that constraints are a gift. No framework, no build step, one map, one prompt kept verbatim — every constraint bought us hours we spent on the part that actually matters.

## What's next for Out There

**Short term**
- Real user intents instead of simulated personas, so "?" events grow out of genuine demand
- Push notifications for the 24-hour confirmation
- Real calendar integration (Google, Apple, Outlook) — free/busy only, never event details
- QR-code connections when you actually meet, and post-event ratings feeding host reputation
- A partner portal for sponsored events, and expansion beyond Madison

**The bigger vision: places find people**

Right now Out There brings people to events. Next, it should bring **forgotten places** and people together. U.S. office vacancy just hit a record **21 %** — empty rooms everywhere, at the exact moment people say they have nowhere to gather. Research on "meanwhile use" of vacant buildings shows the payoff: lower carbon than demolition and new construction, short-term economic activity, space for youth and social programs, and stronger local ownership of a neighbourhood.

So: cities, owners, universities and organizer cohorts list free rooms and spaces — an empty storefront, an unused office floor, a gym in the evening, a rooftop — with capacity, equipment, available hours and rules. The AI already knows that twenty-five people in that neighbourhood want a board game night, a repair café or a ceramics evening. When the space fits the activity and enough interest exists, it proposes a **"?" event right there**, runs the same time vote, and locks in a date. The owner knows the headcount in advance. A forgotten room becomes a meeting place again, and a one-off turns into a recurring group.

That is the version of Out There we want to build: an app that doesn't wait for somebody to organize something. When enough people want the same thing, it finds the time, the place and the people — and *"we should really do that sometime"* becomes **"Monday, 4:30 PM, at the lake."**
