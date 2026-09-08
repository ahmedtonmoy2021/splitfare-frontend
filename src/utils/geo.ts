export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestOnRoute(routeCoords: number[][], point: { lat: number; lng: number }) {
  if (!routeCoords || routeCoords.length === 0 || !point) return null;
  let best: any = null;
  for (const [lng, lat] of routeCoords) {
    const d = haversine(point.lat, point.lng, lat, lng);
    if (!best || d < best.distance) {
      best = { lat, lng, distance: d };
    }
  }
  return best;
}

export function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
