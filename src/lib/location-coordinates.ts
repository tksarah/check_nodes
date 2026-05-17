export type ResolvedCoordinates = {
  latitude: number;
  longitude: number;
};

const LOCATION_COORDINATES: Record<string, ResolvedCoordinates> = {
  amsterdam: { latitude: 52.3676, longitude: 4.9041 },
  ashburn: { latitude: 39.0438, longitude: -77.4874 },
  atlanta: { latitude: 33.749, longitude: -84.388 },
  bangalore: { latitude: 12.9716, longitude: 77.5946 },
  bengaluru: { latitude: 12.9716, longitude: 77.5946 },
  berlin: { latitude: 52.52, longitude: 13.405 },
  chicago: { latitude: 41.8781, longitude: -87.6298 },
  dallas: { latitude: 32.7767, longitude: -96.797 },
  frankfurt: { latitude: 50.1109, longitude: 8.6821 },
  helsinki: { latitude: 60.1699, longitude: 24.9384 },
  hongkong: { latitude: 22.3193, longitude: 114.1694 },
  hongkongcity: { latitude: 22.3193, longitude: 114.1694 },
  istanbul: { latitude: 41.0082, longitude: 28.9784 },
  jakarta: { latitude: -6.2088, longitude: 106.8456 },
  johannesburg: { latitude: -26.2041, longitude: 28.0473 },
  london: { latitude: 51.5072, longitude: -0.1276 },
  losangeles: { latitude: 34.0522, longitude: -118.2437 },
  madrid: { latitude: 40.4168, longitude: -3.7038 },
  melbourne: { latitude: -37.8136, longitude: 144.9631 },
  miami: { latitude: 25.7617, longitude: -80.1918 },
  montreal: { latitude: 45.5019, longitude: -73.5674 },
  mumbai: { latitude: 19.076, longitude: 72.8777 },
  newyork: { latitude: 40.7128, longitude: -74.006 },
  osaka: { latitude: 34.6937, longitude: 135.5023 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
  sanfrancisco: { latitude: 37.7749, longitude: -122.4194 },
  saopaulo: { latitude: -23.5558, longitude: -46.6396 },
  seattle: { latitude: 47.6061, longitude: -122.3328 },
  seoul: { latitude: 37.5665, longitude: 126.978 },
  singapore: { latitude: 1.3521, longitude: 103.8198 },
  stockholm: { latitude: 59.3293, longitude: 18.0686 },
  sydney: { latitude: -33.8688, longitude: 151.2093 },
  taipei: { latitude: 25.033, longitude: 121.5654 },
  tokyo: { latitude: 35.6762, longitude: 139.6503 },
  toronto: { latitude: 43.6532, longitude: -79.3832 },
  warsaw: { latitude: 52.2297, longitude: 21.0122 },
  zurich: { latitude: 47.3769, longitude: 8.5417 }
};

export function normalizeLocationName(location: string) {
  return location
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function resolveLocationCoordinates(
  location: string | null | undefined
): ResolvedCoordinates | null {
  if (!location) return null;

  const normalized = normalizeLocationName(location);
  if (!normalized) return null;

  return LOCATION_COORDINATES[normalized] ?? null;
}
