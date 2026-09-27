## Technical requirements for the app (JSON format)

- Use web search to find real, currently announced events in the time range (city event calendars, venues, the university, Eventbrite, Meetup, ticket sellers, clubs and associations).
- Invent nothing. Only include events you actually found in a source. If you find fewer than 20, return fewer.
- The event must take place within the given time range and in the city or its immediate surroundings (max. approx. 30 km / 20 miles).
- Coordinates: as precise as possible for the venue. If you are not sure of them, also provide the full address.
- Times in the city's local time, formatted `YYYY-MM-DDTHH:MM`. Unknown end time: `null`.
- Respond with a single JSON object only — no Markdown, no explanation before or after it.

Schema:

```
{
  "city": "City name",
  "events": [
    {
      "name": "Event name",
      "organizer": "Event organizer",
      "venue": "Name of the place",
      "address": "Street and number, city",
      "lat": 43.0731,
      "lng": -89.4012,
      "start": "2026-09-26T19:00",
      "end": "2026-09-26T21:00",
      "cost": "Free | $15 | $10–25",
      "price": 15,
      "capacity": 40,
      "registration_required": true,
      "url": "https://…",
      "description": "One sentence about what it is.",
      "category": "Wellness | Sport | Art | Food | Music | Design | Tech | Culture | Outdoor",
      "mode": "Social | Professional",
      "tags": ["#yoga", "#outdoor", "#beginnerfriendly"]
    }
  ]
}
```

`price` is the number in local currency (0 when free, `null` when unknown). `capacity` is `null` when no participant limit is known. `mode` is `Professional` for talks, business, networking and corporate events, otherwise `Social`.
