import {events,hosts,user,connections,demoNow,demoLocation,recommendationProfile} from './data.js';
import {filterEvents} from './logic.js';
import {icon} from './icons.js';
import {createMap} from './map-view.js';
import {createTimeControl} from './time-control.js';
import {renderEventCard,bindCardGestures} from './event-card.js';
import {renderWallet} from './wallet.js';
import {feedback} from './feedback.js';

const $=selector=>document.querySelector(selector);
function readState(){try{return JSON.parse(localStorage.getItem('out-there-anna'))||{};}catch{return {};}}
const stored=readState();
const asSet=value=>new Set(Array.isArray(value)?value:[]);
const state={
  date:new Date(demoNow),hour:demoNow.getHours(),mode:recommendationProfile.defaultMode,
  interests:[],friends:false,tab:'Map',selected:null,cardState:'preview',
  saved:asSet(stored.saved),joined:asSet(stored.joined),acknowledged:asSet(stored.acknowledged),
  clock:demoNow.getTime(),location:{...demoLocation}
};
let map,timeControl,nearby=[],browseIds=[],toastTimer,modalOpener;
const visible=()=>filterEvents(events,state,connections,user.id).sort((a,b)=>Number(user.interests.includes(b.interest))-Number(user.interests.includes(a.interest))||a.start-b.start);
const currentEvent=()=>events.find(event=>event.id===state.selected);
function persist(){try{localStorage.setItem('out-there-anna',JSON.stringify({saved:[...state.saved],joined:[...state.joined],acknowledged:[...state.acknowledged]}));}catch{toast('Changes are kept for this session.');}}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3500);}

$('#app').innerHTML=`<main class="app">
  <section id="map-view" aria-label="Discover nearby events"><div id="map" aria-label="Interactive event map"></div>
    <div class="top-controls"><div class="mode-wrap"><button id="mode-button" aria-haspopup="menu" aria-expanded="false">Social ${icon('down',14)}</button><div id="mode-menu" role="menu" hidden><button role="menuitemradio" aria-checked="true" data-mode="Social">Social</button><button role="menuitemradio" aria-checked="false" data-mode="Professional">Professional</button></div></div><button id="filters" aria-label="Filters">${icon('filter',18)}<span id="filter-count"></span></button><button id="reset-personalization" hidden>Reset to For You</button></div>
    <div class="map-tools"><button data-zoom="1" aria-label="Zoom in">+</button><button data-zoom="-1" aria-label="Zoom out">−</button><button id="locate" aria-label="Return to my location and now">${icon('me',23)}</button></div>
    <div class="map-notice" id="map-notice" role="status" hidden></div>
    <div class="time-area"><p id="empty-map" role="status" hidden>Nothing here yet</p><div id="time-control"></div></div>
    <section id="event-card" aria-label="Event details" hidden></section>
  </section>
  <section id="page-view" hidden><div class="page-inner"></div></section>
  <button class="profile-button" aria-label="Open Anna’s profile"><img src="${user.avatar}" alt="" width="40" height="40"></button>
  <nav class="bottom-nav" aria-label="Primary navigation">${[['Map','map'],['Events','calendar'],['Connections','people'],['AI','ai']].map(([name,glyph])=>`<button data-tab="${name}" ${name==='Map'?'aria-current="page"':''}>${icon(glyph,22)}<span>${name}</span></button>`).join('')}</nav>
</main><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div>`;

