// OSRM Routing API — gerçek sürüş mesafesi (kuş uçuşu değil)
// URL: https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false
// Returns: { routes: [{ distance: meters }] }

const METERS_TO_MILES = 0.000621371;

export const calculateDrivingDistance = async (
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number }
): Promise<number | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=false`;
    const response = await fetch(url, {
      headers: { "User-Agent": "DriverSupportAssistant/1.0" },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) return null;

    const distanceMeters = data.routes[0].distance;
    return Math.round(distanceMeters * METERS_TO_MILES * 10) / 10;
  } catch (error) {
    console.error("Distance calculation error:", error);
    return null;
  }
};