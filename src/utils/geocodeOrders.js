/**
 * Geocodes orders using Nominatim API with fallback strategies
 */

const NOMINATIM_HEADERS = { 'User-Agent': 'OrderManagement/1.0 (ogulcan.aygun@base44.io)' };

const nominatimSearch = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', USA')}&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  return data && data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
};

const cleanAddress = (address) => {
  if (!address) return address;
  return address
    .replace(/\b(door|suite|building|unit|apt|apartment|floor|room|ste|bldg|fl)\s*#?\s*[\w\-]+/gi, '')
    .replace(/\d{4,}\s+[A-Za-z\s]+(?=,)/g, '')
    .replace(/\d+(st|nd|rd|th)\s+floor/gi, '')
    .replace(/\s+/g, ' ').trim();
};

const extractBasicAddress = (address) => {
  if (!address) return null;
  const zipMatch = address.match(/\b(\d{5})\b/);
  const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
  const cityMatch = address.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
  const streetMatch = address.match(/^([\d\s]+[A-Za-z\s]+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Ct|Pkwy)?)/i);
  const zip = zipMatch ? zipMatch[1] : '', state = stateMatch ? stateMatch[1] : '';
  const city = cityMatch ? cityMatch[1].trim() : '', street = streetMatch ? streetMatch[1].trim() : '';
  if (street && city && state) return `${street}, ${city}, ${state}${zip ? ' ' + zip : ''}`;
  if (city && state && zip) return `${city}, ${state} ${zip}`;
  return null;
};

const extractZipFallback = (address) => {
  if (!address) return null;
  const zipMatch = address.match(/\b(\d{5})\b/);
  const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
  const cityMatch = address.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
  if (cityMatch && stateMatch && zipMatch) return `${cityMatch[1].trim()}, ${stateMatch[1]} ${zipMatch[1]}`;
  if (zipMatch && stateMatch) return `${stateMatch[1]} ${zipMatch[1]}`;
  if (zipMatch) return zipMatch[1];
  return null;
};

export const geocodeAddress = async (address) => {
  if (!address) return null;
  const delay = () => new Promise(r => setTimeout(r, 1100));

  let coords = await nominatimSearch(cleanAddress(address));
  if (coords) return coords;
  await delay();

  const basic = extractBasicAddress(address);
  if (basic) { coords = await nominatimSearch(basic); if (coords) return coords; }
  await delay();

  const zip = extractZipFallback(address);
  if (zip) { coords = await nominatimSearch(zip); if (coords) return coords; }

  return null;
};

export const geocodeOrders = async (orders, { onProgress, updateOrder }) => {
  const needsGeocode = orders.filter(o => !o.pickup_coords || !o.dropoff_coords);
  let successCount = 0, failCount = 0;

  for (let i = 0; i < needsGeocode.length; i++) {
    const order = needsGeocode[i];
    let pickupCoords = order.pickup_coords;
    let dropoffCoords = order.dropoff_coords;

    if (!pickupCoords && order.pickup_address) {
      pickupCoords = await geocodeAddress(order.pickup_address);
    }
    if (!dropoffCoords && order.dropoff_address) {
      dropoffCoords = await geocodeAddress(order.dropoff_address);
    }

    if (pickupCoords || dropoffCoords) {
      const updateData = {};
      if (pickupCoords) updateData.pickup_coords = pickupCoords;
      if (dropoffCoords) updateData.dropoff_coords = dropoffCoords;
      await updateOrder(order.id, updateData);
      successCount++;
    } else {
      failCount++;
    }

    onProgress(Math.round(((i + 1) / needsGeocode.length) * 100));
    if ((i + 1) % 5 === 0 && i < needsGeocode.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { total: needsGeocode.length, successCount, failCount };
};