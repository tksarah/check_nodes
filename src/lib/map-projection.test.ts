import { describe, expect, it } from "vitest";
import { projectEquirectangular } from "./map-projection";

describe("projectEquirectangular", () => {
  it("projects the equator and prime meridian to the center", () => {
    expect(projectEquirectangular(0, 0)).toEqual({ x: 50, y: 50 });
  });

  it("projects longitude and latitude to percent coordinates", () => {
    expect(projectEquirectangular(35.6762, 139.6503)).toMatchObject({
      x: expect.closeTo(88.79, 2),
      y: expect.closeTo(30.18, 2)
    });
  });

  it("clamps coordinates to the map bounds", () => {
    expect(projectEquirectangular(90, 200)).toEqual({
      x: 100,
      y: expect.closeTo(2.7778, 4)
    });
  });
});
