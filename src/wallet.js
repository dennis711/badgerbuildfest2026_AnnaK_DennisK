import {icon} from './icons.js';
import {esc} from './escape.js';
import {walletEvents} from './logic.js';
import {dateLabel,timeLabel} from './event-card.js';

function pass(event,index=0) {
  return `<button class="wallet-pass" data-event="${event.id}" style="--pass-index:${index}"><span class="pass-top"><span>${dateLabel(event.start)}</span>${icon('external',16)}</span><strong>${esc(event.title)}</strong><span>${timeLabel(event.start)} · ${esc(event.venue)}</span></button>`;
}
export function renderWallet(events,state) {
  const {upcoming,cancelled,history}=walletEvents(events,state.joined,state.acknowledged,state.clock);
  const saved=events.filter(e=>state.saved.has(e.id)).sort((a,b)=>a.start-b.start);
  return `<div class="page-heading"><h1>Events</h1><p>A few plans worth keeping.</p></div>
    ${cancelled.map(e=>`<div class="cancellation" role="status"><strong>${esc(e.title)} — cancelled</strong><p>The host has cancelled this event.</p><button data-acknowledge="${e.id}">Acknowledge</button></div>`).join('')}
    <section><h2 class="section-label">Upcoming <span>${upcoming.length}</span></h2>${upcoming.length?`<div class="wallet-stack">${upcoming.map(pass).join('')}</div>`:'<div class="empty-wallet">'+icon('calendar',28)+'<p>Your next plan starts on the map.</p><button data-tab="Map">Find something to do ↗</button></div>'}</section>
    <section><h2 class="section-label">Saved <span>${saved.length}</span></h2><div class="saved-list">${saved.length?saved.map(e=>`<button class="saved-row" data-event="${e.id}">${icon('save',19)}<span><strong>${esc(e.title)}</strong><small>${dateLabel(e.start)} · ${timeLabel(e.start)}${e.status==='cancelled'?' · Cancelled':''}</small></span>${icon('arrow',16)}</button>`).join(''):'<p class="muted">Keep a possibility for later.</p>'}</div></section>
    <details class="private-history"><summary>Private history · ${history.length}</summary>${history.length?history.map(e=>`<button class="history-row" data-event="${e.id}">${esc(e.title)}<small>${dateLabel(e.start)}${e.status==='cancelled'?' · Cancelled':''}</small></button>`).join(''):'<p>Past joined events will stay here, just for you.</p>'}</details>`;
}
