import {icon} from './icons.js';
import {visibleConnections,distanceMiles} from './logic.js';

export const timeLabel=timestamp=>new Date(timestamp).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
export const dateLabel=timestamp=>new Date(timestamp).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
export function connectionLabel(event,connections,userId) {
  const friends=visibleConnections(event,connections,userId);
  return friends.length?`${friends[0].name}${friends.length>1?` + ${friends.length-1} ${friends.length===2?'connection':'connections'}`:''} going`:'';
}

export function renderEventCard(root,{event,host,state,connections,user,location,ids}) {
  root.hidden=!event;
  root.classList.toggle('full',state.cardState==='full');
  root.classList.toggle('has-cover',!!event?.cover);
  document.querySelector('.app').classList.toggle('has-card',!!event);
  if(!event){root.innerHTML='';return;}
  const full=state.cardState==='full', saved=state.saved.has(event.id), joined=state.joined.has(event.id);
  const going=connectionLabel(event,connections,user.id);
  const distance=distanceMiles(location,event).toFixed(1);
  const route=`https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`;
  const index=ids.indexOf(event.id), ended=event.end<=state.clock, cancelled=event.status==='cancelled';
  const scroll=root.querySelector('.card-scroll')?.scrollTop || 0;
  root.innerHTML=`<article class="event-detail" aria-label="${event.title}">
    <div class="card-handle-area"><button class="card-handle" data-action="expand" aria-label="${full?'Show event preview':'Expand full event'}" aria-expanded="${full}"><span></span></button></div>
    <div class="card-scroll">
      ${event.cover?`<img class="event-cover" src="${event.cover.src}" alt="${event.cover.alt}" draggable="false">`:''}
      <div class="card-content">
        <div class="card-heading"><h2>${event.title}</h2><button class="icon-button" data-action="close-card" aria-label="Close event">${icon('close',18)}</button></div>
        <button class="host-link" data-host="${host.id}">${host.name}<span class="verified" title="Verified host">${icon('check',10)}</span><span class="rating">★ ${host.rating}</span></button>
        <div class="event-facts"><p>${icon('calendar',16)}<span>${dateLabel(event.start)} · ${timeLabel(event.start)}${full?`–${timeLabel(event.end)}`:''}</span></p>
          <a href="${route}" target="_blank" rel="noopener noreferrer">${icon('pin',16)}<span>${event.venue}<span class="muted"> · ${distance} mi${full?' · Directions ↗':''}</span></span></a></div>
        ${going?`<p class="connections-going">${icon('people',19)} ${going}</p>`:''}
        ${full?`<section class="about"><h3>About</h3><p>${event.description}</p></section><section class="good-to-know"><h3>Good to know</h3>${event.requirements?`<p>${event.requirements}</p>`:''}`:''}
        <div class="event-conditions">${cancelled?'<span class="cancelled-label">Cancelled</span>':ended?'<span>Event ended</span>':''}${event.spots!==null?`<span>${event.spots} spots left</span>`:''}<span>${event.price?`$${event.price}`:'Free'}</span>${event.age?`<span>${event.age}+</span>`:''}</div>
        ${full?`</section>${event.external?'<section class="ticket-info"><h3>Tickets</h3><p>A ticket from the host is required. Saving this event does not reserve a place.</p></section>':''}<div class="full-links"><button data-share="${event.id}">${icon('share',18)} Share event</button><button class="icon-button" data-action="more" aria-label="More event options">${icon('more',20)}</button></div>`:''}
      </div>
    </div>
    <footer class="card-footer"><div class="card-actions"><button class="save-button ${saved?'saved':''}" data-save="${event.id}" aria-pressed="${saved}">${icon('save',18)} ${saved?'Saved':'Save'}</button><button class="join-button ${joined?'joined':''}" data-join="${event.id}" ${cancelled||ended?'disabled':''}>${cancelled?'Cancelled':ended?'Ended':event.external?`Get ticket ${icon('external',16)}`:joined?`Joined ${icon('check',16)}`:'Join'}</button></div>
      <div class="card-browse"><button data-browse="-1" aria-label="Previous event" ${index<=0?'disabled':''}>‹</button><button data-action="expand">${full?'Show less':'Full event'} ${icon(full?'down':'external',12)}</button><span>${index+1} of ${ids.length}</span><button data-browse="1" aria-label="Next event" ${index<0||index>=ids.length-1?'disabled':''}>›</button></div>
    </footer>
  </article>`;
  if(full)root.querySelector('.card-scroll').scrollTop=scroll;
}

export function bindCardGestures(root,{getState,onExpand,onClose,onBrowse}) {
  let gesture=null, suppressClick=false;
  root.addEventListener('pointerdown',event=>{
    // A completed swipe may replace the original click target. Never swallow
    // the user's next independent tap when no synthetic click was emitted.
    suppressClick=false;
    if(event.target.closest('button,a')&&!event.target.closest('.card-handle'))return;
    const full=getState()==='full';
    gesture={x:event.clientX,y:event.clientY,vertical:!!event.target.closest('.card-handle-area')||!full,id:event.pointerId};
    if(gesture.vertical)(event.target.closest('.card-handle')||root).setPointerCapture(event.pointerId);
  });
  root.addEventListener('pointermove',event=>{
    if(!gesture)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3){
      root.setPointerCapture(event.pointerId);
      root.style.transform=`translateX(${Math.max(-32,Math.min(32,dx*.15))}px)`;
    }else if(gesture.vertical&&Math.abs(dy)>12){
      root.style.transform=`translateY(${Math.max(-24,Math.min(32,dy*.15))}px)`;
    }
  });
  root.addEventListener('pointerup',event=>{
    if(!gesture)return;
    root.style.transform='';
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.3){onBrowse(dx<0?1:-1);suppressClick=true;}
    else if(gesture.vertical&&Math.abs(dy)>45){if(dy<0)onExpand('full');else if(getState()==='full')onExpand('preview');else onClose();suppressClick=true;}
    gesture=null;
  });
  root.addEventListener('pointercancel',()=>{gesture=null;root.style.transform='';});
  root.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}},true);
}
