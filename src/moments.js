import {icon} from './icons.js';
import {esc} from './escape.js';
import {INTEREST_CHIPS, MOODS, STAGES} from './rhythm.js';
import {timeLabel, dateLabel} from './event-card.js';

// HTML for the small, embedded moments of the adaptive experience.
// Nothing here decides anything; app.js passes in the state.

export function onboardingHTML(picks) {
  return `<div class="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div class="onboarding-inner">
      <span class="eyebrow-dot" aria-hidden="true"></span>
      <h1 id="onboarding-title">What gets you out there?</h1>
      <p class="muted">Pick a few. No wrong answers.</p>
      <div class="onboarding-chips">${INTEREST_CHIPS.map(c => `<button class="chip" data-pick="${c.id}" aria-pressed="${picks.includes(c.id)}">${esc(c.label)}</button>`).join('')}</div>
      <div class="onboarding-footer">
        <button class="join-button" data-action="start-exploring" ${picks.length ? '' : 'disabled'}>Start exploring</button>
        <p>That’s enough for now. Out There learns what works for you as you go.</p>
      </div>
    </div>
  </div>`;
}

export function greetingHTML({hello, moodId, personalization, spotlight}) {
  return `<p class="greeting-hello">${esc(hello)}</p>
    ${personalization ? '<p class="greeting-question">What are we feeling?</p>' : ''}
    <div class="mood-row" role="group" aria-label="What are we feeling?">
      <button class="chip ask-chip" data-action="open-ask">${icon('ai', 13)} Ask Out There</button>
      ${personalization ? MOODS.map(m => `<button class="chip" data-mood="${m.id}" aria-pressed="${moodId === m.id}">${esc(m.label)}</button>`).join('') : ''}
    </div>
    ${spotlight ? `<div class="spotlight-note">${esc(spotlight.label)} <button data-action="clear-spotlight" aria-label="Show everything again">${icon('close', 12)}</button></div>` : ''}`;
}

export function whyThisHTML(reasons, eventId) {
  if (!reasons.length) return '';
  return `<div class="why-this"><div class="why-head"><span>Why this</span><button data-not-for-me="${esc(eventId)}">Not for me</button></div>
    <div class="why-chips">${reasons.map(r => `<span>${esc(r)}</span>`).join('')}</div></div>`;
}

export function miniEventHTML(event, {reasons = [], minutes, actions = ''} = {}) {
  return `<article class="mini-event" data-event-card="${esc(event.id)}">
    <button class="mini-main" data-event="${esc(event.id)}">
      <strong>${esc(event.title)}</strong>
      <span>${dateLabel(event.start)} · ${timeLabel(event.start)}${minutes ? ` · ${minutes} min away` : ''} · ${event.cost ? esc(event.cost) : event.price ? `$${event.price}` : 'Free'}</span>
    </button>
    ${reasons.length ? `<div class="why-chips">${reasons.map(r => `<span>${esc(r)}</span>`).join('')}</div>` : ''}
    ${actions ? `<div class="mini-actions">${actions}</div>` : ''}
  </article>`;
}

// One contextual card at a time, floating above the timeline.
export function contextCardHTML(card) {
  return `<article class="context-card ${card.kind || ''}" aria-live="polite">
    <button class="icon-button context-close" data-card-dismiss="${card.id}" aria-label="Dismiss">${icon('close', 14)}</button>
    ${card.eyebrow ? `<span class="context-eyebrow">${icon(card.icon || 'ai', 12)} ${esc(card.eyebrow)}</span>` : ''}
    <h3>${esc(card.title)}</h3>
    ${card.detail ? `<div class="context-detail">${card.detail.map(d => `<span>${esc(d)}</span>`).join('')}</div>` : ''}
    ${card.body ? `<p>${esc(card.body)}</p>` : ''}
    ${card.event ? miniEventHTML(card.event, {reasons: card.reasons, minutes: card.minutes}) : ''}
    ${card.privacy ? `<p class="context-privacy">${icon('lock', 12)} ${esc(card.privacy)}</p>` : ''}
    <div class="context-actions">${card.actions.map(a => `<button class="${a.primary ? 'join-button' : 'save-button'}" data-card-action="${card.id}:${a.id}">${esc(a.label)}</button>`).join('')}</div>
  </article>`;
}

