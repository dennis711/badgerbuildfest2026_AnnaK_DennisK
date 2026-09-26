import {buildDemoEvents, user, connections, demoLocation, recommendationProfile} from './data.js';
import {filterEvents, rankForYou, parseLocal} from './logic.js';
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
  mode: recommendationProfile.defaultMode, interests: [], friends: false,
  tab: 'Map', selected: null, cardState: 'preview',
  saved: asSet(stored.saved), joined: asSet(stored.joined), acknowledged: asSet(stored.acknowledged),
  proposalJoins: asSet(stored.proposalJoins),
  clock: Date.now(), location: {...demoLocation}, locationResolved: false,
  proposals: [], proposalStatus: 'idle', aiEnabled: null,
};
let map, scrubber, nearby = [], browseIds = [], toastTimer, modalOpener, fetchTimer;

const query = () => ({...state.range, mode: state.mode, interests: state.interests, friends: state.friends});
const visible = () => rankForYou(filterEvents(store.all(), query(), connections, user.id), {user, connections, location: state.location, now: state.clock});
const currentEvent = () => store.get(state.selected);
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({saved: [...state.saved], joined: [...state.joined], acknowledged: [...state.acknowledged], proposalJoins: [...state.proposalJoins]}));
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
    <div class="top-controls">
      <div class="mode-wrap"><button id="mode-button" aria-haspopup="menu" aria-expanded="false">For you ${icon('down', 14)}</button>
        <div id="mode-menu" role="menu" hidden>${['For you', 'Social', 'Professional'].map(m => `<button role="menuitemradio" aria-checked="${m === state.mode}" data-mode="${m}">${m}</button>`).join('')}</div></div>
      <button id="filters" aria-label="Filters">${icon('filter', 18)}<span id="filter-count"></span></button>
      <button id="reset-personalization" hidden>Reset to For You</button>
    </div>
    <div class="ai-status" id="ai-status" role="status" hidden></div>
    <div class="map-tools"><button data-zoom="1" aria-label="Zoom in">+</button><button data-zoom="-1" aria-label="Zoom out">−</button><button id="locate" aria-label="Return to my location and today">${icon('me', 23)}</button></div>
    <div class="map-notice" id="map-notice" role="status" hidden></div>
    <div class="time-area"><p id="empty-map" role="status" hidden>Nothing here yet</p><div id="time-control"></div></div>
    <section id="event-card" aria-label="Event details" hidden></section>
  </section>
  <section id="page-view" hidden><div class="page-inner"></div></section>
  <button class="profile-button" aria-label="Open Anna’s profile"><img src="${user.avatar}" alt="" width="40" height="40"></button>
  <nav class="bottom-nav" aria-label="Primary navigation">${[['Map', 'map'], ['Events', 'calendar'], ['Connections', 'people'], ['AI', 'ai']].map(([name, glyph]) => `<button data-tab="${name}" ${name === 'Map' ? 'aria-current="page"' : ''}>${icon(glyph, 22)}<span>${name}</span></button>`).join('')}</nav>