function updateEmpty(list=nearby){$('#empty-map').hidden=list.length>0||!!state.selected;}
function renderCard(){
  const event=currentEvent();
  renderEventCard($('#event-card'),{event,host:hosts.find(h=>h.id===event?.hostId),state,connections,user,location:state.location,ids:browseIds});
  updateEmpty();
}
function refresh({clearSelection=false}={}) {
  const list=visible();
  if(clearSelection){state.selected=null;state.cardState='preview';}
  $('#mode-button').innerHTML=`${state.mode} ${icon('down',14)}`;
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-checked',b.dataset.mode===state.mode));
  const count=state.interests.length+Number(state.friends);
  $('#filter-count').textContent=count||'';
  $('#reset-personalization').hidden=!count&&state.mode===recommendationProfile.defaultMode;
  // Opening a wallet/deep-linked event keeps its marker accessible even when
  // its time or mode differs from the discovery selection.
  const selected=currentEvent();
  const mapEvents=selected&&!list.some(e=>e.id===selected.id)?[...list,selected]:list;
  map?.update(mapEvents,state.selected);
  timeControl?.update();renderCard();
  if(state.tab==='Events')renderPage();
}

function openEvent(id,groupIds=[]) {
  const event=events.find(e=>e.id===id);if(!event)return;
  const source=state.tab==='Events'?events.filter(e=>state.joined.has(e.id)||state.saved.has(e.id)):nearby;
  browseIds=[...new Set([...source.map(e=>e.id),...groupIds,id])];
  state.selected=id;state.cardState='preview';
  switchTab('Map');timeControl.collapse();refresh();requestAnimationFrame(()=>map?.focus(event));
  $('#event-card').classList.remove('card-enter');void $('#event-card').offsetWidth;$('#event-card').classList.add('card-enter');
}
function closeCard(){state.selected=null;state.cardState='preview';refresh();}
function browse(direction){
  const index=browseIds.indexOf(state.selected)+direction;
  if(index<0||index>=browseIds.length)return;
  state.selected=browseIds[index];
  const scroll=$('.card-scroll');if(scroll)scroll.scrollTop=0;
  refresh();map?.focus(currentEvent());feedback('event-change');
}
function expandCard(value){state.cardState=value|| (state.cardState==='full'?'preview':'full');renderCard();}

function switchTab(tab) {
  state.tab=tab;$('#map-view').hidden=tab!=='Map';$('#page-view').hidden=tab==='Map';
  document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(tab==='Map')requestAnimationFrame(()=>map?.resize());else{timeControl?.collapse();renderPage();}
}
function renderPage(){
  const root=$('.page-inner');
  if(state.tab==='Events'){root.innerHTML=renderWallet(events,state);return;}
  if(state.tab==='Connections')root.innerHTML=`<div class="page-heading"><h1>Connections</h1><p>People you’ve met. Plans still to come.</p></div><div class="quiet-placeholder">${icon('people',44)}<h2>It starts in person.</h2><p>This private space will hold your mutual connections after you meet.</p><small>No public profiles. No people browsing.</small></div>`;
  else if(state.tab==='AI')root.innerHTML=`<div class="page-heading"><h1>A little help getting out.</h1><p>Your planning companion, coming later.</p></div><div class="quiet-placeholder">${icon('ai',36)}<h2>More possibilities. Less planning.</h2><p>One day, your interests and available time will help shape a few thoughtful suggestions.</p><small>No automatic plans or generated events.</small></div>`;
  else root.innerHTML=`<div class="page-heading"><img class="profile-portrait" src="${user.avatar}" alt="Illustrated demo portrait of Anna"><h1>Anna</h1><p>Your private profile</p></div><h2 class="section-label">Your interests</h2><div class="interest-tags">${recommendationProfile.topics.map(i=>`<span>${i}</span>`).join('')}</div><div class="quiet-placeholder"><h2>Known by the people you know.</h2><p>Your full profile is only shared after a mutual connection.</p><small>Demo profile · Madison · September 26, 2026</small></div><button class="text-button" data-tab="Map">Back to the map ↗</button>`;
}

