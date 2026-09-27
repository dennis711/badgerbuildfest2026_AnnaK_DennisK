import {buildDemoEvents, user, connections, demoLocation, recommendationProfile, windowSaturday} from './data.js';
import {filterEvents, parseLocal} from './logic.js';
import {loadProfile, saveProfile, defaultProfile, applyStage, rankWithRhythm, reasonsFor, learnedSignals, removeSignal, categoriesOf, parseAsk, askLocal, greeting, minutesAway, MOODS, INTEREST_CHIPS, STAGES, knowsHabits} from './rhythm.js';
import {onboardingHTML, greetingHTML, whyThisHTML, contextCardHTML, knowsPageHTML, editSheetHTML, askSheetHTML, stageSwitcherHTML} from './moments.js';
import {icon} from './icons.js';
import {esc} from './escape.js';
import {createMap} from './map-view.js';
import {createTimeScrubber} from './time-scrubber.js';
import {createEventStore} from './event-store.js';
import {renderEventCard, bindCardGestures, sourceInfo, dateLabel, timeLabel} from './event-card.js';
import {renderWallet} from './wallet.js';
import {feedback} from './feedback.js';

const $ = selector => document.querySelector(selector);
const STORAGE_KEY = 'out-there-anna';
function readState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
const stored = readState();
const asSet = value => new Set(Array.isArray(value) ? value : []);
const today = new Date();

const store = createEventStore(buildDemoEvents(today));
const state = {
  range: {level: 'day', from: today, to: today},
  mode: stored.filters?.mode || recommendationProfile.defaultMode, interests: stored.filters?.interests || [], friends: !!stored.filters?.friends,
  tab: 'Map', selected: null, cardState: 'preview',
  saved: asSet(stored.saved), joined: asSet(stored.joined), acknowledged: asSet(stored.acknowledged),
  proposalJoins: asSet(stored.proposalJoins),
  clock: Date.now(), location: {...demoLocation}, locationResolved: false,
  proposals: [], proposalStatus: 'idle', aiEnabled: null,
  timeOfDay: stored.filters?.timeOfDay || 'any', maxMinutes: stored.filters?.maxMinutes ?? null, maxPrice: stored.filters?.maxPrice ?? null,
  moodId: null, spotlight: null, card: null, cardTimer: null, autoCollapsed: false,
  windowIndex: 0, lastSaved: null, ask: {messages: [], busy: false},
};
let profile = loadProfile();
const setProfile = next => { profile = next; saveProfile(profile); };
let map, scrubber, nearby = [], browseIds = [], toastTimer, modalOpener, fetchTimer;

const query = () => ({...state.range, mode: state.mode, interests: state.interests, friends: state.friends});
const ctx = () => ({user, connections, location: state.location, now: state.clock});
// Discovery filters set in Profile: time of day, distance, budget.
const TIME_OF_DAY = {any: [0, 24], morning: [5, 12], day: [12, 17], evening: [17, 24]};
function passesFilters(e) {
  const hour = new Date(e.start).getHours(), [a, b] = TIME_OF_DAY[state.timeOfDay] || TIME_OF_DAY.any;
  if (hour < a || hour >= b) return false;
  if (state.maxMinutes && minutesAway(state.location, e) > state.maxMinutes) return false;
  if (state.maxPrice !== null && (e.price ?? 0) > state.maxPrice) return false;
  return true;
}
const activeFilterCount = () => state.interests.length + Number(state.friends) + Number(state.mode !== recommendationProfile.defaultMode)
  + Number(state.timeOfDay !== 'any') + Number(!!state.maxMinutes) + Number(state.maxPrice !== null);
function visible() {
  let list = state.spotlight
    ? state.spotlight.ids.map(id => store.get(id)).filter(Boolean)
    : filterEvents(store.all(), query(), connections, user.id);
  if (!state.spotlight) list = list.filter(e => e.end > state.clock && passesFilters(e)); // what already ended isn't worth a pin
  const mood = MOODS.find(m => m.id === state.moodId);
  if (mood && profile.personalization && !state.spotlight) list = list.filter(e => mood.match(e, profile));
  return rankWithRhythm(list, profile, ctx());
}
const currentEvent = () => store.get(state.selected);
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({saved: [...state.saved], joined: [...state.joined], acknowledged: [...state.acknowledged], proposalJoins: [...state.proposalJoins], filters: {mode: state.mode, interests: state.interests, friends: state.friends, timeOfDay: state.timeOfDay, maxMinutes: state.maxMinutes, maxPrice: state.maxPrice}}));
  } catch { toast('Changes are kept for this session.'); }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}

$('#app').innerHTML = `<main class="app">
  <section id="map-view" aria-label="Discover nearby events"><div id="map" aria-label="Interactive event map"></div>
    <div class="top-stack"><div class="greeting" id="greeting"></div>
      <div class="ai-status" id="ai-status" role="status" hidden></div>
      <div class="map-notice" id="map-notice" role="status" hidden></div></div>
    <div class="map-tools"><button data-zoom="1" aria-label="Zoom in">+</button><button data-zoom="-1" aria-label="Zoom out">−</button><button id="locate" aria-label="Return to my location and today">${icon('me', 23)}</button></div>
    <div class="time-area"><div id="context-slot" class="context-slot"></div><button id="map-hint" class="map-hint" hidden></button><div id="time-control"></div></div>
    <section id="event-card" aria-label="Event details" hidden></section>
  </section>
  <section id="page-view" hidden><div class="page-inner"></div></section>
  <button class="profile-button" aria-label="Open Anna’s profile"><img src="${user.avatar}" alt="" width="40" height="40"></button>
  <nav class="bottom-nav" aria-label="Primary navigation">${[['Map', 'map'], ['Events', 'calendar'], ['Connections', 'people'], ['AI', 'ai']].map(([name, glyph]) => `<button data-tab="${name}" ${name === 'Map' ? 'aria-current="page"' : ''}>${icon(glyph, 22)}<span>${name}</span></button>`).join('')}</nav>
</main><div id="onboarding-root"></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div>`;

