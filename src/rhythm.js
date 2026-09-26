import {visibleConnections, distanceMiles, fyScore} from './logic.js';

// "Rhythm": what Out There has picked up about the user. It starts with a
// few tapped interests and grows through saves, joins, skips and one-tap
// answers. Everything here is plain data the user can see and remove.

export const INTEREST_CHIPS = [
  {id: 'movement', label: 'Movement', categories: ['Sport'], phrase: 'movement'},
  {id: 'food', label: 'Food', categories: ['Food'], phrase: 'food'},
  {id: 'music', label: 'Music', categories: ['Music'], phrase: 'live music'},
  {id: 'artdesign', label: 'Art + Design', categories: ['Art', 'Design'], phrase: 'art + design'},
  {id: 'outdoors', label: 'Outdoors', categories: ['Outdoor'], phrase: 'being outside'},
  {id: 'wellness', label: 'Wellness', categories: ['Wellness'], phrase: 'wellness'},
  {id: 'culture', label: 'Culture', categories: ['Culture'], phrase: 'culture'},
  {id: 'networking', label: 'Networking', categories: ['Tech'], phrase: 'meeting builders'},
  {id: 'community', label: 'Community', categories: ['Food', 'Culture'], phrase: 'community things'},
  {id: 'new', label: 'Something new', categories: [], phrase: 'trying new things'},
];

const CATEGORY_PHRASE = {Sport: 'movement', Wellness: 'wellness', Art: 'art + design', Design: 'art + design', Food: 'food', Music: 'live music', Outdoor: 'being outside', Culture: 'culture', Tech: 'meeting builders'};

export const MOODS = [
  {id: 'move', label: 'Move', match: e => ['Sport', 'Wellness', 'Outdoor'].includes(e.interest)},
  {id: 'meet', label: 'Meet people', match: e => e.source === 'community' || ['Food', 'Culture', 'Tech', 'Design'].includes(e.interest) || /social|meetup|dinner|club|market|opening|together/i.test(e.title)},
  {id: 'food', label: 'Food', match: e => e.interest === 'Food' || (e.tags || []).some(t => /food|dinner|brunch|market/i.test(t))},
  {id: 'random', label: 'Something random', match: (e, profile) => !categoriesOf(profile).includes(e.interest)},
];

export const STAGES = [
  {id: 'day1', label: 'Day 1', note: 'Knows a few interests.'},
  {id: 'week1', label: 'Week 1', note: 'Knows your usual event types, distance and times.'},
  {id: 'later', label: 'Later', note: 'Works around your calendar and spots free windows.'},
];

const KEY = 'out-there-rhythm';
export const defaultProfile = () => ({
  onboarded: false, picks: [], stage: 'day1', personalization: true,
  availability: null, availabilityDay: null, outdoorPriority: null, calendar: false,
  notForMe: [], lessOf: {}, moreOf: {}, removed: [], budget: 40, distance: 'nearby',
  seenCards: [], saves: 0,
});
export function loadProfile() {
  try { return {...defaultProfile(), ...JSON.parse(localStorage.getItem(KEY))}; } catch { return defaultProfile(); }
}
export function saveProfile(profile) {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* session only */ }
}

// Stage presets for the demo: what Out There would have learned by then.
export function applyStage(profile, stage) {
  const picks = profile.picks.length ? profile.picks : ['movement', 'artdesign'];
  const base = {...profile, stage, picks, seenCards: [], removed: [], availability: null, outdoorPriority: null};
  if (stage === 'day1') return {...base, calendar: false, budget: 40, distance: 'nearby'};
  if (stage === 'week1') return {...base, calendar: false, budget: 40, distance: 'nearby'};
  return {...base, calendar: true, budget: 40, distance: 'nearby'};
}
const stageIndex = profile => STAGES.findIndex(s => s.id === profile.stage);
export const knowsHabits = profile => stageIndex(profile) >= 1;
export const knowsWindows = profile => stageIndex(profile) >= 2 && profile.calendar;

export function categoriesOf(profile) {
  return [...new Set(profile.picks.flatMap(id => INTEREST_CHIPS.find(c => c.id === id)?.categories || []))];
}
const isRemoved = (profile, id) => profile.removed.includes(id);

// ---------- time helpers ----------
export const greeting = (name, now = new Date()) => {
  const h = now.getHours();
  return `${h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${name}`;
};
export const minutesAway = (from, to) => {
  const miles = distanceMiles(from, to);
  return Math.max(3, Math.round(miles <= 1 ? miles * 20 : miles * 2.6 + 6));
};
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
// A simple weekday 9–5 schedule stands in for connected free/busy data.
export const isBusy = (profile, time) => {
  if (!profile.calendar) return false;
  const d = new Date(time), day = d.getDay(), h = d.getHours();
  return day > 0 && day < 6 && h >= 9 && h < 17;
};