function openModal(content,label) {
  if(!$('#modal-root').children.length)modalOpener=document.activeElement;
  $('#modal-root').innerHTML=`<div class="backdrop"><section class="modal-sheet" role="dialog" aria-modal="true" aria-label="${label}">${content}</section></div>`;
  $('.app').inert=true;
  $('.modal-sheet button, .modal-sheet input')?.focus();
}
function closeModal(){
  $('#modal-root').innerHTML='';$('.app').inert=false;
  if(modalOpener?.isConnected)modalOpener.focus({preventScroll:true});
}
function showFilters() {
  openModal(`<div class="modal-heading"><h2>Make it yours</h2><button class="icon-button" data-action="close-modal" aria-label="Close filters">${icon('close')}</button></div><p class="muted">A few interests. A familiar face.</p><h3>Interests</h3><div class="interest-options">${['Wellness','Sport','Art','Food','Music','Design','Tech','Culture','Outdoor'].map(i=>`<button data-interest="${i}" aria-pressed="${state.interests.includes(i)}">${i}</button>`).join('')}</div><label class="friend-toggle"><span><strong>With my connections</strong><small>Only shared attendance is visible.</small></span><input id="friends" type="checkbox" ${state.friends?'checked':''}></label><p class="privacy-copy">Only people you know who choose to share their plans with you appear here.</p><div class="filter-actions"><button data-action="reset-filters">Reset to For You</button><button class="join-button" data-action="apply-filters">Show ${visible().length} events</button></div>`,'Event filters');
}
function resetFilters(){state.interests=[];state.friends=false;state.mode=recommendationProfile.defaultMode;refresh({clearSelection:true});}
function confirmLeave(event){
  openModal(`<div class="modal-heading"><h2>Leave this event?</h2><button class="icon-button" data-action="close-modal" aria-label="Close confirmation">${icon('close')}</button></div><p>${event.title}</p><p class="muted">Your place will become available to someone else.</p><div class="confirmation-actions"><button class="save-button" data-action="close-modal">Stay joined</button><button class="join-button" data-leave="${event.id}">Leave event</button></div>`,'Leave this event?');
}
function goNow() {
  state.date=new Date(demoNow);state.hour=demoNow.getHours();state.selected=null;
  refresh();map?.home(state.location);timeControl.collapse();
  if(navigator.geolocation)navigator.geolocation.getCurrentPosition(position=>{
    state.location={lat:position.coords.latitude,lng:position.coords.longitude,isDemo:false};
    map?.home(state.location);
  },()=>toast('Using the demo location in Madison.'),{timeout:6000,maximumAge:60000});
}

timeControl=createTimeControl($('#time-control'),{state,now:demoNow,onChange:()=>refresh({clearSelection:true}),onHome:goNow});
if(window.L)map=createMap({location:state.location,onSelect:openEvent,onMove:list=>{nearby=list;updateEmpty(list);},onPan:()=>timeControl.collapse(),onClose:closeCard,onError:message=>{$('#map-notice').textContent=message;$('#map-notice').hidden=false;}});
else{$('#map-notice').textContent='The map library could not load. Reload to try again.';$('#map-notice').hidden=false;}
bindCardGestures($('#event-card'),{getState:()=>state.cardState,onExpand:expandCard,onClose:closeCard,onBrowse:browse});

