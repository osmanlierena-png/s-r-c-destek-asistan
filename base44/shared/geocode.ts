// Nominatim (OpenStreetMap) tabanlı adres → koordinat dönüşümü
// Rate limit: 1 req/sec (kullanıcı politikası)

export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  if (!address) return null;
  try {
    const clean = address
      .replace(/\\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean + ", USA")}&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "DriverSupportAssistant/1.0" } }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
};