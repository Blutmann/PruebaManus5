import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type PhoneCountry = CountryCode;
export type PhoneCountryOption = {
  code: CountryCode;
  dialCode: string;
  name: string;
  flag: string;
  isoCode: CountryCode;
  shortCode: string;
};

const countryShortCodes: Record<string, string> = { AR: 'ARG', US: 'USA', BR: 'BRA', UY: 'URY', CL: 'CHL', PY: 'PRY', BO: 'BOL', VE: 'VEN', PE: 'PER', CO: 'COL', EC: 'ECU', MX: 'MEX', ES: 'ESP', IT: 'ITA' };
const primaryCountryCodes: PhoneCountry[] = ['AR', 'CL', 'BR', 'UY', 'PY', 'VE', 'PE', 'CO', 'EC', 'MX', 'ES', 'US'];

const displayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["es"], { type: "region" })
    : null;

export const phoneCountries: PhoneCountryOption[] = getCountries().map((country) => ({
  code: country,
  dialCode: `+${getCountryCallingCode(country)}`,
  name: displayNames?.of(country) ?? country,
  flag: countryToFlag(country),
  isoCode: country,
  shortCode: countryShortCodes[country] ?? country,
}));

export function normalizeCountrySearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

const countryNameSort = (a: PhoneCountryOption, b: PhoneCountryOption) =>
  a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

export const primaryPhoneCountries = primaryCountryCodes
  .map(code => phoneCountries.find(country => country.code === code))
  .filter((country): country is PhoneCountryOption => Boolean(country));

const primaryCountrySet = new Set(primaryCountryCodes);
export const otherPhoneCountries = phoneCountries
  .filter(country => !primaryCountrySet.has(country.code))
  .sort(countryNameSort);

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