// ---------- ranking ----------
export function rhythmScore(event, profile, ctx) {
  const categories = categoriesOf(profile);
  let score = fyScore(event, {...ctx, user: {...ctx.user, interests: isRemoved(profile, 'likes') ? [] : categories}});
  score += (profile.moreOf[event.interest] || 0) * 1.5 - (profile.lessOf[event.interest] || 0) * 2.5;
  if (profile.outdoorPriority && event.outdoor) score += 2;
  if (knowsHabits(profile)) {
    if (!isRemoved(profile, 'budget') && event.price > profile.budget) score -= 2;
    if (!isRemoved(profile, 'nearby') && ctx.location) {
      const limit = {walkable: 15, nearby: 25, anywhere: 999}[profile.distance];
      if (minutesAway(ctx.location, event) > limit) score -= 1.5;
    }
    if (!isRemoved(profile, 'evenings') && new Date(event.start).getHours() >= 17) score += 0.8;
  }
  if (knowsWindows(profile)) score += isBusy(profile, event.start) ? -3 : 1;
  const today = sameDay(event.start, ctx.now);
  if (profile.availabilityDay && sameDay(profile.availabilityDay, event.start)) {
    if (profile.availability === 'nottoday') score -= 4;
    if (profile.availability === 'allday') score += 1.5;
    if (profile.availability === 'until2') score += new Date(event.end).getHours() <= 14 ? 2 : -2;
  } else if (today) score += 0.3;
  return score;
}

export function rankWithRhythm(events, profile, ctx) {
  const list = events.filter(e => !profile.notForMe.includes(e.id));
  if (!profile.personalization) return list.sort((a, b) => a.start - b.start);
  return list.sort((a, b) => rhythmScore(b, profile, ctx) - rhythmScore(a, profile, ctx) || a.start - b.start);
}

// ---------- "Why this" ----------
export function reasonsFor(event, profile, ctx) {
  if (!profile.personalization) return [];
  const reasons = [];
  const categories = categoriesOf(profile);
  if (categories.includes(event.interest) && !isRemoved(profile, 'likes')) reasons.push(`You like ${CATEGORY_PHRASE[event.interest] || event.interest.toLowerCase()}`);
  else if (profile.picks.includes('new')) reasons.push('Something new');
  if (profile.moreOf[event.interest]) reasons.push('More like what you saved');
  if (ctx.location) reasons.push(`${minutesAway(ctx.location, event)} min away`);
  const hour = new Date(event.start).getHours(), day = new Date(event.start).getDay();
  if (knowsWindows(profile) && !isBusy(profile, event.start)) reasons.push('Fits your free time');
  else if (profile.availability === 'until2' && sameDay(profile.availabilityDay, event.start) && new Date(event.end).getHours() <= 14) reasons.push('Fits your free time');
  else if (hour >= 17) reasons.push('Fits your evening');
  else if ((day === 0 || day === 6) && hour < 12 && knowsHabits(profile)) reasons.push('Fits your weekend morning');
  if (profile.outdoorPriority && event.outdoor) reasons.push('Outdoors');
  const friends = visibleConnections(event, ctx.connections, ctx.user.id);
  if (friends.length === 1) reasons.push(`${friends[0].name} is going`);
  if (friends.length > 1) reasons.push(`${friends.length} connections interested`);
  if (event.sponsored) reasons.push('Partner event');
  return reasons.slice(0, 5);
}

// ---------- "What Out There knows" ----------
export function learnedSignals(profile) {
  const likes = profile.picks.map(id => INTEREST_CHIPS.find(c => c.id === id)?.phrase).filter(Boolean);
  const list = [];
  if (likes.length) list.push({id: 'likes', text: `Likes ${likes.slice(0, 3).join(' + ')}`, edit: 'likes'});
  if (knowsHabits(profile)) {
    list.push({id: 'nearby', text: {walkable: 'Prefers things within walking distance', nearby: 'Prefers things nearby', anywhere: 'Happy to go anywhere in town'}[profile.distance], edit: 'distance'});
    list.push({id: 'evenings', text: 'Usually looks for plans in the evening'});
    list.push({id: 'budget', text: profile.budget ? `Usually chooses events under $${profile.budget}` : 'Price doesn’t matter much', edit: 'budget'});
  }
  if (stageIndex(profile) >= 2) {
    list.push({id: 'weekend-mornings', text: 'Usually free on weekend mornings'});
    list.push({id: 'spontaneous', text: 'Often makes spontaneous plans'});
  }
  if (profile.outdoorPriority) list.push({id: 'outdoor', text: 'Outdoor plans first while the weather is good'});
  if (profile.availability && profile.availabilityDay && sameDay(profile.availabilityDay, Date.now())) {
    list.push({id: 'today', text: {until2: 'Free today until 2 PM', allday: 'Free all day today', nottoday: 'Taking today off'}[profile.availability]});
  }
  for (const [category, n] of Object.entries(profile.moreOf)) if (n > 0) list.push({id: `more-${category}`, text: `More ${CATEGORY_PHRASE[category] || category.toLowerCase()}`});
  for (const [category, n] of Object.entries(profile.lessOf)) if (n > 0) list.push({id: `less-${category}`, text: `Fewer ${category.toLowerCase()} events`});
  return list.filter(item => !profile.removed.includes(item.id));
}

