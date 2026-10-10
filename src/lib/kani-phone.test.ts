import { describe, expect, it } from "vitest";
import { formatPhoneInput, normalizePhone } from "./kani-phone";

describe("phone normalization", () => {
  it("normalizes an Argentine mobile number to E.164", () => {
    expect(normalizePhone("9 11 2843-6014", "AR")?.e164).toBe("+5491128436014");
  });

  it("normalizes a Brazilian mobile number to E.164", () => {
    expect(normalizePhone("12 98829-1775", "BR")?.e164).toBe("+5512988291775");
  });

  it("formats while typing and rejects letters through the input helper", () => {
    expect(formatPhoneInput("9 11 ab2843-6014", "AR")).toBe("91128436014");
    expect(normalizePhone("123", "AR")).toBeNull();
  });
});
