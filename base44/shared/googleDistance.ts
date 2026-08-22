// Google Distance Matrix API — gerçek sürüş mesafesi ve süresi
// Ham adresleri olduğu gibi Google'a gönderir (temizleme YOK — Google adres ayrıştırmayı kendi yapar)
// Cache: DistanceCache entity, yön duyarlı (A→B ≠ B→A), 7 gün TTL
// Fallback: NOT_FOUND/ZERO_RESULTS → Google Geocoding (APPROXIMATE/partial_match reddedilir) → lat,lng ile tekrar
// Hata yönetimi: OVER_QUERY_LIMIT/UNKNOWN_ERROR/HTTP 5xx → 2sn bekleme + max 3 retry
//                REQUEST_DENIED → retry yok, logla (key/faturalandırma sorunu)
//                GOOGLE_MAPS_API_KEY boşsa → hata (sessiz OSRM düşüşü yok)

const METERS_TO_MILES = 0.000621371;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const RETRYABLE_STATUSES = ["OVER_QUERY_LIMIT", "UNKNOWN_ERROR"];

export interface DrivingResult {
  miles: number;
  durationMinutes: number;
  fromCache: boolean;
}

// Normalize: küçük harf + fazla boşlukları tek boşluğa indir
const normalizeAddress = (address: string): string => {
  return address.toLowerCase().replace(/\s+/g, " ").trim();
};

// Cache anahtarı: yön duyarlı (A→B ≠ B→A — tek yönlü yollar yüzünden mesafeler farklı çıkabilir)
const buildCacheKey = (origin: string, destination: string): string => {
  return `${normalizeAddress(origin)}||${normalizeAddress(destination)}`;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Google Distance Matrix çağrısı — ham adresler veya lat,lng
// Returns: { miles, durationMinutes } veya null (NOT_FOUND/ZERO_RESULTS → fallback)
// Throws: retryable (OVER_QUERY_LIMIT/UNKNOWN_ERROR/HTTP 5xx) veya REQUEST_DENIED
const callDistanceMatrix = async (
  apiKey: string,
  origins: string,
  destinations: string
): Promise<{ miles: number; durationMinutes: number } | null> => {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=driving&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const data = await response.json();

  // API seviyesi status kontrolü
  if (data.status === "REQUEST_DENIED") {
    throw new Error(`REQUEST_DENIED: ${data.error_message || "API key/faturalandırma sorunu"}`);
  }
  if (RETRYABLE_STATUSES.includes(data.status)) {
    throw new Error(data.status);
  }
  if (data.status !== "OK") {
    throw new Error(`DM_STATUS_${data.status}`);
  }

  // Element seviyesi kontrolü
  const element = data.rows?.[0]?.elements?.[0];
  if (!element) return null;

  if (element.status === "NOT_FOUND" || element.status === "ZERO_RESULTS") {
    return null; // → Geocoding fallback
  }
  if (element.status === "OK" && element.distance?.value != null && element.duration?.value != null) {
    // distance.text KULLANILMAZ (km olarak döner) — her zaman .value (metre) hesapla
    return {
      miles: Math.round(element.distance.value * METERS_TO_MILES * 10) / 10,
      durationMinutes: Math.ceil(element.duration.value / 60),
    };
  }

  return null;
};

// Retryable çağrı sarıcı — OVER_QUERY_LIMIT/UNKNOWN_ERROR/HTTP 5xx → 2sn bekle + max 3 retry
const callWithRetry = async (
  fn: () => Promise<{ miles: number; durationMinutes: number } | null>
): Promise<{ miles: number; durationMinutes: number } | null> => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error.message || "";
      const isRetryable = RETRYABLE_STATUSES.includes(msg) || /^HTTP_5\d\d$/.test(msg);
      if (isRetryable && attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw error; // REQUEST_DENIED veya retry bitti
    }
  }
  return null;
};

// Google Geocoding — APPROXIMATE/partial_match reddedilir (ZIP merkezi gibi kaba sonuç)
const geocodeWithGoogle = async (
  apiKey: string,
  address: string
): Promise<{ lat: number; lng: number } | null> => {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== "OK" || !data.results || data.results.length === 0) return null;

    const result = data.results[0];

    // Kaba sonuçları reddet — ZIP merkezi ile mesafe hesaplama yanlış sayı üretir
    if (result.partial_match === true) return null;
    if (result.geometry?.location_type === "APPROXIMATE") return null;

    const loc = result.geometry?.location;
    if (!loc || loc.lat == null || loc.lng == null) return null;

    return { lat: loc.lat, lng: loc.lng };
  } catch {
    return null;
  }
};

export const getDrivingDistance = async (
  base44: any,
  origin: string,
  destination: string
): Promise<DrivingResult | null> => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY tanımlı değil — Google Distance Matrix kullanılamaz");
  }

  if (!origin || !destination) return null;

  const cacheKey = buildCacheKey(origin, destination);

  // 1) Cache kontrolü (7 gün TTL)
  try {
    const cached = await base44.entities.DistanceCache.filter({ cache_key: cacheKey }, "-created_date", 1);
    if (cached && cached.length > 0) {
      const entry = cached[0];
      const ageMs = Date.now() - new Date(entry.created_date).getTime();
      if (ageMs < CACHE_TTL_MS) {
        return {
          miles: entry.driving_distance_miles,
          durationMinutes: entry.driving_duration_minutes,
          fromCache: true,
        };
      }
    }
  } catch (e) {
    console.error("Cache okuma hatası:", e);
  }

  // 2) Google Distance Matrix (ham adresler — temizleme YOK)
  let result = await callWithRetry(() => callDistanceMatrix(apiKey, origin, destination));

  // 3) NOT_FOUND/ZERO_RESULTS → Google Geocoding fallback (kaba sonuç reddedilir)
  if (result == null) {
    const [originCoords, destCoords] = await Promise.all([
      geocodeWithGoogle(apiKey, origin),
      geocodeWithGoogle(apiKey, destination),
    ]);

    if (originCoords && destCoords) {
      const originStr = `${originCoords.lat},${originCoords.lng}`;
      const destStr = `${destCoords.lat},${destCoords.lng}`;
      result = await callWithRetry(() => callDistanceMatrix(apiKey, originStr, destStr));
    }
  }

  if (result == null) return null;

  // 4) Cache'e kaydet
  try {
    await base44.entities.DistanceCache.create({
      cache_key: cacheKey,
      origin_raw: origin,
      destination_raw: destination,
      driving_distance_miles: result.miles,
      driving_duration_minutes: result.durationMinutes,
    });
  } catch (e) {
    console.error("Cache yazma hatası:", e);
  }

  return {
    miles: result.miles,
    durationMinutes: result.durationMinutes,
    fromCache: false,
  };
};