export function knowsPageHTML({profile, signals, connectionsCount, locationLabel}) {
  return `<button class="text-button back-link" data-tab="Profile">‹ Profile</button>
    <div class="page-heading"><h1>What Out There knows</h1><p>Out There learns from how you use the app so recommendations can fit your life better.</p></div>
    <label class="setting-row"><span><strong>Personalization</strong><small>${profile.personalization ? 'On · suggestions fit your rhythm' : 'Off · events are shown by time only'}</small></span><input type="checkbox" id="personalization" role="switch" ${profile.personalization ? 'checked' : ''}></label>
    <section><h2 class="section-label">What seems to fit you</h2>
      ${signals.length ? `<ul class="signal-list">${signals.map(s => `<li><span>${esc(s.text)}</span><span class="signal-actions">${s.edit ? `<button data-edit-signal="${s.edit}">Edit</button>` : ''}<button data-remove-signal="${esc(s.id)}" aria-label="Remove: ${esc(s.text)}">${icon('close', 14)}</button></span></li>`).join('')}</ul>` : '<p class="muted">Nothing yet. It fills in as you save, join and skip things.</p>'}
      <p class="privacy-copy">Remove anything and Out There stops using it. Nothing here is shown to other people.</p>
    </section>
    <section><h2 class="section-label">Connected sources</h2>
      <div class="source-row"><span>${icon('calendar', 18)}<span><strong>Calendar</strong><small>${profile.calendar ? 'Connected · only free/busy windows are used' : 'Not connected'}</small></span></span><button class="${profile.calendar ? 'save-button' : 'join-button'}" data-action="${profile.calendar ? 'disconnect-calendar' : 'connect-calendar'}">${profile.calendar ? 'Disconnect' : 'Connect'}</button></div>
      <div class="source-row"><span>${icon('pin', 18)}<span><strong>Location</strong><small>${esc(locationLabel)}</small></span></span></div>
      <div class="source-row"><span>${icon('people', 18)}<span><strong>Connections</strong><small>${connectionsCount} people you’ve met · only plans they share</small></span></span></div>
    </section>
    <button class="text-button" data-action="reset-rhythm">Start fresh</button>`;
}

export function editSheetHTML(kind, profile) {
  const options = kind === 'budget'
    ? [[20, 'Under $20'], [40, 'Under $40'], [60, 'Under $60'], [0, 'Price doesn’t matter']]
    : kind === 'distance'
      ? [['walkable', 'Within walking distance'], ['nearby', 'Nearby (up to ~25 min)'], ['anywhere', 'Anywhere in town']]
      : INTEREST_CHIPS.map(c => [c.id, c.label]);
  const current = kind === 'budget' ? profile.budget : kind === 'distance' ? profile.distance : null;
  const title = kind === 'budget' ? 'Usual budget' : kind === 'distance' ? 'How far you like to go' : 'What you’re into';
  return `<div class="modal-heading"><h2>${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div>
    <div class="${kind === 'likes' ? 'onboarding-chips' : 'option-list'}">${options.map(([value, label]) => kind === 'likes'
      ? `<button class="chip" data-edit-pick="${value}" aria-pressed="${profile.picks.includes(value)}">${esc(label)}</button>`
      : `<button class="option ${String(value) === String(current) ? 'selected' : ''}" data-edit-value="${kind}:${value}">${esc(label)}${String(value) === String(current) ? icon('check', 16) : ''}</button>`).join('')}</div>
    ${kind === 'likes' ? '<div class="filter-actions"><button class="join-button" data-action="close-modal">Done</button></div>' : ''}`;
}

export const ASK_SUGGESTIONS = ['I have 3 hours free.', 'Sarah and I have Saturday afternoon free.', 'Something outdoors under $30.', 'Get me out of the house.'];

export function askSheetHTML(messages, busy) {
  return `<div class="modal-heading"><h2>${icon('ai', 18)} Ask Out There</h2><button class="icon-button" data-action="close-modal" aria-label="Close">${icon('close')}</button></div>
    <div class="ask-thread" aria-live="polite">
      ${messages.length ? '' : '<p class="muted ask-intro">Tell me what you’ve got — time, mood, who’s coming. I already know what you’re into.</p>'}
      ${messages.map(m => m.role === 'user'
        ? `<p class="bubble user">${esc(m.text)}</p>`
        : `<div class="bubble bot"><p>${esc(m.text)}</p>${(m.events || []).map(e => miniEventHTML(e.event, {reasons: e.reasons, minutes: e.minutes, actions: e.actions})).join('')}</div>`).join('')}
      ${busy ? '<p class="bubble bot typing"><span></span><span></span><span></span></p>' : ''}
    </div>
    ${messages.length ? '' : `<div class="ask-suggestions">${ASK_SUGGESTIONS.map(s => `<button class="chip" data-ask="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}
    <form class="ask-input" data-ask-form><input id="ask-text" type="text" placeholder="I’m free after 5…" autocomplete="off" aria-label="Ask Out There"><button class="join-button" type="submit" aria-label="Send">${icon('arrow', 18)}</button></form>`;
}

export function stageSwitcherHTML(stage) {
  return `<section class="stage-demo"><h2 class="section-label">Prototype · how Out There grows</h2>
    <div class="segmented" role="group" aria-label="Demo stage">${STAGES.map(s => `<button data-stage="${s.id}" aria-pressed="${s.id === stage}">${s.label}</button>`).join('')}</div>
    <p class="muted">${esc(STAGES.find(s => s.id === stage).note)}</p>
    <button class="text-button" data-action="replay-onboarding">Replay the first-run screen</button></section>`;
}
