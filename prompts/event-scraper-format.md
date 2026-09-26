## Technische Vorgaben für die App (JSON-Format)

- Nutze die Websuche, um echte, aktuell angekündigte Events im Zeitraum zu finden (Veranstaltungskalender der Stadt, Venues, Uni, Eventbrite, Meetup, Ticketanbieter, Vereine).
- Erfinde nichts. Nimm nur Events auf, die du in einer Quelle gefunden hast. Findest du weniger als 20, gib weniger zurück.
- Das Event muss im angegebenen Zeitraum stattfinden und in der Stadt oder im direkten Umland (max. ca. 30 km) liegen.
- Koordinaten: möglichst genau die Venue. Wenn du sie nicht sicher kennst, gib zusätzlich die vollständige Adresse an.
- Zeiten in lokaler Zeit der Stadt im Format `YYYY-MM-DDTHH:MM`. Unbekanntes Ende: `null`.
- Antworte ausschließlich mit einem einzigen JSON-Objekt, ohne Markdown, ohne Erklärungstext davor oder danach.

Schema:

```
{
  "city": "Stadtname",
  "events": [
    {
      "name": "Event Name",
      "organizer": "Event Veranstalter",
      "venue": "Name des Ortes",
      "address": "Straße Hausnummer, Stadt",
      "lat": 43.0731,
      "lng": -89.4012,
      "start": "2026-09-26T19:00",
      "end": "2026-09-26T21:00",
      "cost": "Kostenlos | 15 $ | 10–25 $",
      "price": 15,
      "capacity": 40,
      "registration_required": true,
      "url": "https://…",
      "description": "Ein Satz, worum es geht.",
      "category": "Wellness | Sport | Art | Food | Music | Design | Tech | Culture | Outdoor",
      "mode": "Social | Professional",
      "tags": ["#yoga", "#outdoor", "#beginnerfriendly"]
    }
  ]
}
```

`price` ist die Zahl in Landeswährung (0 bei kostenlos, `null` wenn unbekannt). `capacity` ist `null`, wenn keine Teilnehmerbegrenzung bekannt ist. `mode` ist `Professional` für Vorträge, Business-, Netzwerk- und Corporate-Events, sonst `Social`.
