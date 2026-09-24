import { StateLite, CityLite } from "country-state-city-js";

const COUNTRY_CODE = "IN";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

const INDIA_STATES = (StateLite(COUNTRY_CODE) || [])
  .map((state) => ({
    name: String(state.name || "").trim(),
    code: String(state.iso || "").trim().toUpperCase(),
  }))
  .filter((state) => state.name && state.code)
  .sort((a, b) => a.name.localeCompare(b.name));

const STATE_BY_NAME = new Map(
  INDIA_STATES.map((state) => [state.name.toLowerCase(), state]),
);

const INDIA_CITIES = INDIA_STATES.flatMap((state) =>
  (CityLite(COUNTRY_CODE, state.code) || []).map((cityName) => ({
    name: String(cityName || "").trim(),
    state: state.name,
    stateCode: state.code,
  })),
).filter((city) => city.name);

const PIN_CACHE = new Map();

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function safeLimit(value) {
  const parsed = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(parsed)));
}

function rankMatches(rows, query, getText) {
  const q = normalizeText(query);
  if (!q) return rows;

  const starts = [];
  const contains = [];

  for (const row of rows) {
    const text = normalizeText(getText(row));
    if (text.startsWith(q)) starts.push(row);
    else if (text.includes(q)) contains.push(row);
  }

  return [...starts, ...contains];
}

export function searchIndiaStates(query = "", limit = DEFAULT_LIMIT) {
  return rankMatches(INDIA_STATES, query, (row) => row.name)
    .slice(0, safeLimit(limit));
}

export function searchIndiaCities({ query = "", state = "", limit = DEFAULT_LIMIT } = {}) {
  const q = normalizeText(query);
  if (!q) return [];

  let rows = INDIA_CITIES;
  const stateText = normalizeText(state);

  if (stateText) {
    const exactState = STATE_BY_NAME.get(stateText);
    if (exactState) {
      rows = rows.filter((row) => row.stateCode === exactState.code);
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const row of rankMatches(rows, q, (entry) => entry.name)) {
    const key = `${row.name.toLowerCase()}|${row.stateCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= safeLimit(limit)) break;
  }

  return deduped;
}

function titleCase(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

async function fetchJson(url, timeoutMs = 5500, { notFoundIsNull = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (notFoundIsNull && response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Location provider returned HTTP ${response.status}.`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizePostalPincodeResponse(payload, pincode) {
  const first = Array.isArray(payload) ? payload[0] : null;
  const offices = Array.isArray(first?.PostOffice) ? first.PostOffice : [];
  const office = offices[0];

  if (!office || String(first?.Status || "").toLowerCase() !== "success") {
    return null;
  }

  const city = String(office.District || "").trim();
  const state = String(office.State || "").trim();
  if (!city || !state) return null;

  return {
    pincode,
    city,
    state,
    district: city,
    areas: [...new Set(
      offices
        .map((entry) => String(entry?.Name || "").trim())
        .filter(Boolean),
    )].slice(0, 20),
    source: "postal-directory",
  };
}

function normalizeStaticFallback(payload, pincode) {
  if (!payload || typeof payload !== "object") return null;

  const city = titleCase(payload.district);
  const state = titleCase(payload.state);
  if (!city || !state) return null;

  const offices = Array.isArray(payload.offices) ? payload.offices : [];

  return {
    pincode,
    city,
    state,
    district: city,
    areas: [...new Set(
      offices
        .map((entry) => String(entry?.officeName || "").trim())
        .filter(Boolean),
    )].slice(0, 20),
    source: "postal-directory-fallback",
  };
}

export async function lookupIndiaPincode(value) {
  const pincode = String(value || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pincode)) {
    throw new Error("PIN code must contain exactly 6 digits.");
  }

  if (PIN_CACHE.has(pincode)) {
    return PIN_CACHE.get(pincode);
  }

  let providerUnavailable = false;

  try {
    const payload = await fetchJson(
      `https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`,
    );
    const result = normalizePostalPincodeResponse(payload, pincode);
    if (result) {
      PIN_CACHE.set(pincode, result);
      return result;
    }
  } catch {
    providerUnavailable = true;
  }

  try {
    const payload = await fetchJson(
      `https://aniket-thapa.github.io/india-pincode-api/pincodes/${encodeURIComponent(pincode)}.json`,
      5500,
      { notFoundIsNull: true },
    );
    const result = normalizeStaticFallback(payload, pincode);
    if (result) {
      PIN_CACHE.set(pincode, result);
      return result;
    }
  } catch {
    providerUnavailable = true;
  }

  if (providerUnavailable) {
    const unavailable = new Error(
      "PIN lookup service is temporarily unavailable. Select City and State manually.",
    );
    unavailable.code = "PIN_LOOKUP_UNAVAILABLE";
    throw unavailable;
  }

  return null;
}

export function getIndiaLocationStats() {
  return {
    states: INDIA_STATES.length,
    cities: INDIA_CITIES.length,
  };
}