// ---------- rendering ----------
const rangeKey = () => `${state.range.from.toDateString()}|${state.range.to.toDateString()}`;
function currentRangeStatus() {
  return store.ranges().find(r => r.from === isoDate(state.range.from) && r.to === isoDate(state.range.to));
}
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeLabel() {
  const {level, from, to} = state.range;
  if (level === 'day') return from.toDateString() === today.toDateString() ? 'today' : from.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'});
  if (level === 'week') return `${from.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} – ${to.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`;
  return from.toLocaleDateString('en-US', {month: 'long'});
}

function updateStatus() {
  const status = currentRangeStatus(), el = $('#ai-status');
  const city = state.location.city || 'your area';
  if (status?.status === 'loading') {
    el.innerHTML = `<span class="ai-spark">${icon('ai', 14)}</span> Looking around ${esc(city)} · ${esc(rangeLabel())}`;
    el.className = 'ai-status loading';
    el.hidden = false;
  } else if (status?.status === 'error' || state.aiEnabled === false) {
    el.innerHTML = state.aiEnabled === false || status.code === 'missing_key'
      ? `${icon('ai', 14)} Sample events · add an API key for live ones`
      : `${icon('ai', 14)} Couldn’t load live events · <button data-action="retry">Retry</button>`;
    el.className = 'ai-status error';
    el.hidden = false;
  } else el.hidden = true;
}

// No placeholder card when nothing matches: the map just stays calm, with at
// most one quiet, tappable hint to widen the time window or the view.
function updateEmpty(list = nearby) {
  const hint = $('#map-hint');
  if (!hint) return;
  const all = visible(), loading = currentRangeStatus()?.status === 'loading';
  let text = '', action = '';
  if (state.selected || state.card || loading || list.length) text = '';
  else if (all.length) { text = `${all.length} more just outside this view`; action = 'fit'; }
  else if (state.range.level === 'day') { text = 'Quiet day · see the whole week'; action = 'week'; }
  else if (state.range.level === 'week') { text = 'Quiet week · see the month'; action = 'month'; }
  else if (activeFilterCount()) { text = 'Your filters are strict · adjust in Profile'; action = 'filters'; }
  hint.hidden = !text;
  hint.textContent = text;
  hint.dataset.hint = action;
}
function renderCard() {
  const event = currentEvent();
  // The card already shows who's going, so the reasons skip that line.
  const why = event && profile.personalization ? whyThisHTML(reasonsFor(event, profile, ctx()).filter(r => !/is going|connections interested/.test(r)), event.id) : '';
  renderEventCard($('#event-card'), {event, state, connections, user, location: state.location, ids: browseIds, why});
  updateEmpty();
}
function refresh({clearSelection = false} = {}) {
  const list = visible();
  if (clearSelection) { state.selected = null; state.cardState = 'preview'; }
  // A wallet or deep-linked event stays visible even outside the selected time.
  const selected = currentEvent();
  const mapEvents = selected && !list.some(e => e.id === selected.id) ? [...list, selected] : list;
  map?.update(mapEvents, state.selected);
  renderCard();
  updateStatus();
  renderGreeting();
  updateContextCard();
  if (state.tab !== 'Map') renderPage();
}

// ---------- events on the map ----------
function openEvent(id, groupIds = []) {
  const event = store.get(id);
  if (!event) return;
  const ranked = visible().map(e => e.id);
  const source = state.tab === 'Events' ? store.all().filter(e => state.joined.has(e.id) || state.saved.has(e.id)).map(e => e.id) : ranked.filter(i => nearby.some(e => e.id === i));
  browseIds = [...new Set([...groupIds, ...source, id])];
  state.selected = id;
  state.cardState = 'preview';
  switchTab('Map');
  refresh();
  requestAnimationFrame(() => map?.focus(event));
  $('#event-card').classList.remove('card-enter');
  void $('#event-card').offsetWidth;
  $('#event-card').classList.add('card-enter');
}
function closeCard() { state.selected = null; state.cardState = 'preview'; refresh(); }
function browse(direction) {
  const index = browseIds.indexOf(state.selected) + direction;
  if (index < 0 || index >= browseIds.length) return;
  state.selected = browseIds[index];
  const scroll = $('.card-scroll');
  if (scroll) scroll.scrollTop = 0;
  refresh();
  map?.focus(currentEvent());
  feedback('event-change');
}
function expandCard(value) { state.cardState = value || (state.cardState === 'full' ? 'preview' : 'full'); renderCard(); }

// ---------- AI: real events for the selected day / week / month ----------
function scheduleFetch({refresh: force = false, delay = 650} = {}) {
  clearTimeout(fetchTimer);
  if (state.aiEnabled === false && !force) return;
  fetchTimer = setTimeout(async () => {
    const {from, to} = state.range, key = rangeKey();
    const result = await store.loadRange(from, to, state.location, {refresh: force});
    if (result.city && !state.location.city) state.location.city = result.city;
    if (result.status === 'done' && !result.cached && key === rangeKey()) toast(`${result.count} new things around ${result.city || state.location.city || 'you'}`);
    if (result.code === 'missing_key') state.aiEnabled = false;
  }, delay);
}

