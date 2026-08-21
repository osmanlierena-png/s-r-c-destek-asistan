// Nominatim (OpenStreetMap) tabanlı adres → koordinat dönüşümü
// Rate limit: 1 req/sec (kullanıcı politikası)
// Strateji: 1) temizlenmiş tam adres, 2) sokak+zip, 3) sokak+şehir

const UNIT_KEYWORDS = [
  "suite", "ste", "apt", "apartment", "unit", "fl", "floor", "rm", "room",
  "#", "bldg", "building", "dept", "office", "ofc", "loft", "penthouse",
];

// Bina adı parçaları (EzCater screenshot'larında görülen kalıplar)
const BUILDING_NAME_KEYWORDS = [
  "regents hall", "main or", "tower", "plaza", "center", "centre",
  "annex", "wing", "hall", "lobby", "atrium", "concours",
];

// Adresten unit/suite/kat numaralarını ve bina adı parçalarını temizler
const cleanAddress = (address: string): string => {
  let s = address
    .replace(/\\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // "Suite 725", "Ste 700", "Apt 3", "Floor 6", "Room 101", "#200" kalıplarını kaldır
  const unitPattern = new RegExp(
    `\\b(?:${UNIT_KEYWORDS.join("|")})\\.?\\s*\\d+[a-z]?\\b`,
    "gi"
  );
  s = s.replace(unitPattern, " ");

  // "6th Floor", "3rd Floor", "Main OR" gibi bina adı parçalarını kaldır
  s = s.replace(/\b\d+(?:st|nd|rd|th)?\s+floor\b/gi, " ");
  s = s.replace(new RegExp(`\\b(?:${BUILDING_NAME_KEYWORDS.join("|")})\\b`, "gi"), " ");

  // "700" gibi tek başına duran 3+ haneli unit numaralarını kaldır (sadece adresin başında/ortasında)
  // "1101 16th St NW 700" → "1101 16th St NW"
  s = s.replace(/\s+\d{3,5}[a-z]?\s*,/gi, ",");

  // Çoklu boşlukları ve baştaki/sondaki virgülleri temizle
  s = s.replace(/\s+/g, " ").replace(/,\s*,/g, ",").replace(/^\s*,\s*/, "").trim();

  return s;
};

// US state kodları → tam ad (Nominatim tam ad bekler)
const STATE_NAMES: Record<string, string> = {
  DC: "District of Columbia", VA: "Virginia", MD: "Maryland",
  NY: "New York", NJ: "New Jersey", PA: "Pennsylvania",
  CA: "California", TX: "Texas", FL: "Florida", IL: "Illinois",
  MA: "Massachusetts", WA: "Washington", GA: "Georgia", NC: "North Carolina",
};

// Adresten zip ve şehir bilgisini çıkarır (fallback için)
const extractParts = (address: string) => {
  // "Street, City, ST 12345" formatını yakala
  const match = address.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3],
      zip: match[4],
    };
  }
  return null;
};

const nominatimSearch = async (query: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "DriverSupportAssistant/1.0" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
};

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address) return null;

  const cleaned = cleanAddress(address);
  const parts = extractParts(cleaned);

  // 1) Temizlenmiş tam adres
  let result = await nominatimSearch(cleaned + ", USA");
  if (result) return result;
  await new Promise((r) => setTimeout(r, 1000)); // rate limit

  // 2) Sokak + zip + state (şehir olmadan)
  if (parts) {
    const stateName = STATE_NAMES[parts.state] || parts.state;
    result = await nominatimSearch(`${parts.street}, ${stateName} ${parts.zip}, USA`);
    if (result) return result;
    await new Promise((r) => setTimeout(r, 1000));

    // 3) Sokak + şehir + state (zip olmadan)
    result = await nominatimSearch(`${parts.street}, ${parts.city}, ${stateName}, USA`);
    if (result) return result;
    await new Promise((r) => setTimeout(r, 1000));

    // 4) Sokak + state (şehir ve zip olmadan — sokak adı şehirde belirsizse)
    result = await nominatimSearch(`${parts.street}, ${stateName}, USA`);
    if (result) return result;
  }

  return null;
};