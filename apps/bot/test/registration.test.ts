import { describe, expect, it } from "vitest";
import { nextStep, validate } from "../src/registration.js";

describe("ro'yxat", () => {
  it("bosqichlarni tartib bilan beradi", () => {
    expect(nextStep({})).toBe("firstName");
    expect(nextStep({ firstName: "Ali", lastName: "V" })).toBe("phone");
    expect(nextStep({ firstName: "a", lastName: "b", phone: "1", region: "r", district: "d", address: "x", school: "s", grade: "g" })).toBeNull();
  });
  it("noto'g'ri qiymatlarni rad etadi", () => {
    expect(validate("firstName", "Ali1")).not.toBeNull();
    expect(validate("phone", "+998 90 123 45 67")).toBeNull();
    expect(validate("phone", "abc")).not.toBeNull();
    expect(validate("region", "Samarqand")).toBeNull();
    expect(validate("region", "Moskva")).not.toBeNull();
  });
});