// ---------- AI: Event-Creator proposals ----------
function communityEvent(p) {
  return {
    id: `community-${p.id}`, source: 'community', sponsored: false,
    host: {id: null, name: 'Out There community', kind: 'community', verified: true, rating: null},
    title: p.title, interest: p.category, mode: p.mode, start: parseLocal(p.start), end: parseLocal(p.end),
    lat: p.lat, lng: p.lng, venue: 'Meeting point on the map',
    description: `${p.pitch} Meet in person — no contact details are shared in the app.`,
    attendees: [], spots: null, price: 0, cost: 'Free', tags: p.tags, status: 'published', external: false, age: null,
    requirements: p.outdoor ? 'Outdoors · Check the weather before you go' : null, cover: null,
  };
}
function syncProposalEvents() {
  for (const p of state.proposals) {
    const people = p.count + Number(state.proposalJoins.has(p.id));
    if (state.proposalJoins.has(p.id) && people >= p.threshold && !store.get(`community-${p.id}`)) {
      store.add(communityEvent(p));
      state.joined.add(`community-${p.id}`);
    }
  }
}
async function loadProposals() {
  if (state.proposalStatus === 'loading') return;
  state.proposalStatus = 'loading';
  if (state.tab === 'AI') renderPage();
  try {
    const response = await fetch(`/api/proposals?lat=${state.location.lat}&lng=${state.location.lng}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    state.proposals = body.proposals;
    state.proposalStatus = 'done';
    syncProposalEvents();
  } catch {
    state.proposalStatus = 'error';
  }
  if (state.tab === 'AI') renderPage();
}
function joinProposal(id) {
  const p = state.proposals.find(x => x.id === id);
  if (!p) return;
  if (state.proposalJoins.has(id)) {
    state.proposalJoins.delete(id);
    state.joined.delete(`community-${id}`);
  } else {
    state.proposalJoins.add(id);
    syncProposalEvents();
    const people = p.count + 1;
    toast(people >= p.threshold ? 'It’s happening! The meetup is now on your map.' : `You’re in. ${p.threshold - people} more and it happens.`);
    feedback('joined');
  }
  persist();
  refresh();
}

// ---------- pages ----------
function switchTab(tab) {
  state.tab = tab;
  $('#map-view').hidden = tab !== 'Map';
  $('#page-view').hidden = tab === 'Map';
  document.querySelectorAll('[data-tab]').forEach(b => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (tab === 'Map') requestAnimationFrame(() => map?.resize());
  else {
    if (tab === 'AI' && state.proposalStatus === 'idle') loadProposals();
    renderPage();
  }
}

function proposalCard(p) {
  const mine = state.proposalJoins.has(p.id), people = p.count + Number(mine);
  const ready = people >= p.threshold, progress = Math.min(100, Math.round(people / p.threshold * 100));
  const when = `${dateLabel(parseLocal(p.start))} · ${timeLabel(parseLocal(p.start))}`;
  return `<article class="proposal">
    <div class="proposal-top"><span class="source-badge src-community">${icon('ai', 12)} Suggested by AI</span>${p.weather ? `<span class="weather ${p.weatherRisk ? 'risk' : ''}">${esc(p.weather.summary)} · ${esc(p.weather.tempMax)}${esc(p.weather.unit)}${p.weatherRisk ? ` · ${esc(p.weather.rain)}% rain` : ''}</span>` : ''}</div>
    <h3>${esc(p.title)}</h3><p>${esc(p.pitch)}</p>
    <p class="proposal-when">${icon('calendar', 14)} ${when}</p>
    <div class="proposal-progress" aria-label="${people} of ${p.threshold} people"><span style="width:${progress}%"></span></div>
    <div class="proposal-actions"><small>${people} interested · ${ready ? 'It’s happening' : `${p.threshold - people} more needed`}</small>
      <button class="${mine ? 'save-button saved' : 'join-button'}" data-proposal="${esc(p.id)}">${mine ? `I’m in ${icon('check', 14)}` : ready ? 'Join meetup' : 'I’m interested'}</button></div>
    ${mine && ready ? `<button class="text-button" data-event="community-${esc(p.id)}">Show on map ↗</button>` : ''}
  </article>`;
}

function renderPage() {
  const root = $('.page-inner');
  if (state.tab === 'Events') { root.innerHTML = renderWallet(store.all(), state); return; }
  if (state.tab === 'Connections') {
    root.innerHTML = `<div class="page-heading"><h1>Connections</h1><p>People you’ve met. Plans still to come.</p></div><div class="quiet-placeholder">${icon('people', 44)}<h2>It starts in person.</h2><p>Meet at an event, then connect there. Afterwards you’ll see when your connections join something on the map.</p><small>No public profiles. No people browsing.</small></div>`;
    return;
  }
  if (state.tab === 'AI') {
    const ranges = store.ranges().slice(-4).reverse();
    const proposals = state.proposalStatus === 'loading' ? '<p class="muted">Matching interests nearby…</p>'
      : state.proposalStatus === 'error' ? '<p class="muted">Suggestions are unavailable right now. <button class="text-button" data-action="reload-proposals">Try again</button></p>'
      : state.proposals.length ? state.proposals.map(proposalCard).join('') : '<p class="muted">No overlaps nearby yet.</p>';
    root.innerHTML = `<div class="page-heading"><h1>A little help getting out.</h1><p>The AI looks for real events around you and notices when enough people nearby want the same thing at the same time.</p></div>
      <h2 class="section-label">Meetups forming near you</h2><div class="proposals">${proposals}</div>
      <p class="privacy-copy">You meet in person. Nobody sees your profile or contact details. Interests of other people are simulated in this prototype.</p>
      <section><h2 class="section-label">Event scout</h2>
        <div class="scout-list">${ranges.length ? ranges.map(r => `<div class="scout-row"><span><strong>${esc(r.city || state.location.city || 'Nearby')}</strong><small>${esc(r.from)}${r.to !== r.from ? ` → ${esc(r.to)}` : ''}</small></span><span class="scout-state ${r.status}">${r.status === 'loading' ? 'Searching…' : r.status === 'done' ? `${r.count} events${r.cached ? ' · cached' : ''}` : r.code === 'missing_key' ? 'No API key' : 'Failed'}</span></div>`).join('') : '<p class="muted">Scroll the time scrubber on the map to search a day, week or month.</p>'}</div>
        <button class="text-button" data-action="refresh-ai">Search again for ${esc(rangeLabel())} ↻</button>
      </section>
      <section><h2 class="section-label">How events reach your map</h2><div class="legend">
        ${['partner', 'host', 'ai', 'community'].map(s => `<p><span class="pin src-${s}"><i></i></span>${sourceInfo({source: s}).label}</p>`).join('')}</div></section>`;
    return;
  }
  if (state.tab === 'Knows') {
    root.innerHTML = knowsPageHTML({profile, signals: learnedSignals(profile), connectionsCount: connections.length, locationLabel: `${state.location.isDemo ? 'Demo location' : 'On · approximate'} · ${state.location.city || 'Nearby'}`});
    return;
  }
  const likes = profile.picks.map(id => INTEREST_CHIPS.find(c => c.id === id)?.label).filter(Boolean);
  root.innerHTML = `<div class="page-heading"><img class="profile-portrait" src="${user.avatar}" alt="Illustrated demo portrait of Anna"><h1>Anna</h1><p>Your private profile</p></div><h2 class="section-label">What gets you out there</h2><div class="interest-tags">${(likes.length ? likes : ['Nothing picked yet']).map(i => `<span>${esc(i)}</span>`).join('')}<button class="text-button" data-edit-signal="likes">Edit</button></div>
    ${filtersHTML()}
    <button class="settings-link" data-tab="Knows"><span><strong>What Out There knows</strong><small>See and change what shapes your suggestions</small></span>${icon('arrow', 16)}</button>
    ${stageSwitcherHTML(profile.stage)}<div class="quiet-placeholder"><h2>Known by the people you know.</h2><p>Your full profile is only shared after a mutual connection.</p><small>${state.location.isDemo ? 'Demo location' : 'Current location'} · ${esc(state.location.city || 'Nearby')}</small></div><button class="text-button" data-tab="Map">Back to the map ↗</button>`;
}

// ---------- modals ----------
function openModal(content, label) {
  if (!$('#modal-root').children.length) modalOpener = document.activeElement;
  $('#modal-root').innerHTML = `<div class="backdrop"><section class="modal-sheet" role="dialog" aria-modal="true" aria-label="${label}">${content}</section></div>`;
  $('.app').inert = true;
  $('.modal-sheet button, .modal-sheet input')?.focus();
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  $('.app').inert = false;
  if (modalOpener?.isConnected) modalOpener.focus({preventScroll: true});
  updateContextCard();
}
function resetFilters() {
  Object.assign(state, {interests: [], friends: false, mode: recommendationProfile.defaultMode, timeOfDay: 'any', maxMinutes: null, maxPrice: null});
  persist(); refresh({clearSelection: true}); scrubber.refreshCounts();
}
function confirmLeave(event) {
  openModal(`<div class="modal-heading"><h2>Leave this event?</h2><button class="icon-button" data-action="close-modal" aria-label="Close confirmation">${icon('close')}</button></div><p>${esc(event.title)}</p><p class="muted">Your place will become available to someone else.</p><div class="confirmation-actions"><button class="save-button" data-action="close-modal">Stay joined</button><button class="join-button" data-leave="${esc(event.id)}">Leave event</button></div>`, 'Leave this event?');
}

// ---------- location ----------
async function cityName(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lng}`);
    const a = (await r.json()).address || {};
    return a.city || a.town || a.village || a.county || null;
  } catch { return null; }
}
function locate({quiet = false} = {}) {
  const done = () => {
    state.locationResolved = true;
    map?.home(state.location);
    scheduleFetch({delay: 0});
    loadProposals();
  };
  if (!navigator.geolocation || !window.isSecureContext) {
    if (!quiet) toast('Location needs HTTPS · showing Madison.');
    return done();
  }
  navigator.geolocation.getCurrentPosition(async position => {
    const {latitude: lat, longitude: lng} = position.coords;
    state.location = {lat, lng, isDemo: false, city: await cityName(lat, lng)};
    state.proposalStatus = 'idle';
    done();
  }, () => {
    if (!quiet) toast('Location unavailable · showing Madison.');
    done();
  }, {timeout: 8000, maximumAge: 60000});
}
function goNow() {
  state.selected = null;
  $('#greeting').classList.remove('compact');
  scrubber.setDate(today);
  map?.home(state.location);
  locate();
}