document.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!event.target.closest('.mode-wrap')){$('#mode-menu').hidden=true;$('#mode-button').setAttribute('aria-expanded','false');}
  if(!button)return;
  const d=button.dataset;
  if(d.tab)return switchTab(d.tab);
  if(button.matches('.profile-button'))return switchTab('Profile');
  if(d.mode){state.mode=d.mode;$('#mode-menu').hidden=true;$('#mode-button').setAttribute('aria-expanded','false');return refresh({clearSelection:true});}
  if(d.event)return openEvent(d.event);
  if(d.browse)return browse(+d.browse);
  if(d.zoom)return map?.zoom(+d.zoom);
  if(d.host)return toast(`${hosts.find(h=>h.id===d.host).name} · Verified host. Public host profiles are coming later.`);
  if(d.save){state.saved.has(d.save)?state.saved.delete(d.save):state.saved.add(d.save);persist();renderCard();return;}
  if(d.join){
    const e=events.find(e=>e.id===d.join);
    if(e.external)return toast('Demo ticket link · Tickets will open on the host’s website.');
    if(state.joined.has(e.id))return confirmLeave(e);
    state.joined.add(e.id);persist();renderCard();feedback('joined');return;
  }
  if(d.leave){state.joined.delete(d.leave);persist();closeModal();renderCard();return;}
  if(d.acknowledge){state.acknowledged.add(d.acknowledge);persist();renderPage();return;}
  if(d.share){
    const e=events.find(e=>e.id===d.share),url=`${location.origin}/?event=${e.id}`;
    try{if(navigator.share)await navigator.share({title:e.title,url});else{await navigator.clipboard.writeText(url);toast('Event link copied.');}}catch(error){if(error.name!=='AbortError')toast('Sharing is unavailable in this browser.');}return;
  }
  if(d.interest){
    state.interests=state.interests.includes(d.interest)?state.interests.filter(i=>i!==d.interest):[...state.interests,d.interest];
    button.setAttribute('aria-pressed',state.interests.includes(d.interest));refresh({clearSelection:true});
    $('[data-action="apply-filters"]').textContent=`Show ${visible().length} events`;return;
  }
  switch(button.id){
    case 'mode-button':$('#mode-menu').hidden=!$('#mode-menu').hidden;button.setAttribute('aria-expanded',!$('#mode-menu').hidden);if(!$('#mode-menu').hidden)$('#mode-menu button').focus();return;
    case 'filters':return showFilters();
    case 'reset-personalization':return resetFilters();
    case 'locate':return goNow();
  }
  switch(d.action){
    case 'close-card':return closeCard();
    case 'expand':return expandCard();
    case 'close-modal':return closeModal();
    case 'apply-filters':return closeModal();
    case 'reset-filters':resetFilters();return showFilters();
    case 'more':return openModal(`<div class="modal-heading"><h2>Event options</h2><button class="icon-button" data-action="close-modal" aria-label="Close options">${icon('close')}</button></div><button class="report-button" data-action="report">Report this event</button>`,'Event options');
    case 'report':closeModal();return toast('Demo report action · Nothing has been submitted.');
  }
});
document.addEventListener('change',event=>{
  if(event.target.id==='friends'){state.friends=event.target.checked;refresh({clearSelection:true});$('[data-action="apply-filters"]').textContent=`Show ${visible().length} events`;}
});
$('#modal-root').addEventListener('click',event=>{if(event.target.classList.contains('backdrop'))closeModal();});
document.addEventListener('keydown',event=>{
  const modal=$('.modal-sheet');
  if(event.key==='Escape'){
    if(modal)return closeModal();
    if(!$('#mode-menu').hidden){$('#mode-menu').hidden=true;$('#mode-button').setAttribute('aria-expanded','false');$('#mode-button').focus();return;}
    if(timeControl.isExpanded())return timeControl.collapse();
    if(state.selected)return state.cardState==='full'?expandCard('preview'):closeCard();
  }
  if(event.key==='Tab'&&modal){
    const items=[...modal.querySelectorAll('button,input,a')].filter(e=>!e.disabled);
    if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
    else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
  }
  if(event.target.closest('#mode-menu')&&['ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();const items=[...$('#mode-menu').querySelectorAll('button')];items[(items.indexOf(document.activeElement)+1)%items.length].focus();
  }
});
refresh();
const linked=events.find(e=>e.id===new URLSearchParams(location.search).get('event'));
if(linked){state.date=new Date(linked.start);state.hour=null;state.mode=linked.mode;refresh();openEvent(linked.id);}

// Discovery time is separate from attendance lifecycle. Scrubbing tomorrow
// must not move today's joined events into History. The demo clock is fixed.
window.addEventListener('pageshow',()=>{if(state.tab==='Events')renderPage();});