export function removeSignal(profile, id) {
  const next = {...profile, removed: [...new Set([...profile.removed, id])]};
  if (id === 'outdoor') next.outdoorPriority = false;
  if (id === 'today') next.availability = null;
  if (id.startsWith('less-')) next.lessOf = {...profile.lessOf, [id.slice(5)]: 0};
  if (id.startsWith('more-')) next.moreOf = {...profile.moreOf, [id.slice(5)]: 0};
  return next;
}

// ---------- Ask Out There: understand a short request ----------
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export function parseAsk(text, now = new Date(), connections = []) {
  const t = text.toLowerCase();
  const start = new Date(now);
  let from = now.getTime(), to = now.getTime() + 7 * 86400e3, label = 'this week';
  const dayIndex = DAYS.findIndex(d => t.includes(d));
  let day = null;
  if (/tomorrow/.test(t)) { day = new Date(start); day.setDate(day.getDate() + 1); }
  else if (/today|tonight/.test(t)) day = new Date(start);
  else if (/weekend/.test(t)) { day = new Date(start); day.setDate(day.getDate() + ((6 - day.getDay() + 7) % 7)); }
  else if (dayIndex >= 0) { day = new Date(start); day.setDate(day.getDate() + ((dayIndex - day.getDay() + 7) % 7)); }
  const part = /morning/.test(t) ? [8, 12] : /afternoon/.test(t) ? [12, 18] : /evening|tonight/.test(t) ? [17, 23] : null;
  if (day) {
    const [a, b] = part || [8, 23];
    day.setHours(0, 0, 0, 0);
    if (dayIndex >= 0 && sameDay(day, now) && now.getHours() >= b) day.setDate(day.getDate() + 7);
    from = Math.max(now.getTime(), new Date(day).setHours(a)); to = new Date(day).setHours(b);
    if (/weekend/.test(t)) to = new Date(day).setHours(24 + 23);
    label = `${sameDay(day, now) ? 'today' : day.toLocaleDateString('en-US', {weekday: 'long'})}${part ? ` ${/tonight/.test(t) ? 'night' : ['morning', 'afternoon', 'evening'].find(p => t.includes(p)) || ''}` : ''}`.trim();
  }
  const hours = t.match(/(\d+)\s*(?:h|hours?)/);
  if (hours && !day) {
    from = now.getTime(); to = from + Number(hours[1]) * 3600e3; label = `the next ${hours[1]} hours`;
    if (now.getHours() >= 21) { const next = new Date(now); next.setDate(next.getDate() + 1); from = next.setHours(10, 0, 0, 0); to = from + Number(hours[1]) * 3600e3; label = `tomorrow, ${hours[1]} hours`; }
  }
  if (/out of the house|bored|right now|now\b/.test(t) && !day && !hours) { from = now.getTime(); to = from + 8 * 3600e3; label = 'the next few hours'; }
  const price = t.match(/(?:under|below|less than|max)\s*\$?\s*(\d+)/) || t.match(/\$(\d+)/);
  const maxPrice = /free (stuff|events|things)|for free|no cost/.test(t) ? 0 : price ? Number(price[1]) : null;
  const outdoor = /outdoor|outside|nature|park|fresh air/.test(t);
  const move = /move|run|active|sport|workout|climb/.test(t);
  const food = /food|eat|dinner|brunch|hungry/.test(t);
  const people = connections.filter(c => t.includes(c.name.toLowerCase()));
  return {from, to, label, maxPrice, outdoor, move, food, people, soon: label === 'the next few hours'};
}

export function askLocal(query, events, profile, ctx) {
  const pick = (strict) => events.filter(e => e.end > ctx.now && e.start < query.to && e.end > query.from
    && (!strict || query.maxPrice === null || (e.price ?? 0) <= query.maxPrice)
    && (!strict || !query.outdoor || e.outdoor)
    && (!strict || !query.move || MOODS[0].match(e))
    && (!strict || !query.food || MOODS[2].match(e))
    && !profile.notForMe.includes(e.id));
  let candidates = pick(true), relaxed = false;
  if (!candidates.length) { candidates = pick(false); relaxed = true; }
  const score = e => rhythmScore(e, profile, ctx)
    + query.people.reduce((n, p) => n + ((p.interests || []).includes(e.interest) ? 2 : 0) + ((e.attendees || []).includes(p.id) ? 3 : 0), 0)
    - (query.soon ? (e.start - ctx.now) / 3600e3 * 0.3 : 0);
  const results = candidates.sort((a, b) => score(b) - score(a)).slice(0, 3);
  const who = ` that fit ${query.people.length === 1 ? 'both' : 'all'} of you`;
  const reply = !results.length ? 'Nothing fits that yet. Try another time?'
    : relaxed ? `Nothing matches exactly, but here’s the closest for ${query.label}.`
    : query.people.length ? `I found ${results.length === 1 ? 'one thing' : `${['', '', 'two', 'three'][results.length]} things`}${who}.` : `Here’s what fits ${query.label}.`;
  return {reply, events: results};
}
