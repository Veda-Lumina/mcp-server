/**
 * Astronomy core for the Veda Lumina MCP server.
 *
 * Replaces the original mean-motion formulas, which used heliocentric MEAN
 * longitudes as if they were geocentric positions (Venus up to ~60° off, Mars
 * ~27°, Moon ~6°), added a spurious +90° to the ascendant, and read every birth
 * time as UTC (F-150). Positions now come from astronomy-engine (VSOP87 / ELP;
 * arc-minute class), the same library the web app uses.
 */

import * as AstronomyModule from "astronomy-engine";

// The web app's copy of astronomy-engine ships types without `Body` /
// `SiderealTime` (src/shared/utils/fast_ascendant.ts casts the same way), and
// the root typecheck includes this file via its tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Astronomy: any = AstronomyModule;

export const ENGINE_LABEL = "astronomy-engine (VSOP87/ELP), Lahiri ayanamsa — arc-minute class precision";

export function norm360(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Offset (minutes, local − UTC) of an IANA zone at a given UTC instant.
 */
function zoneOffsetMinutes(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - utcMs) / 60000);
}

export interface ResolvedInstant {
  date: Date;
  /** How the wall-clock time was interpreted — always reported to the caller. */
  timeBasis: string;
}

/**
 * Convert a local wall-clock date/time to a UTC instant.
 * `timezone` (IANA, e.g. "Asia/Kolkata") wins; else `utcOffsetHours`; else the
 * time is taken as UTC and the result says so.
 */
export function resolveInstant(
  dateStr: string,
  timeStr: string,
  timezone?: string,
  utcOffsetHours?: number,
): ResolvedInstant {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi = 0, s = 0] = timeStr.split(":").map(Number);
  if ([y, mo, d, h, mi, s].some((n) => !Number.isFinite(n))) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  if (timezone) {
    // Two passes settle the offset across DST transitions.
    let utc = wall - zoneOffsetMinutes(timezone, wall) * 60000;
    utc = wall - zoneOffsetMinutes(timezone, utc) * 60000;
    return { date: new Date(utc), timeBasis: `local time in ${timezone}` };
  }
  if (utcOffsetHours !== undefined && utcOffsetHours !== null) {
    return { date: new Date(wall - utcOffsetHours * 3600000), timeBasis: `local time at UTC${utcOffsetHours >= 0 ? "+" : ""}${utcOffsetHours}` };
  }
  return { date: new Date(wall), timeBasis: "UTC (no timezone or utcOffsetHours given)" };
}

export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** Lahiri (Chitra Paksha) ayanamsa, linear model: 23.857° at J2000, 50.29″/year. */
export function lahiriAyanamsa(date: Date): number {
  const years = (julianDay(date) - 2451545.0) / 365.25;
  return 23.857 + (50.29 / 3600) * years;
}

// astronomy-engine's Body enum values are the planet names themselves.
const BODIES: Record<string, string> = {
  Sun: "Sun", Moon: "Moon", Mars: "Mars", Mercury: "Mercury",
  Jupiter: "Jupiter", Venus: "Venus", Saturn: "Saturn",
};

function tropicalLongitude(body: string, date: Date): number {
  const t = Astronomy.MakeTime(date);
  return Astronomy.Ecliptic(Astronomy.GeoVector(body, t, true)).elon;
}

/** Mean lunar node (tropical), Meeus 47.7. */
function meanNodeTropical(date: Date): number {
  const T = (julianDay(date) - 2451545.0) / 36525;
  return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T);
}

export function siderealPosition(planet: string, date: Date): { longitude: number; isRetrograde: boolean } {
  const ayanamsa = lahiriAyanamsa(date);
  if (planet === "Rahu" || planet === "Ketu") {
    const node = meanNodeTropical(date) + (planet === "Ketu" ? 180 : 0);
    return { longitude: Number(norm360(node - ayanamsa).toFixed(4)), isRetrograde: true };
  }
  const body = BODIES[planet];
  if (!body) throw new Error(`Unknown planet: ${planet}`);
  const lon = tropicalLongitude(body, date);
  let isRetrograde = false;
  if (planet !== "Sun" && planet !== "Moon") {
    const before = tropicalLongitude(body, new Date(date.getTime() - 43200000));
    const after = tropicalLongitude(body, new Date(date.getTime() + 43200000));
    const motion = ((after - before + 540) % 360) - 180;
    isRetrograde = motion < 0;
  }
  return { longitude: Number(norm360(lon - ayanamsa).toFixed(4)), isRetrograde };
}

/** Sidereal ascendant; same formula as the web app (src/shared/utils/fast_ascendant.ts). */
export function siderealAscendant(date: Date, lat: number, lng: number): number {
  const t = Astronomy.MakeTime(date);
  const ramc = norm360(Astronomy.SiderealTime(t) * 15 + lng);
  const T = (julianDay(date) - 2451545.0) / 36525;
  const eps = 23.4392911 - 0.0130042 * T;
  const r = Math.PI / 180;
  const asc = Math.atan2(
    Math.cos(ramc * r),
    -(Math.sin(ramc * r) * Math.cos(eps * r) + Math.tan(lat * r) * Math.sin(eps * r)),
  ) / r;
  return norm360(asc - lahiriAyanamsa(date));
}

/** Weekday lords, Sunday = 0. */
export const WEEKDAY_LORDS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
