// OSRM Routing API — gerçek sürüş mesafesi ve süresi (kuş uçuşu değil)
// URL: https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false
// Returns: { routes: [{ distance: meters, duration: seconds }] }

const METERS_TO_MILES = 0.000621371;

export interface DrivingResult {
  miles: number;
  durationMinutes: number;
}

export const calculateDrivingDistance = async (
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number }
): Promise<DrivingResult | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=false`;
    const response = await fetch(url, {
      headers: { "User-Agent": "DriverSupportAssistant/1.0" },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) return null;

    const distanceMeters = data.routes[0].distance;
    const durationSeconds = data.routes[0].duration;

    return {
      miles: Math.round(distanceMeters * METERS_TO_MILES * 10) / 10,
      durationMinutes: Math.round(durationSeconds / 60),
    };
  } catch (error) {
    console.error("Distance calculation error:", error);
    return null;
  }
};