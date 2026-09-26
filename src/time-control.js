import {icon} from './icons.js';
import {feedback} from './feedback.js';

const startOfDay = date => new Date(date.getFullYear(),date.getMonth(),date.getDate());
const hourLabel = hour => new Date(2026,0,1,hour).toLocaleTimeString('en-US',{hour:'numeric'});

// A pointer-controlled, bounded-per-gesture scale: there is no velocity loop,
// fake vibration, or autonomous spinning. Day exploration itself has no end.
export function createTimeControl(root, {state, now, onChange, onHome}) {
  let level='day', expanded=false, collapseTimer, drag=null;
  root.innerHTML=`<button class="time-rest" aria-label="Explore time" aria-expanded="false">${icon('clock',16)}<span></span>${icon('down',14)}</button>
    <div class="time-expanded" hidden>
      <div class="time-heading"><button data-level="day">Day</button><button data-level="hour">Time</button><button class="time-done" aria-label="Done exploring time">${icon('check',16)}</button></div>
      <div class="time-selection" aria-live="polite"></div>
      <div class="dial-wrap"><span class="dial-indicator"></span><div class="dial" tabindex="0" role="slider" aria-label="Selected day" aria-valuemin="-365000" aria-valuemax="365000"><div class="dial-scale"></div></div></div>
      <div class="time-footer"><button data-time-action="all">All day</button><span class="time-hint">Drag to explore</span><button data-time-action="now">Here & now</button></div>
    </div>`;
  const rest=root.querySelector('.time-rest'), panel=root.querySelector('.time-expanded');
  const dial=root.querySelector('.dial'), scale=root.querySelector('.dial-scale');
  function label() {
    const today=state.date.toDateString()===now.toDateString();
    const date=today?'Today':state.date.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'});
    const hour=state.hour===null?'All day':today&&state.hour===now.getHours()?'Now':hourLabel(state.hour);
    return `${date} · ${hour}`;
  }
  function value() {
    return level==='day'?Math.round((startOfDay(state.date)-startOfDay(now))/86400000):(state.hour ?? 12);
  }
  function draw(offset=0) {
    const current=value();
    rest.querySelector('span').textContent=label();
    root.querySelector('.time-selection').textContent=label();
    root.querySelectorAll('[data-level]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.level===level));
    dial.setAttribute('aria-label',level==='day'?'Selected day':'Selected hour');
    dial.setAttribute('aria-valuemin',level==='day'?'-365000':'0');
    dial.setAttribute('aria-valuemax',level==='day'?'365000':'23');
    dial.setAttribute('aria-valuenow',current);
    dial.setAttribute('aria-valuetext',label());
    scale.style.transform=`translateX(${offset}px)`;
    scale.innerHTML=Array.from({length:9},(_,i)=>{
      const n=current+i-4;
      if(level==='hour'&&(n<0||n>23))return '<span class="dial-tick"></span>';
      const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+n);
      const text=level==='hour'?hourLabel(n):n===0?'Today':d.toLocaleDateString('en-US',{weekday:'short',day:'numeric'});
      return `<span class="dial-tick ${i===4?'current':''}"><i></i><span>${text}</span></span>`;
    }).join('');
    root.querySelector('.time-hint').textContent=level==='hour'?'Next 3 hours':'Drag to explore';
  }
  function scheduleCollapse() {
    clearTimeout(collapseTimer);
    collapseTimer=setTimeout(()=>{if(!drag)collapse();},3500);
  }
  function expand() {
    expanded=true;root.classList.add('expanded');panel.hidden=false;rest.hidden=true;
    rest.setAttribute('aria-expanded','true');draw();scheduleCollapse();
  }
  function collapse() {
    expanded=false;drag=null;clearTimeout(collapseTimer);
    const hadFocus=panel.contains(document.activeElement);
    root.classList.remove('expanded');panel.hidden=true;rest.hidden=false;
    rest.setAttribute('aria-expanded','false');draw();if(hadFocus)rest.focus({preventScroll:true});
  }
  function select(n) {
    if(level==='day') {
      const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+n);
      if(date.toDateString()===state.date.toDateString())return;
      state.date=date;state.hour=null;feedback('day-boundary');
    } else {
      n=Math.max(0,Math.min(23,n));
      if(n===state.hour)return;
      state.hour=n;feedback('hour-boundary');
    }
    onChange();draw();
  }
  rest.addEventListener('click',expand);
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.level){level=button.dataset.level;draw();scheduleCollapse();}
    if(button.classList.contains('time-done'))collapse();
    if(button.dataset.timeAction==='all'){state.hour=null;onChange();draw();scheduleCollapse();}
    if(button.dataset.timeAction==='now'){onHome();collapse();}
  });
  dial.addEventListener('pointerdown',event=>{
    drag={x:event.clientX,start:value(),id:event.pointerId};
    dial.setPointerCapture(event.pointerId);clearTimeout(collapseTimer);dial.classList.add('dragging');
  });
  dial.addEventListener('pointermove',event=>{
    if(!drag)return;
    const delta=event.clientX-drag.x, steps=Math.round(-delta/64);
    const target=drag.start+steps;
    select(target);
    const atEdge=level==='hour'&&(target<0||target>23);
    draw(atEdge?0:delta+steps*64);
  });
  const finish=()=>{drag=null;dial.classList.remove('dragging');draw();scheduleCollapse();};
  dial.addEventListener('pointerup',finish);dial.addEventListener('pointercancel',finish);
  dial.addEventListener('keydown',event=>{
    if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();
      select(event.key==='Home'?0:event.key==='End'&&level==='hour'?23:value()+(event.key==='ArrowLeft'?-1:1));
      scheduleCollapse();
    }
    if(event.key==='Escape')collapse();
  });
  let wheelAt=0;
  dial.addEventListener('wheel',event=>{
    event.preventDefault();
    if(Date.now()-wheelAt>140){select(value()+Math.sign(event.deltaX||event.deltaY));wheelAt=Date.now();scheduleCollapse();}
  },{passive:false});
  draw();
  return {update:()=>draw(),collapse,expand,isExpanded:()=>expanded};
}
