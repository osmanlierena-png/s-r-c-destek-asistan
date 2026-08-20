/**
 * Pickup → Dropoff süre hesaplama yardımcıları
 * Desteklenen formatlar: "10:45 AM", "11:30:00 AM", "14:30", "1/15/2026 11:30:00 AM"
 */

// Zaman stringini gece yarısından dakikaya çevirir
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const str = String(timeStr).trim().toUpperCase();
  // Tarih prefix'i varsa sadece saat kısmını al
  const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[4];

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Pickup → Dropoff arası dakika farkı (gece yarısını geçen durumda +24sa)
export function calcDurationMinutes(pickupTime, dropoffTime) {
  const p = parseTimeToMinutes(pickupTime);
  const d = parseTimeToMinutes(dropoffTime);
  if (p == null || d == null) return null;

  let diff = d - p;
  if (diff < 0) diff += 24 * 60; // gece yarısını geçti
  return diff;
}

// Dakikayı "Xsa Ydk" formatına çevirir
export function formatDuration(minutes) {
  if (minutes == null) return null;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}dk`;
  if (mins === 0) return `${hrs}sa`;
  return `${hrs}sa ${mins}dk`;
}