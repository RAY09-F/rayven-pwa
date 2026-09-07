// Google Maps / Places integration. Ported unchanged from worker.js.

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeRaw(env, address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${env.GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results.length) {
    console.error('Geocode failed:', JSON.stringify(data));
    return null;
  }
  const r = data.results[0];
  return { address: r.formatted_address, lat: r.geometry.location.lat, lng: r.geometry.location.lng };
}

async function reverseGeocode(env, lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${env.GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.results.length) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return data.results[0].formatted_address;
}

async function fetchAllPlacesRaw(env, query) {
  let allPlaces = [];
  let pageToken = null;
  for (let page = 0; page < 3; page++) {
    const requestBody = { textQuery: query, pageSize: 20 };
    if (pageToken) requestBody.pageToken = pageToken;
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,nextPageToken'
      },
      body: JSON.stringify(requestBody)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Google Places API raw error response:', res.status, JSON.stringify(data));
      throw new Error(`Google returned status ${res.status}: ${JSON.stringify(data)}`);
    }
    if (Array.isArray(data.places)) {
      data.places.forEach(p => {
        allPlaces.push({
          id: p.id,
          name: p.displayName?.text || 'Unknown',
          address: p.formattedAddress || '',
          lat: p.location?.latitude,
          lng: p.location?.longitude
        });
      });
    }
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
    await new Promise(r => setTimeout(r, 2000));
  }
  const seen = new Set();
  return allPlaces.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export async function googlePlacesSearch(env, query) {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.internationalPhoneNumber'
      },
      body: JSON.stringify({ textQuery: query })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Google Places API raw error response:', res.status, JSON.stringify(data));
      return `Google Places error (status ${res.status}): ${JSON.stringify(data)}`;
    }
    const places = data.places || [];
    if (!places.length) return `No places found for "${query}".`;
    let summary = '';
    places.slice(0, 5).forEach((p, i) => {
      summary += `\n[${i + 1}] ${p.displayName?.text || 'Unknown'}\n${p.formattedAddress || ''}`;
      if (p.rating) summary += ` — ${p.rating}★ (${p.userRatingCount || 0} ratings)`;
      if (p.currentOpeningHours) summary += p.currentOpeningHours.openNow ? ' — Open now' : ' — Closed now';
      if (p.internationalPhoneNumber) summary += `\nPhone: ${p.internationalPhoneNumber}`;
      summary += '\n';
    });
    return summary;
  } catch (err) {
    console.error('googlePlacesSearch crashed:', err.message);
    return `Google Places search failed: ${err.message}`;
  }
}

export async function googlePlacesFindAll(env, query) {
  try {
    const unique = await fetchAllPlacesRaw(env, query);
    if (!unique.length) return `No locations found for "${query}".`;
    let summary = `Found ${unique.length} location(s):\n`;
    unique.forEach((p, i) => {
      summary += `\n${i + 1}. ${p.name} — ${p.address}`;
    });
    if (unique.length >= 60) summary += `\n\n(Note: capped at ~60 results — there may be more not captured here.)`;
    return summary;
  } catch (err) {
    console.error('googlePlacesFindAll crashed:', err.message);
    return `Exhaustive place search failed: ${err.message}`;
  }
}

