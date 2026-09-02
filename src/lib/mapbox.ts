/**
 * Builds a Mapbox Static Images API URL that renders a Strava route polyline
 * over a map. Requires NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (a public "pk." token
 * is expected here since this URL is used directly in <img> tags client-side).
 * Returns null if no token is configured or there's no polyline to draw.
 */
export function getMapboxStaticMapUrl(
  polyline?: string | null,
  options: { width?: number; height?: number } = {}
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !polyline) {
    return null;
  }

  const { width = 400, height = 300 } = options;
  const encodedPolyline = encodeURIComponent(polyline);
  const pathOverlay = `path-4+fc4c02-1(${encodedPolyline})`;

  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pathOverlay}/auto/${width}x${height}@2x?padding=30&access_token=${token}`;
}
