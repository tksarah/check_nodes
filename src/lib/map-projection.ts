export type ProjectedPoint = {
  x: number;
  y: number;
};

export function projectEquirectangular(
  latitude: number,
  longitude: number
): ProjectedPoint {
  const clampedLatitude = clamp(latitude, -85, 85);
  const clampedLongitude = clamp(longitude, -180, 180);

  return {
    x: ((clampedLongitude + 180) / 360) * 100,
    y: ((90 - clampedLatitude) / 180) * 100
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
