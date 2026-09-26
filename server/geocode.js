// OpenStreetMap Nominatim: free, no key, but max. 1 request per second and a
// descriptive User-Agent are required (https://operations.osmfoundation.org/policies/nominatim/).
const USER_AGENT = 'OutThere-Hackathon-Prototype/1.0 (BadgerBuildFest 2026)';
let queue = Promise.resolve();

function throttled(url) {
  const run = queue.then(async () => {
    const response = await fetch(url, {headers: {'User-Agent': USER_AGENT, 'Accept-Language': 'en'}});
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    return response.json();
  });
  queue = run.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 1100)));
  return run;
}

const placeCache = new Map();

export async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (placeCache.has(key)) return placeCache.get(key);
  const data = await throttled(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lng}`);
  const a = data.address || {};
  const place = {
    city: a.city || a.town || a.village || a.municipality || a.county || 'Unknown city',
    region: a.state || a.region || '',
    country: a.country || '',
    countryCode: (a.country_code || '').toUpperCase(),
  };
  placeCache.set(key, place);
  return place;
}

export async function geocodeAddress(query, near) {
  const box = near
    ? `&viewbox=${near.lng - 0.5},${near.lat + 0.5},${near.lng + 0.5},${near.lat - 0.5}&bounded=1`
    : '';
  const results = await throttled(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}${box}`);
  if (!results.length) return null;
  return {lat: Number(results[0].lat), lng: Number(results[0].lon)};
}

export function distanceKm(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
