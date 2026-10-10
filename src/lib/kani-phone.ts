import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type PhoneCountry = CountryCode;

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["es"], { type: "region" })
    : null;

export const phoneCountries = getCountries().map((country) => ({
  code: country,
  dialCode: `+${getCountryCallingCode(country)}`,
  name: displayNames?.of(country) ?? country,
  flag: countryToFlag(country),
}));

export function countryToFlag(country: string) {
  return country
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function formatPhoneInput(value: string, country: PhoneCountry) {
  const safeValue = value.replace(/[^0-9+()\-\s]/g, "");
  return new AsYouType(country).input(safeValue);
}

export function normalizePhone(value: string, country: PhoneCountry) {
  const parsed = parsePhoneNumberFromString(value, country);
  if (!parsed || !parsed.isValid()) return null;
  return {
    e164: parsed.number,
    display: parsed.formatInternational(),
    country: parsed.country ?? country,
  };
}
