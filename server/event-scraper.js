import {readFileSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {callClaude, finalText, extractJson} from './claude.js';
import {reverseGeocode, geocodeAddress, distanceKm} from './geocode.js';

export const CATEGORIES = ['Wellness', 'Sport', 'Art', 'Food', 'Music', 'Design', 'Tech', 'Culture', 'Outdoor'];
const CACHE_FILE = '.cache/events.json';
const MAX_DISTANCE_KM = 60;

// The user's own scraper prompt stays verbatim in prompts/event-scraper.md;
// the format file only pins the JSON field names the app parses.
const prompt = () => [
  readFileSync('prompts/event-scraper.md', 'utf8'),
  readFileSync('prompts/event-scraper-format.md', 'utf8'),
].join('\n\n');

let cache = {};
const inFlight = new Map();
readFile(CACHE_FILE, 'utf8').then(text => { cache = JSON.parse(text); }).catch(() => {});
async function saveCache() {
  await mkdir('.cache', {recursive: true});
  await writeFile(CACHE_FILE, JSON.stringify(cache));
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const hash = text => [...text].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(36);

function describeRange(from, to) {
  const format = value => new Date(`${value}T12:00`).toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});
  return from === to ? format(from) : `the period from ${format(from)} to ${format(to)}`;
}

function guessCategory(raw) {
  if (CATEGORIES.includes(raw.category)) return raw.category;
  const text = `${raw.category || ''} ${(raw.tags || []).join(' ')} ${raw.name || ''}`.toLowerCase();
  const rules = [
    ['Music', /music|concert|jazz|band|dj|live|konzert/], ['Sport', /run|sport|game|football|soccer|fitness|bike|lauf/],
    ['Wellness', /yoga|wellness|meditation|pilates/], ['Food', /food|dinner|market|beer|wine|brunch|tasting/],
    ['Tech', /tech|startup|ai|hackathon|coding|founder|business|network/], ['Art', /art|gallery|exhibit|craft|museum/],
    ['Outdoor', /outdoor|park|hike|nature|garden|lake/], ['Design', /design|maker|studio/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'Culture';
}

function cleanTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!match) return null;
  return {date: match[1], time: match[2] || null};
}

async function normalize(raw, {from, to, center}) {
  const start = cleanTime(raw.start);
  if (!raw.name || !start || start.date < from || start.date > to) return null;
  const end = cleanTime(raw.end);
  let lat = Number(raw.lat), lng = Number(raw.lng);
  let located = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) > 0.01
    && distanceKm(center, {lat, lng}) <= MAX_DISTANCE_KM;
  if (!located && raw.address) {
    const point = await geocodeAddress(raw.address, center).catch(() => null);
    if (point && distanceKm(center, point) <= MAX_DISTANCE_KM) {
      lat = point.lat;
      lng = point.lng;
      located = true;
    }
  }
  if (!located) return null;
  const url = typeof raw.url === 'string' && /^https?:\/\//i.test(raw.url) ? raw.url : null;
  const tags = (Array.isArray(raw.tags) ? raw.tags : String(raw.tags || '').split(/\s+/))
    .map(t => String(t).trim().replace(/^#?/, '#').replace(/\s+/g, '')).filter(t => t.length > 1).slice(0, 8);
  const price = Number.isFinite(Number(raw.price)) && raw.price !== null ? Number(raw.price) : null;
  const capacity = Number.isFinite(Number(raw.capacity)) && raw.capacity !== null ? Number(raw.capacity) : null;
  return {
    id: 'ai-' + hash(`${raw.name}|${start.date}|${start.time}`),
    source: 'ai',
    title: String(raw.name).slice(0, 120),
    organizer: String(raw.organizer || raw.venue || 'Unknown organizer').slice(0, 120),
    venue: String(raw.venue || raw.address || '').slice(0, 140),
    address: raw.address ? String(raw.address).slice(0, 200) : null,
    lat, lng,
    start: `${start.date}T${start.time || '12:00'}`,
    end: end?.time ? `${end.date}T${end.time}` : null,
    timeKnown: !!start.time,
    cost: raw.cost ? String(raw.cost).slice(0, 60) : price === 0 ? 'Free' : null,
    price,
    capacity,
    registrationRequired: raw.registration_required === true || raw.registration_required === 'true' || raw.registration_required === 'ja',
    url,
    description: raw.description ? String(raw.description).slice(0, 500) : '',
    interest: guessCategory(raw),
    mode: raw.mode === 'Professional' ? 'Professional' : 'Social',
    tags,
  };
}

export async function scrapeEvents({lat, lng, from, to, refresh = false}, settings) {
  if (!isoDate.test(from) || !isoDate.test(to) || from > to) throw Object.assign(new Error('Invalid date range'), {status: 400});
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw Object.assign(new Error('Invalid location'), {status: 400});
  const place = await reverseGeocode(lat, lng).catch(() => ({city: '', region: '', country: '', countryCode: ''}));
  const key = `${place.city || `${lat.toFixed(2)},${lng.toFixed(2)}`}|${place.region}|${from}|${to}`;
  const cached = cache[key];
  if (!refresh && cached && Date.now() - cached.fetchedAt < settings.cacheHours * 3600e3) return {...cached, cached: true};
  if (!settings.apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY is missing in .env'), {status: 503, code: 'missing_key'});
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    const cityLine = [place.city, place.region, place.country].filter(Boolean).join(', ') || 'the city at these coordinates';
    const response = await callClaude({
      apiKey: settings.apiKey,
      model: settings.model,
      system: prompt(),
      tools: [{
        type: 'web_search_20250305', name: 'web_search', max_uses: settings.maxSearches,
        ...(place.city ? {user_location: {type: 'approximate', city: place.city, region: place.region || undefined, country: place.countryCode || undefined}} : {}),
      }],
      messages: [{role: 'user', content: `City: ${cityLine} (current location ${lat.toFixed(4)}, ${lng.toFixed(4)})\nDate: ${describeRange(from, to)} (${from}${from === to ? '' : ` to ${to}`})`}],
    });
    const parsed = extractJson(finalText(response));
    const list = Array.isArray(parsed) ? parsed : parsed.events || [];
    const center = {lat, lng};
    const events = [];
    for (const raw of list.slice(0, 25)) {
      const event = await normalize(raw, {from, to, center}).catch(() => null);
      if (event && !events.some(e => e.id === event.id)) events.push(event);
    }
    const result = {city: place.city, region: place.region, from, to, events, received: list.length, fetchedAt: Date.now(), model: settings.model};
    cache[key] = result;
    saveCache().catch(() => {});
    return result;
  })();
  inFlight.set(key, job);
  try { return await job; } finally { inFlight.delete(key); }
}
