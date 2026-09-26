import {icon} from './icons.js';
import {feedback} from './feedback.js';

// Retains Leaflet cameras, markers and interaction; vector tiles allow actual
// POI removal rather than trying to erase baked-in raster labels with CSS.
export function createMap({location, onSelect, onMove, onPan, onClose, onError}) {
  const map = L.map('map', {zoomControl:false, attributionControl:true, minZoom:3, maxZoom:19, zoomAnimation:!matchMedia('(prefers-reduced-motion: reduce)').matches})
    .setView([location.lat,location.lng],14);
  map.attributionControl.setPrefix(false);
  map.attributionControl.addAttribution('<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>');
  const layer = L.layerGroup().addTo(map);
  let currentEvents = [], selected = null, me;
  let fallback = false;
  const useFallback = () => {
    if (fallback) return;
    fallback = true;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
    onError('Simplified map unavailable. Showing the standard map.');
  };
  fetch('/public/vendor/base-map-style.json').then(r => {if(!r.ok)throw Error('Map style unavailable');return r.json();}).then(style => {
    style.layers = style.layers.filter(l => l['source-layer'] !== 'poi' && l.type !== 'fill-extrusion'
      && !/shield|one_way|airport|natural_earth|pattern|hatching/.test(l.id));
    for (const l of style.layers) {
      l.paint ||= {};
      if (l.type === 'background') l.paint['background-color'] = '#f2f1eb';
      if (l.type === 'fill') {
        if (/water/.test(l.id)) l.paint['fill-color'] = '#c7dfe8';
        else if (/park|grass|wood|cemetery/.test(l.id)) l.paint['fill-color'] = '#dae5cb';
        else if (/building/.test(l.id)) {l.paint['fill-color'] = '#e5e4de';l.minzoom=15;}
        else l.paint['fill-color'] = '#ebece4';
        delete l.paint['fill-pattern'];
      }
      if (l.type === 'line') {
        if (/waterway/.test(l.id)) l.paint['line-color'] = '#bfd9e3';
        else if (/park/.test(l.id)) l.paint['line-color'] = '#d3dfc3';
        else if (l['source-layer'] === 'transportation') l.paint['line-color'] = /casing/.test(l.id) ? '#deded6' : '#ffffff';
      }
      if (l.type === 'symbol') {
        l.paint['text-color'] = /water/.test(l.id) ? '#789ba8' : '#8c928a';
        l.paint['text-halo-color'] = '#f4f3ed';
        l.paint['text-halo-width'] = 1;
        if (/highway-name-minor|highway-name-path/.test(l.id)) l.minzoom=16;
        else if (/highway-name-major/.test(l.id)) l.minzoom=14;
      }
    }
    try {
      const vector = L.maplibreGL({style, interactive:false, attributionControl:false}).addTo(map);
      vector.getMaplibreMap().on('error', () => onError('Map connection interrupted. Events are still available.'));
      // The adapter does not resize its GL container when Leaflet resizes.
      // Keep both projections aligned during orientation/breakpoint changes.
      map.on('resize',()=>{
        const size=vector.getSize(),container=vector.getContainer();
        container.style.width=`${size.x}px`;container.style.height=`${size.y}px`;
        vector.getMaplibreMap().resize();
      });
    } catch {useFallback();}
  }).catch(useFallback);

  function setLocation(value) {
    location=value;
    me?.remove();
    me=L.marker([location.lat,location.lng],{title:location.isDemo?'You · demo location':'You',zIndexOffset:500,icon:L.divIcon({className:'me-marker',html:`<span class="me-glyph">${icon('me',30)}</span>`,iconSize:[48,48],iconAnchor:[24,24]})}).addTo(map);
    me.on('click',()=>{
      const element=me.getElement()?.querySelector('.me-glyph');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) element?.animate([{transform:'translateY(0)'},{transform:'translateY(-4px)'},{transform:'translateY(0)'}],{duration:230,easing:'ease-out'});
    });
  }
  setLocation(location);

  function draw() {
    layer.clearLayers();
    const bounds=map.getBounds().pad(.1), groups=[];
    for(const event of currentEvents.filter(e=>bounds.contains([e.lat,e.lng]))) {
      const point=map.latLngToLayerPoint([event.lat,event.lng]);
      const group=groups.find(g=>point.distanceTo(g.point)<44 && !g.events.some(e=>e.id===selected) && event.id!==selected);
      if(group)group.events.push(event);else groups.push({point,events:[event]});
    }
    for(const group of groups) {
      const event=group.events[0], cluster=group.events.length>1;
      const lat=group.events.reduce((n,e)=>n+e.lat,0)/group.events.length;
      const lng=group.events.reduce((n,e)=>n+e.lng,0)/group.events.length;
      const marker=L.marker([lat,lng],{title:cluster?`${group.events.length} nearby events`:event.title,icon:L.divIcon({className:'event-marker',html:`<span class="pin ${event.id===selected?'selected':''}">${cluster?group.events.length:'<i></i>'}</span>`,iconSize:[48,48],iconAnchor:[24,24]})}).addTo(layer);
      marker.on('click',()=>{
        if(cluster && map.getZoom()<18) map.setView([lat,lng],map.getZoom()+1,{animate:false});
        else onSelect(event.id,group.events.map(e=>e.id));
      });
    }
    onMove(currentEvents.filter(e=>map.getBounds().contains([e.lat,e.lng])));
  }
  map.on('moveend zoomend',draw);
  map.on('dragstart',onPan);
  map.on('click',onClose);
  function focus(event,animate=true) {
    const size=map.getSize();
    const card=document.querySelector('#event-card');
    const cardTop=card&&!card.hidden?card.getBoundingClientRect().top-map.getContainer().getBoundingClientRect().top:size.y-180;
    const target=L.point(size.x/2,Math.max(110,(72+cardTop)/2));
    const delta=map.latLngToContainerPoint([event.lat,event.lng]).subtract(target);
    map.panBy(delta,{animate:animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches,duration:.25});
  }
  map.on('resize',()=>{
    const event=currentEvents.find(e=>e.id===selected);
    if(event)requestAnimationFrame(()=>focus(event,false));
  });
  return {
    update(events, id) {currentEvents=events;selected=id;draw();},
    focus,
    resize() {map.invalidateSize();},
    home(value=location) {setLocation(value);map.setView([value.lat,value.lng],14,{animate:false});feedback('recenter');},
    zoom(direction) {map.setZoom(map.getZoom()+direction);}
  };
}
