import { describe, expect, it } from "vitest";
import { formatPhoneInput, normalizeCountrySearch, normalizePhone, otherPhoneCountries, phoneCountries, primaryPhoneCountries } from "./kani-phone";

describe("phone normalization", () => {
  it("normalizes an Argentine mobile number to E.164", () => {
    expect(normalizePhone("9 11 0000-0000", "AR")?.e164).toBe("+5491100000000");
  });

  it("normalizes a Brazilian mobile number to E.164", () => {
    expect(normalizePhone("12 98829-1775", "BR")?.e164).toBe("+5512988291775");
  });

  it("formats while typing and rejects letters through the input helper", () => {
    expect(formatPhoneInput("9 11 ab0000-0000", "AR")).toBe("91100000000");
    expect(normalizePhone("123", "AR")).toBeNull();
  });
});


describe("phone country labels", () => {
  it("uses short labels for common countries", () => {
    expect(phoneCountries.find(country => country.code === "AR")?.shortCode).toBe("ARG");
    expect(phoneCountries.find(country => country.code === "US")?.shortCode).toBe("USA");
    expect(phoneCountries.find(country => country.code === "BR")?.shortCode).toBe("BRA");
  });

  it("prioritizes the requested countries without losing the complete catalog", () => {
    expect(primaryPhoneCountries.map(country => country.code)).toEqual(["AR", "CL", "BR", "UY", "PY", "VE", "PE", "CO", "EC", "MX", "ES", "US"]);
    expect(new Set([...primaryPhoneCountries, ...otherPhoneCountries]).size).toBe(phoneCountries.length);
    expect(otherPhoneCountries.map(country => country.name).join("|"))
      .toBe([...otherPhoneCountries].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })).map(country => country.name).join("|"));
  });

  it("normalizes country searches with or without accents", () => {
    expect(normalizeCountrySearch("España")).toBe("espana");
    expect(normalizeCountrySearch("esPANA")).toBe("espana");
    expect(normalizeCountrySearch("Perú")).toBe("peru");
  });
});