// ---------- adaptive layer: greeting & mood ----------
function renderGreeting() {
  const el = $('#greeting');
  if (!el) return;
  el.innerHTML = greetingHTML({hello: greeting(user.name), moodId: state.moodId, personalization: profile.personalization, spotlight: state.spotlight, filterCount: activeFilterCount()});
}
function selectMood(id) {
  state.moodId = state.moodId === id ? null : id;
  state.spotlight = null;
  refresh({clearSelection: true});
  scrubber.refreshCounts();
  const list = visible();
  if (state.moodId) {
    map?.fit(list);
    if (!list.length) toast('Quiet for this day. Try another day on the timeline.');
  }
  feedback('mood');
}

// ---------- onboarding ----------
let onboardingPicks = [];
function showOnboarding() {
  onboardingPicks = [...profile.picks];
  $('#onboarding-root').innerHTML = onboardingHTML(onboardingPicks);
  $('.app').inert = true;
}
function togglePick(id, button, editing = false) {
  const list = editing ? [...profile.picks] : onboardingPicks;
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1); else list.push(id);
  button.setAttribute('aria-pressed', String(index < 0));
  if (editing) { setProfile({...profile, picks: list, removed: profile.removed.filter(r => r !== 'likes')}); refresh(); return; }
  const start = $('[data-action="start-exploring"]');
  if (start) start.disabled = !onboardingPicks.length;
}
function finishOnboarding() {
  setProfile({...profile, onboarded: true, picks: onboardingPicks});
  const root = $('#onboarding-root .onboarding');
  root?.classList.add('leaving');
  setTimeout(() => { $('#onboarding-root').innerHTML = ''; $('.app').inert = false; }, 280);
  switchTab('Map');
  refresh();
  scheduleCard(2200);
}