</main><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div>`;

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
    el.innerHTML = `<span class="ai-spark">${icon('ai', 14)}</span> AI is finding events in ${esc(city)} · ${esc(rangeLabel())}`;
    el.className = 'ai-status loading';
    el.hidden = false;
  } else if (status?.status === 'error' || state.aiEnabled === false) {
    el.innerHTML = state.aiEnabled === false || status.code === 'missing_key'
      ? `${icon('ai', 14)} Demo events only · add an API key for real events`
      : `${icon('ai', 14)} Couldn’t load real events · <button data-action="retry">Retry</button>`;
    el.className = 'ai-status error';
    el.hidden = false;
  } else el.hidden = true;
  const empty = $('#empty-map');
  empty.textContent = status?.status === 'loading' ? 'Looking for events…' : 'Nothing here yet';
}

function updateEmpty(list = nearby) { $('#empty-map').hidden = list.length > 0 || !!state.selected; }
function renderCard() {
  renderEventCard($('#event-card'), {event: currentEvent(), state, connections, user, location: state.location, ids: browseIds});
  updateEmpty();
}
function refresh({clearSelection = false} = {}) {
  const list = visible();
  if (clearSelection) { state.selected = null; state.cardState = 'preview'; }
  $('#mode-button').innerHTML = `${state.mode} ${icon('down', 14)}`;
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-checked', b.dataset.mode === state.mode));
  const count = state.interests.length + Number(state.friends);
  $('#filter-count').textContent = count || '';
  $('#reset-personalization').hidden = !count && state.mode === recommendationProfile.defaultMode;
  // A wallet or deep-linked event stays visible even outside the selected time.
  const selected = currentEvent();
  const mapEvents = selected && !list.some(e => e.id === selected.id) ? [...list, selected] : list;
  map?.update(mapEvents, state.selected);
  renderCard();
  updateStatus();
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
    if (result.status === 'done' && !result.cached && key === rangeKey()) toast(`${result.count} events found by AI in ${result.city || state.location.city || 'your area'}`);
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
  root.innerHTML = `<div class="page-heading"><img class="profile-portrait" src="${user.avatar}" alt="Illustrated demo portrait of Anna"><h1>Anna</h1><p>Your private profile</p></div><h2 class="section-label">Your interests</h2><div class="interest-tags">${recommendationProfile.topics.map(i => `<span>${esc(i)}</span>`).join('')}</div><div class="quiet-placeholder"><h2>Known by the people you know.</h2><p>Your full profile is only shared after a mutual connection.</p><small>${state.location.isDemo ? 'Demo location' : 'Current location'} · ${esc(state.location.city || 'Nearby')}</small></div><button class="text-button" data-tab="Map">Back to the map ↗</button>`;
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
}
function showFilters() {
  openModal(`<div class="modal-heading"><h2>Make it yours</h2><button class="icon-button" data-action="close-modal" aria-label="Close filters">${icon('close')}</button></div><p class="muted">A few interests. A familiar face.</p><h3>Interests</h3><div class="interest-options">${['Wellness', 'Sport', 'Art', 'Food', 'Music', 'Design', 'Tech', 'Culture', 'Outdoor'].map(i => `<button data-interest="${i}" aria-pressed="${state.interests.includes(i)}">${i}</button>`).join('')}</div><label class="friend-toggle"><span><strong>With my connections</strong><small>Only shared attendance is visible.</small></span><input id="friends" type="checkbox" ${state.friends ? 'checked' : ''}></label><p class="privacy-copy">Only people you know who choose to share their plans with you appear here.</p><div class="filter-actions"><button data-action="reset-filters">Reset to For You</button><button class="join-button" data-action="apply-filters">Show ${visible().length} events</button></div>`, 'Event filters');
}
function resetFilters() { state.interests = []; state.friends = false; state.mode = recommendationProfile.defaultMode; refresh({clearSelection: true}); scrubber.refreshCounts(); }
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
  scrubber.setDate(today);
  map?.home(state.location);
  locate();
}

// ---------- startup ----------
scrubber = createTimeScrubber($('#time-control'), {
  today,
  countFor: range => filterEvents(store.all(), {...query(), ...range}, connections, user.id).length,
  onChange: range => {
    state.range = range;
    refresh({clearSelection: true});
    if (state.locationResolved) scheduleFetch();
  },
});
if (window.L) map = createMap({location: state.location, onSelect: openEvent, onMove: list => { nearby = list; updateEmpty(list); }, onPan: () => {}, onClose: closeCard, onError: message => { $('#map-notice').textContent = message; $('#map-notice').hidden = false; }});
else { $('#map-notice').textContent = 'The map library could not load. Reload to try again.'; $('#map-notice').hidden = false; }
bindCardGestures($('#event-card'), {getState: () => state.cardState, onExpand: expandCard, onClose: closeCard, onBrowse: browse});
store.subscribe(() => { refresh(); scrubber.refreshCounts(); });

fetch('/api/status').then(r => r.json()).then(s => { if (!s.ai) { state.aiEnabled = false; updateStatus(); } }).catch(() => {}).finally(() => locate({quiet: true}));

// ---------- interaction ----------
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!event.target.closest('.mode-wrap')) { $('#mode-menu').hidden = true; $('#mode-button').setAttribute('aria-expanded', 'false'); }
  if (!button || button.closest('.scrubber')) return;
  const d = button.dataset;
  if (d.tab) return switchTab(d.tab);
  if (button.matches('.profile-button')) return switchTab('Profile');
  if (d.mode) { state.mode = d.mode; $('#mode-menu').hidden = true; $('#mode-button').setAttribute('aria-expanded', 'false'); refresh({clearSelection: true}); scrubber.refreshCounts(); return; }
  if (d.event) return openEvent(d.event);
  if (d.browse) return browse(+d.browse);
  if (d.zoom) return map?.zoom(+d.zoom);
  if (d.proposal) return joinProposal(d.proposal);
  if (d.host) {
    const e = store.get(d.host);
    return toast(e.source === 'ai' ? `${e.host.name} · Found on the web. Not a verified host yet.` : e.source === 'community' ? 'Created from matching interests nearby.' : `${e.host.name} · ${sourceInfo(e).label}. Host profiles are coming later.`);
  }
  if (d.save) { state.saved.has(d.save) ? state.saved.delete(d.save) : state.saved.add(d.save); persist(); renderCard(); return; }
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
    button.setAttribute('aria-pressed', state.interests.includes(d.interest));
    refresh({clearSelection: true});
    scrubber.refreshCounts();
    $('[data-action="apply-filters"]').textContent = `Show ${visible().length} events`;
    return;
  }
  switch (button.id) {
    case 'mode-button': $('#mode-menu').hidden = !$('#mode-menu').hidden; button.setAttribute('aria-expanded', !$('#mode-menu').hidden); if (!$('#mode-menu').hidden) $('#mode-menu button').focus(); return;
    case 'filters': return showFilters();
    case 'reset-personalization': return resetFilters();
    case 'locate': return goNow();
  }
  switch (d.action) {
    case 'close-card': return closeCard();
    case 'expand': return expandCard();
    case 'close-modal': return closeModal();
    case 'apply-filters': return closeModal();
    case 'reset-filters': resetFilters(); return showFilters();
    case 'retry': return scheduleFetch({refresh: true, delay: 0});
    case 'refresh-ai': state.aiEnabled = null; scheduleFetch({refresh: true, delay: 0}); return;
    case 'reload-proposals': state.proposalStatus = 'idle'; return loadProposals();
    case 'more': return openModal(`<div class="modal-heading"><h2>Event options</h2><button class="icon-button" data-action="close-modal" aria-label="Close options">${icon('close')}</button></div><button class="report-button" data-action="report">Report this event</button>`, 'Event options');
    case 'report': closeModal(); return toast('Demo report action · Nothing has been submitted.');
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'friends') { state.friends = event.target.checked; refresh({clearSelection: true}); scrubber.refreshCounts(); $('[data-action="apply-filters"]').textContent = `Show ${visible().length} events`; }
});
$('#modal-root').addEventListener('click', event => { if (event.target.classList.contains('backdrop')) closeModal(); });
document.addEventListener('keydown', event => {
  const modal = $('.modal-sheet');
  if (event.key === 'Escape') {
    if (modal) return closeModal();
    if (!$('#mode-menu').hidden) { $('#mode-menu').hidden = true; $('#mode-button').setAttribute('aria-expanded', 'false'); $('#mode-button').focus(); return; }
    if (state.selected) return state.cardState === 'full' ? expandCard('preview') : closeCard();
  }
  if (event.key === 'Tab' && modal) {
    const items = [...modal.querySelectorAll('button,input,a')].filter(e => !e.disabled);
    if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
  }
  if (event.target.closest('#mode-menu') && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const items = [...$('#mode-menu').querySelectorAll('button')];
    items[(items.indexOf(document.activeElement) + (event.key === 'ArrowUp' ? items.length - 1 : 1)) % items.length].focus();
  }
});
refresh();
const linked = store.get(new URLSearchParams(location.search).get('event'));
if (linked) { scrubber.setDate(new Date(linked.start)); openEvent(linked.id); }
window.addEventListener('pageshow', () => { if (state.tab === 'Events') renderPage(); });
setInterval(() => { state.clock = Date.now(); }, 60000);
