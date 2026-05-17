import { describe, expect, it } from "vitest";
import { normalizeLocationName, resolveLocationCoordinates } from "./location-coordinates";

describe("location coordinate resolver", () => {
  it("normalizes location labels for matching", () => {
    expect(normalizeLocationName("San Francisco")).toBe("sanfrancisco");
    expect(normalizeLocationName("São Paulo")).toBe("saopaulo");
  });

  it("resolves representative telemetry cities", () => {
    expect(resolveLocationCoordinates("Tokyo")).toMatchObject({
      latitude: 35.6762,
      longitude: 139.6503
    });
    expect(resolveLocationCoordinates("Frankfurt")).toMatchObject({
      latitude: 50.1109,
      longitude: 8.6821
    });
    expect(resolveLocationCoordinates("Singapore")).toMatchObject({
      latitude: 1.3521,
      longitude: 103.8198
    });
    expect(resolveLocationCoordinates("Sydney")).toMatchObject({
      latitude: -33.8688,
      longitude: 151.2093
    });
  });

  it("returns null for unknown locations", () => {
    expect(resolveLocationCoordinates("Atlantis")).toBeNull();
  });
});