// ---------- contextual moments (one at a time) ----------
const CARD_ORDER = {day1: ['free-today', 'more-like'], week1: ['tonight', 'outdoor', 'calendar'], later: ['window', 'calendar']};
const todayIso = () => new Date().toDateString();
function tonightEvents() {
  const now = Date.now();
  return rankWithRhythm(store.all().filter(e => new Date(e.start).toDateString() === todayIso() && e.end > now && new Date(e.start).getHours() >= 16), profile, ctx()).slice(0, 4);
}
function windowEvents() {
  const day = windowSaturday(new Date());
  const from = new Date(day).setHours(15, 30), to = new Date(day).setHours(19);
  const sarah = connections.find(c => c.id === 'sarah');
  const score = e => ((e.attendees || []).includes('sarah') ? 3 : 0) + (sarah.interests.includes(e.interest) ? 1 : 0) + (e.outdoor ? 1 : 0);
  return rankWithRhythm(store.all().filter(e => e.start >= from && e.start <= to), profile, ctx()).sort((a, b) => score(b) - score(a));
}
function nextCardId() {
  if (!profile.onboarded || !profile.personalization) return null;
  for (const id of CARD_ORDER[profile.stage] || []) {
    if (profile.seenCards.includes(id)) continue;
    if (id === 'more-like' && !state.lastSaved) continue;
    if (id === 'calendar' && profile.calendar) continue;
    if (id === 'tonight' && tonightEvents().length < 2) continue;
    if (id === 'window' && !windowEvents().length) continue;
    return id;
  }
  return null;
}
function buildCard(id) {
  const weekday = new Date().toLocaleDateString('en-US', {weekday: 'long'});
  if (id === 'free-today') return {id, eyebrow: 'Today', icon: 'sun', title: 'Free today?', actions: [{id: 'until2', label: 'Until 2'}, {id: 'allday', label: 'All day', primary: true}, {id: 'nottoday', label: 'Not today'}]};
  if (id === 'more-like') {
    const e = state.lastSaved;
    return {id, eyebrow: 'Saved', icon: 'save', title: 'Want more like this?', body: `More things like “${e.title}”.`, actions: [{id: 'yes', label: 'Yes', primary: true}, {id: 'no', label: 'Not really'}]};
  }
  if (id === 'tonight') {
    const n = tonightEvents().length;
    return {id, eyebrow: 'Tonight', icon: 'clock', title: 'You’ve got some time tonight.', body: `I found ${n} things that fit your usual ${weekday} vibe.`, actions: [{id: 'show', label: 'Show me', primary: true}, {id: 'later', label: 'Not now'}]};
  }
  if (id === 'outdoor') return {id, eyebrow: 'Nice out this week', icon: 'sun', title: 'Seems like outdoor plans are your kind of thing.', body: 'Want me to put them first while the weather is good?', actions: [{id: 'yes', label: 'Yes', primary: true}, {id: 'no', label: 'Not really'}]};
  if (id === 'calendar') return {id, eyebrow: 'Optional', icon: 'calendar', title: 'Want me to work around your schedule?', body: 'Connect your calendar and I’ll only suggest things when you’re actually free.', privacy: 'Out There can use your free/busy windows without displaying your event details.', actions: [{id: 'connect', label: 'Connect calendar', primary: true}, {id: 'later', label: 'Maybe later'}]};
  if (id === 'window') {
    const list = windowEvents(), event = list[state.windowIndex % list.length];
    const day = windowSaturday(new Date()).toDateString() === todayIso() ? 'this' : windowSaturday(new Date()).toLocaleDateString('en-US', {weekday: 'long'});
    const reasons = ['Fits your free time', event.outdoor ? 'Outdoors' : reasonsFor(event, profile, ctx())[0], (event.attendees || []).includes('sarah') ? 'Sarah might join' : null].filter(Boolean);
    return {id, kind: 'concierge', eyebrow: 'Your weekend', icon: 'ai', title: `You have a window ${day} afternoon.`, detail: ['4:00–7:00 PM', 'Good weather', 'Sarah is free too'], body: 'I found something you might actually like.', event, reasons, minutes: minutesAway(state.location, event), actions: [{id: 'plan', label: 'Make a plan', primary: true}, {id: 'else', label: 'Show me something else'}]};
  }
  return null;
}
function scheduleCard(delay = 1400) {
  clearTimeout(state.cardTimer);
  state.cardTimer = setTimeout(() => { if (!state.card) { state.card = nextCardId(); updateContextCard(); } }, delay);
}
function updateContextCard() {
  const slot = $('#context-slot');
  if (!slot) return;
  const blocked = state.tab !== 'Map' || state.selected || $('.modal-sheet') || !profile.onboarded;
  if (!state.card || blocked) { slot.innerHTML = ''; return; }
  const card = buildCard(state.card);
  if (!card) { state.card = null; slot.innerHTML = ''; return; }
  slot.innerHTML = contextCardHTML(card);
  if (!scrubber.isCollapsed()) { scrubber.collapse(); state.autoCollapsed = true; }
}
function finishCard(id, {next = true} = {}) {
  setProfile({...profile, seenCards: [...new Set([...profile.seenCards, id])]});
  state.card = null;
  updateContextCard();
  if (state.autoCollapsed) { scrubber.expand(); state.autoCollapsed = false; }
  if (next) scheduleCard(4000);
}
function dismissCard(id) { finishCard(id); }
function cardAction(id, action) {
  const day = new Date().toISOString();
  if (id === 'free-today') {
    setProfile({...profile, availability: action, availabilityDay: day, removed: profile.removed.filter(r => r !== 'today')});
    toast({until2: 'Got it. Morning plans first.', allday: 'Nice. Here’s what fits your day.', nottoday: 'Got it. Enjoy the quiet.'}[action]);
    if (action !== 'nottoday') scrubber.setDate(today);
  }
  if (id === 'more-like' && action === 'yes') {
    const c = state.lastSaved.interest;
    setProfile({...profile, moreOf: {...profile.moreOf, [c]: (profile.moreOf[c] || 0) + 1}, removed: profile.removed.filter(r => r !== `more-${c}`)});
    toast('Got it. More like this.');
  }
  if (id === 'tonight' && action === 'show') {
    const list = tonightEvents();
    state.spotlight = {label: `${list.length} picks for tonight`, ids: list.map(e => e.id)};
    state.moodId = null;
    scrubber.setDate(today);
    map?.fit(list);
  }
  if (id === 'outdoor') {
    setProfile({...profile, outdoorPriority: action === 'yes', removed: profile.removed.filter(r => r !== 'outdoor')});
    toast(action === 'yes' ? 'Outdoor plans first while it’s nice.' : 'Got it.');
  }
  if (id === 'calendar' && action === 'connect') return connectCalendar(() => finishCard(id));
  if (id === 'window' && action === 'else') {
    state.windowIndex++;
    updateContextCard();
    return;
  }
  if (id === 'window' && action === 'plan') {
    const list = windowEvents(), event = list[state.windowIndex % list.length];
    finishCard(id, {next: false});
    scrubber.setDate(new Date(event.start));
    return openEvent(event.id);
  }
  finishCard(id);
  refresh();
}
function connectCalendar(after) {
  openModal(`<div class="modal-heading"><h2>Connect calendar</h2><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div>
    <p class="muted">Choose a calendar. Out There only reads when you’re busy or free — never titles, people or places.</p>
    <div class="option-list"><button class="option" data-connect="google">Google Calendar</button><button class="option" data-connect="apple">Apple Calendar</button><button class="option" data-connect="outlook">Outlook</button></div>
    <p class="privacy-copy">${icon('lock', 12)} You can disconnect any time in “What Out There knows”.</p>`, 'Connect calendar');
  state.afterCalendar = after;
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-connect]');
  if (!button) return;
  setProfile({...profile, calendar: true});
  closeModal();
  toast('Calendar connected · only free/busy is used.');
  const after = state.afterCalendar;
  state.afterCalendar = null;
  if (after) after();
  refresh();
});