export async function googleDistanceMatrix(env, query) {
  try {
    const places = await fetchAllPlacesRaw(env, query);
    if (places.length < 2) return `Need at least 2 locations to compare — only found ${places.length} for "${query}".`;

    const capped = places.slice(0, 10);
    const coordsParam = capped.map(p => `${p.lat},${p.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(coordsParam)}&destinations=${encodeURIComponent(coordsParam)}&key=${env.GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') {
      console.error('Distance Matrix raw error:', JSON.stringify(data));
      return `Distance matrix error: ${data.status}`;
    }

    let summary = `Driving distances between ${capped.length} locations (${places.length > 10 ? 'showing first 10 of ' + places.length : 'all found'}):\n`;
    for (let i = 0; i < capped.length; i++) {
      for (let j = i + 1; j < capped.length; j++) {
        const el = data.rows[i]?.elements[j];
        if (el && el.status === 'OK') {
          summary += `\n${capped[i].name} ↔ ${capped[j].name}: ${el.distance.text}, ${el.duration.text}`;
        }
      }
    }
    return summary;
  } catch (err) {
    console.error('googleDistanceMatrix crashed:', err.message);
    return `Distance matrix failed: ${err.message}`;
  }
}

export async function googleFindGapAreas(env, businessType, cityName) {
  try {
    const center = await geocodeRaw(env, cityName);
    if (!center) return `Could not find a location for "${cityName}".`;

    const competitors = await fetchAllPlacesRaw(env, `${businessType} in ${cityName}`);
    if (!competitors.length) return `Found no existing "${businessType}" locations in ${cityName} to compare against — can't compute gaps.`;

    const radiusMiles = 8;
    const stepMiles = 1.25;
    const latDegPerMile = 1 / 69.0;
    const lngDegPerMile = 1 / (69.0 * Math.cos(center.lat * Math.PI / 180));

    const candidates = [];
    for (let dx = -radiusMiles; dx <= radiusMiles; dx += stepMiles) {
      for (let dy = -radiusMiles; dy <= radiusMiles; dy += stepMiles) {
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);
        if (distFromCenter > radiusMiles) continue;
        const lat = center.lat + dy * latDegPerMile;
        const lng = center.lng + dx * lngDegPerMile;
        let nearestDist = Infinity;
        for (const c of competitors) {
          if (c.lat == null || c.lng == null) continue;
          const d = haversineMiles(lat, lng, c.lat, c.lng);
          if (d < nearestDist) nearestDist = d;
        }
        candidates.push({ lat, lng, nearestDist });
      }
    }

    candidates.sort((a, b) => b.nearestDist - a.nearestDist);
    const top = candidates.slice(0, 5);

    let summary = `Geographic gap analysis for "${businessType}" around ${center.address} (${competitors.length} existing locations found):\n\n`;
    summary += `These are the areas within ~${radiusMiles} miles of the city center that sit FARTHEST from any existing ${businessType} — pure geographic spacing, not real estate availability, zoning, foot traffic, or demographics:\n`;
    for (let i = 0; i < top.length; i++) {
      const addr = await reverseGeocode(env, top[i].lat, top[i].lng);
      summary += `\n${i + 1}. Near ${addr} — ${top[i].nearestDist.toFixed(1)} miles from the nearest existing location`;
    }
    summary += `\n\nThis only tells you where coverage is thin. It does NOT confirm land is available, zoned correctly, or actually a good business decision — that needs real research beyond what I can pull from Maps.`;
    return summary;
  } catch (err) {
    console.error('googleFindGapAreas crashed:', err.message);
    return `Gap analysis failed: ${err.message}`;
  }
}

export async function googleDirections(env, origin, destination, mode) {
  try {
    const travelMode = mode || 'driving';
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${travelMode}&key=${env.GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') {
      console.error('Directions raw error:', JSON.stringify(data));
      return `Directions error: ${data.status} — ${data.error_message || 'no route found'}`;
    }
    const route = data.routes[0];
    const leg = route.legs[0];
    let summary = `From ${leg.start_address} to ${leg.end_address}\nDistance: ${leg.distance.text}, Duration: ${leg.duration.text} (${travelMode})\n\nSteps:\n`;
    leg.steps.slice(0, 10).forEach((step, i) => {
      const plainInstruction = step.html_instructions.replace(/<[^>]+>/g, '');
      summary += `${i + 1}. ${plainInstruction} (${step.distance.text})\n`;
    });
    return summary;
  } catch (err) {
    console.error('googleDirections crashed:', err.message);
    return `Directions failed: ${err.message}`;
  }
}

export async function googleGeocode(env, address) {
  const result = await geocodeRaw(env, address);
  if (!result) return `Could not find a location for "${address}".`;
  return `${result.address}\nCoordinates: ${result.lat}, ${result.lng}`;
}
