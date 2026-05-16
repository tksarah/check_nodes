import { describe, expect, it } from "vitest";
import { adminCheckRedirectPath } from "./check-result";

describe("adminCheckRedirectPath", () => {
  it("redirects successful checks to the success notice", () => {
    expect(
      adminCheckRedirectPath({
        checkedAt: new Date("2026-05-17T00:00:00.000Z"),
        status: "success",
        checkRunId: 1,
        source: "manual"
      })
    ).toBe("/admin?check=success");
  });

  it("redirects skipped checks to the already-running notice", () => {
    expect(
      adminCheckRedirectPath({
        checkedAt: new Date("2026-05-17T00:00:00.000Z"),
        status: "skipped",
        reason: "already_running",
        source: "manual"
      })
    ).toBe("/admin?check=running");
  });
});