// ---------- feedback ----------
function notForMe(id) {
  const event = store.get(id);
  setProfile({...profile, notForMe: [...profile.notForMe, id], lessOf: {...profile.lessOf, [event.interest]: (profile.lessOf[event.interest] || 0) + 1}, removed: profile.removed.filter(r => r !== `less-${event.interest}`)});
  toast('Got it — fewer like this.');
  const index = browseIds.indexOf(id);
  browseIds = browseIds.filter(x => x !== id);
  const next = browseIds[Math.min(index, browseIds.length - 1)];
  if (next) { state.selected = next; refresh(); map?.focus(currentEvent()); } else closeCard();
  scrubber.refreshCounts();
}

// ---------- demo stages ----------
function switchStage(stage) {
  setProfile({...applyStage(profile, stage), onboarded: true});
  state.card = null; state.spotlight = null; state.moodId = null; state.windowIndex = 0;
  toast(`Showing ${STAGES.find(s => s.id === stage).label}: ${STAGES.find(s => s.id === stage).note}`);
  refresh();
  scheduleCard(1200);
}

// ---------- Ask Out There ----------
function openAsk() {
  openModal(askSheetHTML(state.ask.messages, state.ask.busy), 'Ask Out There');
  $('.modal-sheet').classList.add('ask-sheet');
  $('#ask-text')?.focus();
}
function renderAsk() {
  const sheet = $('.modal-sheet');
  if (!sheet) return;
  sheet.innerHTML = askSheetHTML(state.ask.messages, state.ask.busy);
  // Keep the latest question and the start of the answer in view.
  const thread = sheet.querySelector('.ask-thread');
  const lastUser = [...thread.querySelectorAll('.bubble.user')].pop();
  thread.scrollTop = lastUser ? lastUser.offsetTop - thread.offsetTop - 8 : 0;
}
function eventActions(event, people) {
  const saved = state.saved.has(event.id);
  return [
    `<button class="join-button" data-event="${esc(event.id)}">View & join</button>`,
    `<button class="save-button ${saved ? 'saved' : ''}" data-save="${esc(event.id)}">${saved ? 'Saved' : 'Save'}</button>`,
    ...people.slice(0, 1).map(p => `<button class="save-button" data-ask-invite="${esc(p.name)}">Invite ${esc(p.name)}</button>`),
    profile.calendar && !people.length ? `<button class="save-button" data-ask-calendar="${esc(event.id)}">Add to calendar</button>` : '',
  ].join('');
}
async function askServer(text, query, candidates) {
  if (state.aiEnabled === false || !candidates.length) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('/api/ask', {
      method: 'POST', signal: controller.signal, headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        text, now: new Date().toString(), window: query.label, people: query.people.map(p => ({name: p.name, likes: p.interests})),
        likes: categoriesOf(profile), budget: knowsHabits(profile) ? profile.budget : null,
        events: candidates.map(e => ({id: e.id, title: e.title, category: e.interest, start: new Date(e.start).toString(), price: e.price ?? null, minutes: minutesAway(state.location, e), outdoor: !!e.outdoor, friends: (e.attendees || []).filter(a => connections.some(c => c.id === a)).map(a => connections.find(c => c.id === a).name)})),
      }),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const events = (body.ids || []).map(id => candidates.find(e => e.id === id)).filter(Boolean).slice(0, 3);
    return events.length ? {reply: body.reply, events} : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
async function submitAsk(text) {
  state.ask.messages.push({role: 'user', text});
  state.ask.busy = true;
  renderAsk();
  const query = parseAsk(text, new Date(), connections);
  const local = askLocal(query, store.all(), profile, ctx());
  const wide = askLocal({...query, maxPrice: null, outdoor: false, move: false, food: false}, store.all(), profile, ctx());
  const pool = [...new Map([...local.events, ...wide.events, ...rankWithRhythm(store.all().filter(e => e.end > Date.now() && e.start < query.to && e.end > query.from), profile, ctx()).slice(0, 12)].map(e => [e.id, e])).values()];
  const [answer] = await Promise.all([askServer(text, query, pool), new Promise(r => setTimeout(r, 700))]);
  const result = answer || local;
  state.ask.messages.push({
    role: 'bot', text: result.reply,
    events: result.events.map(event => ({event, reasons: reasonsFor(event, profile, ctx()).filter(r => !/min away/.test(r)).slice(0, 2), minutes: minutesAway(state.location, event), actions: eventActions(event, query.people)})),
  });
  state.ask.busy = false;
  renderAsk();
}

// ---------- discovery filters (in Profile) ----------
function setFilter(spec) {
  const [key, raw] = spec.split(':');
  const value = raw === 'null' ? null : ['maxMinutes', 'maxPrice'].includes(key) ? Number(raw) : raw;
  state[key] = value;
  persist();
  refresh({clearSelection: true});
  scrubber.refreshCounts();
}
function followHint(action) {
  if (action === 'fit') return map?.fit(visible());
  if (action === 'week') return scrubber.setLevel(1);
  if (action === 'month') return scrubber.setLevel(2);
  if (action === 'filters') { switchTab('Profile'); document.getElementById('filters')?.scrollIntoView({block: 'start'}); }
}
function filtersHTML() {
  const seg = (key, options) => `<div class="segmented" role="group">${options.map(([value, label]) => `<button data-filter="${key}:${value}" aria-pressed="${String(state[key]) === String(value)}">${label}</button>`).join('')}</div>`;
  return `<section id="filters" class="filters-section"><div class="section-head"><h2 class="section-label">Discovery &amp; event filters</h2>${activeFilterCount() ? '<button class="text-button" data-action="reset-filters">Reset</button>' : ''}</div>
    <p class="muted filter-note">Applies to the map right away. ${visible().length} ${visible().length === 1 ? 'event matches' : 'events match'} ${esc(rangeLabel())}.</p>
    <h3>Show</h3>${seg('mode', [['For you', 'For you'], ['Social', 'Social'], ['Professional', 'Professional']])}
    <h3>Categories</h3><div class="interest-options">${['Wellness', 'Sport', 'Art', 'Food', 'Music', 'Design', 'Tech', 'Culture', 'Outdoor'].map(i => `<button data-interest="${i}" aria-pressed="${state.interests.includes(i)}">${i}</button>`).join('')}</div>
    <h3>Distance</h3>${seg('maxMinutes', [['null', 'Any'], [15, '≤ 15 min'], [25, '≤ 25 min']])}
    <h3>Timing</h3>${seg('timeOfDay', [['any', 'Any time'], ['morning', 'Mornings'], ['day', 'Daytime'], ['evening', 'Evenings']])}
    <h3>Budget</h3>${seg('maxPrice', [['null', 'Any'], [0, 'Free'], [20, '≤ $20'], [40, '≤ $40']])}
    <label class="friend-toggle"><span><strong>With my connections</strong><small>Only shared attendance is visible.</small></span><input id="friends" type="checkbox" ${state.friends ? 'checked' : ''}></label>
  </section>`;
}

// ---------- startup ----------
scrubber = createTimeScrubber($('#time-control'), {
  today,
  countFor: range => filterEvents(store.all(), {...query(), ...range}, connections, user.id).filter(e => e.end > state.clock && passesFilters(e) && !profile.notForMe.includes(e.id)).length,
  onChange: range => {
    state.range = range;
    refresh({clearSelection: true});
    if (state.locationResolved) scheduleFetch();
  },
});
if (window.L) map = createMap({location: state.location, onSelect: openEvent, onMove: list => { nearby = list; updateEmpty(list); }, onPan: () => $('#greeting').classList.add('compact'), onClose: closeCard, onError: message => { $('#map-notice').textContent = message; $('#map-notice').hidden = false; }});
else { $('#map-notice').textContent = 'The map library could not load. Reload to try again.'; $('#map-notice').hidden = false; }
$('#time-control').addEventListener('scrubber-toggle', e => $('#map-view').classList.toggle('map-view-collapsed', e.detail.collapsed));
bindCardGestures($('#event-card'), {getState: () => state.cardState, onExpand: expandCard, onClose: closeCard, onBrowse: browse});
store.subscribe(() => { refresh(); scrubber.refreshCounts(); });

fetch('/api/status').then(r => r.json()).then(s => { if (!s.ai) { state.aiEnabled = false; updateStatus(); } }).catch(() => {}).finally(() => locate({quiet: true}));

// ---------- interaction ----------
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.closest('.scrubber')) return;
  const d = button.dataset;
  if (d.tab) { switchTab(d.tab); if (d.scroll) document.getElementById(d.scroll)?.scrollIntoView({behavior: 'smooth', block: 'start'}); return; }
  if (button.matches('.profile-button')) return switchTab('Profile');
  if (d.filter) return setFilter(d.filter);
  if (d.hint) return followHint(d.hint);
  if (d.event) {
    if ($('.modal-sheet')) { closeModal(); const e = store.get(d.event); if (e) scrubber.setDate(new Date(e.start)); }
    return openEvent(d.event);
  }
  if (d.browse) return browse(+d.browse);
  if (d.zoom) return map?.zoom(+d.zoom);
  if (d.proposal) return joinProposal(d.proposal);
  if (d.host) {
    const e = store.get(d.host);
    return toast(e.source === 'ai' ? `${e.host.name} · Found on the web. Not a verified host yet.` : e.source === 'community' ? 'Created from matching interests nearby.' : `${e.host.name} · ${sourceInfo(e).label}. Host profiles are coming later.`);
  }
  if (d.save) {
    if (state.saved.has(d.save)) state.saved.delete(d.save);
    else { state.saved.add(d.save); state.lastSaved = store.get(d.save); setProfile({...profile, saves: profile.saves + 1}); }
    persist(); renderCard(); if ($('.ask-thread')) renderAsk(); return;
  }
  if (d.join) {
    const e = store.get(d.join);
    if (e.external) return toast('Demo ticket link · Tickets will open on the host’s website.');
    if (state.joined.has(e.id)) return confirmLeave(e);
    state.joined.add(e.id); persist(); renderCard(); feedback('joined'); return;
  }
  if (d.leave) { state.joined.delete(d.leave); persist(); closeModal(); renderCard(); return; }
  if (d.acknowledge) { state.acknowledged.add(d.acknowledge); persist(); renderPage(); return; }
  if (d.share) {
    const e = store.get(d.share), url = `${location.origin}/?event=${e.id}`;
    try { if (navigator.share) await navigator.share({title: e.title, url}); else { await navigator.clipboard.writeText(url); toast('Event link copied.'); } } catch (error) { if (error.name !== 'AbortError') toast('Sharing is unavailable in this browser.'); }
    return;
  }
  if (d.interest) {
    state.interests = state.interests.includes(d.interest) ? state.interests.filter(i => i !== d.interest) : [...state.interests, d.interest];
    persist(); refresh({clearSelection: true}); scrubber.refreshCounts();
    return;
  }
  if (d.mood) return selectMood(d.mood);
  if (d.cardDismiss) return dismissCard(d.cardDismiss);
  if (d.cardAction) return cardAction(...d.cardAction.split(':'));
  if (d.notForMe) return notForMe(d.notForMe);
  if (d.pick) return togglePick(d.pick, button);
  if (d.editPick) { togglePick(d.editPick, button, true); return; }
  if (d.stage) return switchStage(d.stage);
  if (d.removeSignal) { setProfile(removeSignal(profile, d.removeSignal)); toast('Removed. Out There won’t use that anymore.'); refresh(); return; }
  if (d.editSignal) return openModal(editSheetHTML(d.editSignal, profile), 'Edit');
  if (d.editValue) { const [kind, value] = d.editValue.split(':'); setProfile({...profile, [kind]: kind === 'budget' ? Number(value) : value, removed: profile.removed.filter(r => r !== (kind === 'budget' ? 'budget' : 'nearby'))}); closeModal(); refresh(); return; }
  if (d.ask) return submitAsk(d.ask);
  if (d.askInvite) return toast(`Sent to ${d.askInvite} in Out There. No numbers shared.`);
  if (d.askCalendar) return toast('Added to your calendar.');
  switch (button.id) {
    case 'locate': return goNow();
  }
  switch (d.action) {
    case 'close-card': return closeCard();
    case 'expand': return expandCard();
    case 'close-modal': return closeModal();
    case 'reset-filters': resetFilters(); return toast('Filters cleared.');
    case 'retry': return scheduleFetch({refresh: true, delay: 0});
    case 'refresh-ai': state.aiEnabled = null; scheduleFetch({refresh: true, delay: 0}); return;
    case 'reload-proposals': state.proposalStatus = 'idle'; return loadProposals();
    case 'more': return openModal(`<div class="modal-heading"><h2>Event options</h2><button class="icon-button" data-action="close-modal" aria-label="Close options">${icon('close')}</button></div><button class="report-button" data-action="report">Report this event</button>`, 'Event options');
    case 'report': closeModal(); return toast('Demo report action · Nothing has been submitted.');
    case 'start-exploring': return finishOnboarding();
    case 'open-ask': return openAsk();
    case 'clear-spotlight': state.spotlight = null; refresh({clearSelection: true}); return;
    case 'connect-calendar': return connectCalendar();
    case 'disconnect-calendar': setProfile({...profile, calendar: false}); toast('Calendar disconnected.'); refresh(); return;
    case 'reset-rhythm': setProfile({...defaultProfile(), onboarded: true, picks: profile.picks, stage: profile.stage}); toast('Fresh start. Your interests stay.'); refresh(); return;
    case 'replay-onboarding': return showOnboarding();
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'personalization') { setProfile({...profile, personalization: event.target.checked}); state.moodId = null; refresh(); return; }
  if (event.target.id === 'friends') { state.friends = event.target.checked; persist(); refresh({clearSelection: true}); scrubber.refreshCounts(); }
});
$('#modal-root').addEventListener('click', event => { if (event.target.classList.contains('backdrop')) closeModal(); });
document.addEventListener('submit', event => {
  if (!event.target.matches('[data-ask-form]')) return;
  event.preventDefault();
  const text = $('#ask-text').value.trim();
  if (text) submitAsk(text);
});
document.addEventListener('keydown', event => {
  const modal = $('.modal-sheet');
  if (event.key === 'Escape') {
    if (modal) return closeModal();
    if (state.selected) return state.cardState === 'full' ? expandCard('preview') : closeCard();
  }
  if (event.key === 'Tab' && modal) {
    const items = [...modal.querySelectorAll('button,input,a')].filter(e => !e.disabled);
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
});
refresh();
if (!profile.onboarded) showOnboarding(); else scheduleCard(3800); // after the launch splash
const linked = store.get(new URLSearchParams(location.search).get('event'));
if (linked) { scrubber.setDate(new Date(linked.start)); openEvent(linked.id); }
window.addEventListener('pageshow', () => { if (state.tab === 'Events') renderPage(); });
setInterval(() => { state.clock = Date.now(); }, 60000);
