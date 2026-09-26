import {callClaude, extractJson} from './claude.js';

// Event-Creator agent: collects interest signals ("intents") of people nearby,
// groups them by activity and free time slot, checks the weather and proposes
// a meetup once enough people overlap. The people here are simulated personas
// placed around the requesting location so the demo works in any city.

const ACTIVITIES = [
  {id: 'run', name: 'Group run', verb: 'running', category: 'Sport', mode: 'Social', outdoor: true, tags: ['#running', '#outdoor', '#allpaces']},
  {id: 'yoga', name: 'Yoga in the park', verb: 'do yoga outside', category: 'Wellness', mode: 'Social', outdoor: true, tags: ['#yoga', '#outdoor', '#beginnerfriendly']},
  {id: 'photo', name: 'Photo walk', verb: 'on a photo walk', category: 'Art', mode: 'Social', outdoor: true, tags: ['#photography', '#walk', '#creative']},
  {id: 'boardgames', name: 'Board game night', verb: 'play board games', category: 'Culture', mode: 'Social', outdoor: false, tags: ['#boardgames', '#indoor', '#newfriends']},
  {id: 'founders', name: 'Founder coffee', verb: 'talk startups over coffee', category: 'Tech', mode: 'Professional', outdoor: false, tags: ['#startup', '#networking', '#coffee']},
  {id: 'soccer', name: 'Pickup soccer', verb: 'play pickup soccer', category: 'Sport', mode: 'Social', outdoor: true, tags: ['#soccer', '#pickup', '#outdoor']},
  {id: 'sketch', name: 'Sketch & chill', verb: 'sketch together', category: 'Design', mode: 'Social', outdoor: false, tags: ['#drawing', '#design', '#slowliving']},
];
const SLOTS = [
  {id: 'sat-morning', day: 6, hour: 9, label: 'Saturday morning'},
  {id: 'sat-evening', day: 6, hour: 18, label: 'Saturday evening'},
  {id: 'sun-morning', day: 0, hour: 10, label: 'Sunday morning'},
  {id: 'sun-afternoon', day: 0, hour: 15, label: 'Sunday afternoon'},
  {id: 'wed-evening', day: 3, hour: 18, label: 'Wednesday evening'},
];
const THRESHOLD = 9;

// Deterministic pseudo random numbers: the same demo every time.
function seeded(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function simulatePersonas(center, count = 90) {
  const random = seeded(42);
  const weights = [4, 3.5, 2, 2.5, 2.5, 2, 1.5]; // running and yoga are popular
  const pick = () => {
    let r = random() * weights.reduce((a, b) => a + b, 0);
    return ACTIVITIES[weights.findIndex(w => (r -= w) < 0)];
  };
  return Array.from({length: count}, (_, i) => {
    const angle = random() * Math.PI * 2, km = 0.3 + random() * 3.2;
    const intents = [];
    for (let n = 0; n < 2; n++) {
      const slot = SLOTS[Math.floor(random() * (random() < 0.7 ? 4 : 5))];
      intents.push({activity: pick().id, slot: slot.id});
    }
    return {
      id: `p${i}`,
      lat: center.lat + (km / 111) * Math.sin(angle),
      lng: center.lng + (km / (111 * Math.cos(center.lat * Math.PI / 180))) * Math.cos(angle),
      intents,
    };
  });
}

export function clusterIntents(personas) {
  const groups = new Map();
  for (const person of personas) {
    for (const intent of person.intents) {
      const key = `${intent.activity}|${intent.slot}`;
      if (!groups.has(key)) groups.set(key, {activity: intent.activity, slot: intent.slot, members: []});
      const group = groups.get(key);
      if (!group.members.includes(person)) group.members.push(person);
    }
  }
  return [...groups.values()]
    .filter(g => g.members.length >= THRESHOLD - 4)
    .sort((a, b) => b.members.length - a.members.length)
    // one proposal per activity keeps the list varied
    .filter((g, i, all) => all.findIndex(x => x.activity === g.activity) === i);
}

function nextDate(today, weekday) {
  const date = new Date(today);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7));
  return date;
}
const pad = n => String(n).padStart(2, '0');
const localIso = (date, hour) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;

const WEATHER = {0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm'};

async function forecast(center) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${center.lat}&longitude=${center.lng}&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=14`;
    const data = await (await fetch(url)).json();
    const days = {};
    data.daily.time.forEach((day, i) => {
      days[day] = {summary: WEATHER[data.daily.weather_code[i]] || 'Mixed', tempMax: Math.round(data.daily.temperature_2m_max[i]), rain: data.daily.precipitation_probability_max[i] ?? 0, unit: data.daily_units?.temperature_2m_max || '°C'};
    });
    return days;
  } catch {
    return {};
  }
}

async function phrase(proposals, settings) {
  if (!settings.apiKey || !proposals.length) return {};
  try {
    const response = await callClaude({
      apiKey: settings.apiKey,
      model: settings.fastModel,
      maxTokens: 1500,
      timeoutMs: 30000,
      system: 'You are the Event-Creator agent of a map-based social app. People meet in person; no contact data is shared. For each proposal write a warm, short invitation in English: "title" (max 5 words) and "pitch" (max 2 sentences, mention how many people are interested, the time slot and the weather if relevant). Respond only with JSON: {"items":[{"id":"...","title":"...","pitch":"..."}]}',
      messages: [{role: 'user', content: JSON.stringify(proposals.map(p => ({id: p.id, activity: p.activityName, people: p.count, slot: p.slotLabel, weather: p.weather, outdoor: p.outdoor})))}],
    });
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return Object.fromEntries((extractJson(text).items || []).map(item => [item.id, item]));
  } catch {
    return {};
  }
}

export async function proposeEvents(center, settings, today = new Date()) {
  const personas = simulatePersonas(center);
  const weather = await forecast(center);
  const proposals = clusterIntents(personas).slice(0, 5).map(group => {
    const activity = ACTIVITIES.find(a => a.id === group.activity);
    const slot = SLOTS.find(s => s.id === group.slot);
    const date = nextDate(today, slot.day);
    if (new Date(date).setHours(slot.hour) < today.getTime()) date.setDate(date.getDate() + 7);
    const day = localIso(date, 0).slice(0, 10);
    const lat = group.members.reduce((n, m) => n + m.lat, 0) / group.members.length;
    const lng = group.members.reduce((n, m) => n + m.lng, 0) / group.members.length;
    const w = weather[day] || null;
    return {
      id: `proposal-${group.activity}-${group.slot}-${day}`,
      activity: activity.id, activityName: activity.name, category: activity.category, mode: activity.mode,
      outdoor: activity.outdoor, tags: activity.tags,
      slotLabel: slot.label, start: localIso(date, slot.hour), end: localIso(date, slot.hour + 2),
      count: group.members.length, threshold: THRESHOLD,
      lat, lng, weather: w,
      weatherRisk: !!(activity.outdoor && w && w.rain >= 60),
      title: activity.name,
      pitch: `${group.members.length} people nearby want to ${activity.verb} on ${slot.label}.${w ? ` Forecast: ${w.summary}, ${w.tempMax}${w.unit}.` : ''}`,
    };
  });
  const texts = await phrase(proposals, settings);
  for (const p of proposals) {
    if (texts[p.id]?.title) p.title = String(texts[p.id].title).slice(0, 60);
    if (texts[p.id]?.pitch) p.pitch = String(texts[p.id].pitch).slice(0, 280);
    p.aiWritten = !!texts[p.id];
  }
  return {proposals, personas: personas.length};
}
