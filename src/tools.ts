/**
 * Veda Lumina MCP — tool definitions and handlers (kept separate from the stdio
 * wiring in index.ts so the shipped handlers can be tested directly).
 */

import { ENGINE_LABEL, norm360, resolveInstant, siderealPosition, siderealAscendant, lahiriAyanamsa, julianDay, WEEKDAY_LORDS } from "./astro.js";

type ToolAnnotations = { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; annotations?: ToolAnnotations };

// ==========================================
// CONSTANTS & ASTRONOMICAL TABLES
// ==========================================

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const SIGN_LORDS = [
  "Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury",
  "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"
];

const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

const NAKSHATRA_LORDS = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"
];

const DASHA_YEARS: Record<string, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7,
  Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17
};

const DASHA_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];

const YOGAS = [
  "Vishkumbha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
  "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan", "Parigha", "Shiva",
  "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"
];

const KARANAS_MOVABLE = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];

// Dignity evaluator
function evaluateDignity(planet: string, signIndex: number, _degInSign: number): string {
  const EXALTATIONS: Record<string, { sign: number, deg: number }> = {
    Sun: { sign: 0, deg: 10 },
    Moon: { sign: 1, deg: 3 },
    Mars: { sign: 9, deg: 28 },
    Mercury: { sign: 5, deg: 15 },
    Jupiter: { sign: 3, deg: 5 },
    Venus: { sign: 11, deg: 27 },
    Saturn: { sign: 6, deg: 20 },
    Rahu: { sign: 1, deg: 20 },
    Ketu: { sign: 7, deg: 20 }
  };

  const DEBILITATIONS: Record<string, { sign: number, deg: number }> = {
    Sun: { sign: 6, deg: 10 },
    Moon: { sign: 7, deg: 3 },
    Mars: { sign: 3, deg: 28 },
    Mercury: { sign: 11, deg: 15 },
    Jupiter: { sign: 9, deg: 5 },
    Venus: { sign: 5, deg: 27 },
    Saturn: { sign: 0, deg: 20 },
    Rahu: { sign: 7, deg: 20 },
    Ketu: { sign: 1, deg: 20 }
  };

  if (EXALTATIONS[planet] && EXALTATIONS[planet].sign === signIndex) return "Exalted (Uchcha)";
  if (DEBILITATIONS[planet] && DEBILITATIONS[planet].sign === signIndex) return "Debilitated (Neecha)";
  if (SIGN_LORDS[signIndex] === planet) return "Own Sign (Swakshetra)";
  return "Neutral / Friendly";
}

// Compute Vimshottari Dasha
function calculateVimshottari(moonLong: number, birthDateStr: string, targetDateStr?: string) {
  const nakIdx = Math.floor(moonLong / (360 / 27));
  const degInNak = moonLong % (360 / 27);
  const fractionElapsed = degInNak / (13 + 20 / 60);
  const birthLord = NAKSHATRA_LORDS[nakIdx];
  const birthLordYears = DASHA_YEARS[birthLord];
  const balanceYears = birthLordYears * (1 - fractionElapsed);

  const birthDate = new Date(birthDateStr);
  const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();

  const lordIdx = DASHA_ORDER.indexOf(birthLord);
  let currentDate = new Date(birthDate);

  const timeline: Array<{ lord: string, startDate: string, endDate: string, durationYears: number }> = [];

  // First partial dasha
  const endDate = new Date(currentDate);
  endDate.setFullYear(endDate.getFullYear() + Math.floor(balanceYears));
  endDate.setDate(endDate.getDate() + Math.floor((balanceYears % 1) * 365.25));

  timeline.push({
    lord: birthLord,
    startDate: currentDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    durationYears: Number(balanceYears.toFixed(2))
  });

  currentDate = new Date(endDate);

  // Subsequent dashas (covering 120 years)
  for (let i = 1; i < 9; i++) {
    const nextLord = DASHA_ORDER[(lordIdx + i) % 9];
    const duration = DASHA_YEARS[nextLord];
    const nextEnd = new Date(currentDate);
    nextEnd.setFullYear(nextEnd.getFullYear() + duration);

    timeline.push({
      lord: nextLord,
      startDate: currentDate.toISOString().slice(0, 10),
      endDate: nextEnd.toISOString().slice(0, 10),
      durationYears: duration
    });
    currentDate = new Date(nextEnd);
  }

  // Find active Mahadasha for target date
  let activeDasha = timeline[0];
  for (const d of timeline) {
    if (new Date(d.startDate) <= targetDate && targetDate <= new Date(d.endDate)) {
      activeDasha = d;
      break;
    }
  }

  // Calculate approximate Antardasha
  const mdLord = activeDasha.lord;
  const mdTotalYears = DASHA_YEARS[mdLord];
  const antardashas: Array<{ antardashaLord: string, startDate: string, endDate: string }> = [];
  const mdStartIdx = DASHA_ORDER.indexOf(mdLord);
  let adCurrentDate = new Date(activeDasha.startDate);

  for (let j = 0; j < 9; j++) {
    const adLord = DASHA_ORDER[(mdStartIdx + j) % 9];
    const adYears = (DASHA_YEARS[adLord] * mdTotalYears) / 120.0;
    const adEnd = new Date(adCurrentDate);
    adEnd.setDate(adEnd.getDate() + Math.floor(adYears * 365.25));

    antardashas.push({
      antardashaLord: adLord,
      startDate: adCurrentDate.toISOString().slice(0, 10),
      endDate: adEnd.toISOString().slice(0, 10)
    });
    adCurrentDate = new Date(adEnd);
  }

  let activeAd = antardashas[0];
  for (const ad of antardashas) {
    if (new Date(ad.startDate) <= targetDate && targetDate <= new Date(ad.endDate)) {
      activeAd = ad;
      break;
    }
  }

  return {
    system: "Vimshottari (120 Year Cycle)",
    birthNakshatra: NAKSHATRAS[nakIdx],
    balanceAtBirth: `${birthLord} balance: ${balanceYears.toFixed(2)} years`,
    currentDasha: {
      mahadasha: activeDasha.lord,
      antardasha: activeAd.antardashaLord,
      startDate: activeDasha.startDate,
      endDate: activeDasha.endDate,
      activeForDate: targetDate.toISOString().slice(0, 10)
    },
    mahadashaTimeline: timeline
  };
}

// Tool declarations.
// Every tool is a pure calculation: read-only, no network calls, nothing stored,
// and the same input always gives the same output (except "today" defaults).
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const BIRTH_DATE = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Birth date as YYYY-MM-DD in the local calendar of the birth place, e.g. '1990-03-14'." };
const BIRTH_TIME = { type: "string", pattern: "^\\d{2}:\\d{2}$", description: "Local clock time of birth, 24-hour HH:mm, e.g. '06:45'. Interpreted in `timezone` (or `utcOffsetHours`); with neither, it is read as UTC." };
const LATITUDE = { type: "number", minimum: -90, maximum: 90, description: "Latitude of the place in decimal degrees, north positive (Jaipur = 26.91)." };
const LONGITUDE = { type: "number", minimum: -180, maximum: 180, description: "Longitude of the place in decimal degrees, east positive (Jaipur = 75.79)." };
const TIMEZONE = { type: "string", description: "IANA time zone of the place, e.g. 'Asia/Kolkata' or 'America/New_York'. Strongly recommended: it handles historical offsets and daylight saving. Without it (or `utcOffsetHours`) the time is read as UTC, and the response's `timeBasis` says so." };
const UTC_OFFSET = { type: "number", minimum: -14, maximum: 14, description: "Alternative to `timezone`: a fixed UTC offset in hours, e.g. 5.5 for India. Ignored when `timezone` is given." };
const UNUSED_PLACE = " Not used by this calculation (it needs no house cusps); accepted so the same birth details can be passed to every tool.";

const TIME_NOTE = " The birth time is read in `timezone` (or `utcOffsetHours`); with neither, it is read as UTC and `timeBasis` in the response says so. Invalid dates or times return an error.";

export const TOOLS: Tool[] = [
  {
    name: "calculate_vedic_chart",
    description:
      "Casts a Vedic (sidereal, Lahiri ayanamsha) birth chart: the Ascendant (Lagna) and the 9 grahas with sign, degree, nakshatra and pada, whole-sign house, retrograde flag and basic dignity (exalted, debilitated, own sign). " +
      "Use it for questions about the chart itself, such as where a planet sits or what the Lagna is. For which planetary period is running, use calculate_dasha_periods; for the 7 Jaimini karakas, use calculate_jaimini_karakas. " +
      "Returns JSON: engine, ayanamsaValue, timeBasis, utcInstant, ascendant{sign, degreeInSign, nakshatra, pada, lord} and planets[]{name, sign, degreeInSign, totalLongitude, nakshatra, pada, nakshatraLord, house, dignity, isRetrograde}. " +
      "Positions use astronomy-engine (arc-minute class precision); Rahu and Ketu are mean nodes. Divisional charts, KP and Shadbala are not computed." + TIME_NOTE,
    inputSchema: {
      type: "object",
      properties: { birthDate: BIRTH_DATE, birthTime: BIRTH_TIME, latitude: LATITUDE, longitude: LONGITUDE, timezone: TIMEZONE, utcOffsetHours: UTC_OFFSET },
      required: ["birthDate", "birthTime", "latitude", "longitude"]
    },
    annotations: { title: "Vedic birth chart", ...READ_ONLY }
  },
  {
    name: "calculate_dasha_periods",
    description:
      "Calculates the Vimshottari dasha (120-year planetary period cycle) from the Moon's nakshatra at birth: the balance at birth, the 9 mahadashas with start and end dates, and the mahadasha and antardasha running on a chosen date. " +
      "Use it for timing questions such as which period someone is in now or when the next one starts. For the chart positions themselves, use calculate_vedic_chart. " +
      "Returns JSON: birthNakshatra, balanceAtBirth, currentDasha{mahadasha, antardasha, startDate, endDate, activeForDate} and mahadashaTimeline[]{lord, startDate, endDate, durationYears}. " +
      "Dates are approximate to about a day (365.25-day years); pratyantardashas are not computed." + TIME_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        birthDate: BIRTH_DATE, birthTime: BIRTH_TIME,
        latitude: { ...LATITUDE, description: LATITUDE.description + UNUSED_PLACE },
        longitude: { ...LONGITUDE, description: LONGITUDE.description + UNUSED_PLACE },
        timezone: TIMEZONE, utcOffsetHours: UTC_OFFSET,
        targetDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Date (YYYY-MM-DD) for which to report the running mahadasha and antardasha. Defaults to today." }
      },
      required: ["birthDate", "birthTime"]
    },
    annotations: { title: "Vimshottari dasha periods", ...READ_ONLY }
  },
  {
    name: "get_daily_panchang",
    description:
      "Returns the 5 limbs of the Panchanga (Tithi, Vara, Nakshatra, Nitya Yoga, Karana) for a date at a place, computed at local noon. " +
      "Use it for questions about a day, such as today's tithi or nakshatra, not about a person's birth chart (use calculate_vedic_chart for that). " +
      "Returns JSON: date, computedAt, timeBasis and panchanga{tithi{name, paksha, number}, vara{day, lord}, nakshatra{name, lord}, yoga{name, auspicious}, karana{name, isVishtiBhadra}}. " +
      "Values are a snapshot at noon, so a tithi or nakshatra that changes during the day shows only its noon value. Hora, Choghadiya, Rahu Kaal and other sunrise-based windows are not computed. Without `timezone` (or `utcOffsetHours`) noon is 12:00 UTC.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Calendar date as YYYY-MM-DD. Defaults to today (UTC)." },
        latitude: LATITUDE, longitude: LONGITUDE, timezone: TIMEZONE, utcOffsetHours: UTC_OFFSET
      },
      required: ["latitude", "longitude"]
    },
    annotations: { title: "Daily Panchanga", ...READ_ONLY }
  },
  {
    name: "calculate_jaimini_karakas",
    description:
      "Computes the 7 Jaimini Chara Karakas (Atmakaraka to Darakaraka) by ranking the Sun to Saturn by degree within their signs, using the 7-karaka scheme (Rahu excluded). " +
      "Use it for Jaimini questions such as who is the Atmakaraka or Darakaraka. For the full chart, use calculate_vedic_chart. " +
      "Returns JSON: atmakaraka, amatyakaraka, karakas{title: 'Planet (degree°)'} and a one-line soulLesson for the Atmakaraka. " +
      "Arudha padas, Upapada and Chara dasha are not computed. Karakas can change for births within minutes of two planets having nearly equal degrees." + TIME_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        birthDate: BIRTH_DATE, birthTime: BIRTH_TIME,
        latitude: { ...LATITUDE, description: LATITUDE.description + UNUSED_PLACE },
        longitude: { ...LONGITUDE, description: LONGITUDE.description + UNUSED_PLACE },
        timezone: TIMEZONE, utcOffsetHours: UTC_OFFSET
      },
      required: ["birthDate", "birthTime"]
    },
    annotations: { title: "Jaimini Chara Karakas", ...READ_ONLY }
  },
  {
    name: "analyze_vastu_zone",
    description:
      "Looks up Vastu Shastra reference data for one of the 8 principal directions: its name, element, ruling deity and planet, and the life areas traditionally linked to it. " +
      "Use it when someone asks what a direction of a home or office governs in Vastu. It needs no birth data and does not assess a specific floor plan. " +
      "Returns JSON: zoneCode, name, element, lord and attribute. An unknown code returns an error.",
    inputSchema: {
      type: "object",
      properties: {
        zone: {
          type: "string",
          enum: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
          description: "Direction code: N (North), NE (North-East, Ishanya), E (East), SE (South-East, Agneya), S (South), SW (South-West, Nairutya), W (West) or NW (North-West, Vayavya)."
        }
      },
      required: ["zone"]
    },
    annotations: { title: "Vastu direction reference", ...READ_ONLY }
  }
];


/** Rejects missing or out-of-range coordinates instead of casting a chart for a wrong place. */
function assertPlace(latitude: unknown, longitude: unknown): void {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude: ${String(latitude)} (expected decimal degrees from -90 to 90, north positive)`);
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude: ${String(longitude)} (expected decimal degrees from -180 to 180, east positive)`);
  }
}

export async function callTool(name: string, args: unknown): Promise<{ isError?: boolean; content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "calculate_vedic_chart": {
        const { birthDate, birthTime, latitude, longitude, timezone, utcOffsetHours } = args as any;
        assertPlace(latitude, longitude);
        const { date: instant, timeBasis } = resolveInstant(birthDate, birthTime, timezone, utcOffsetHours);
        const ayanamsaVal = lahiriAyanamsa(instant);
        const ascLong = siderealAscendant(instant, latitude, longitude);
        const ascSignIdx = Math.floor(ascLong / 30);
        const ascDegInSign = ascLong % 30;
        const ascNakIdx = Math.floor(ascLong / (360 / 27));

        const planetNames = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
        const planetsData = planetNames.map((p) => {
          const { longitude: pLong, isRetrograde } = siderealPosition(p, instant);
          const pSignIdx = Math.floor(pLong / 30);
          const pDegInSign = pLong % 30;
          const pNakIdx = Math.floor(pLong / (360 / 27));
          const pPada = Math.floor((pLong % (360 / 27)) / (360 / 108)) + 1;
          const house = ((pSignIdx - ascSignIdx + 12) % 12) + 1;
          const dignity = evaluateDignity(p, pSignIdx, pDegInSign);

          return {
            name: p,
            sign: ZODIAC_SIGNS[pSignIdx],
            signIndex: pSignIdx,
            degreeInSign: Number(pDegInSign.toFixed(2)),
            totalLongitude: pLong,
            nakshatra: NAKSHATRAS[pNakIdx],
            pada: pPada,
            nakshatraLord: NAKSHATRA_LORDS[pNakIdx],
            house,
            dignity,
            isRetrograde
          };
        });

        const result = {
          engine: ENGINE_LABEL,
          ayanamsa: "Lahiri (Chitra Paksha)",
          ayanamsaValue: Number(ayanamsaVal.toFixed(4)),
          timeBasis,
          utcInstant: instant.toISOString(),
          julianDay: Number(julianDay(instant).toFixed(4)),
          nodes: "mean node",
          ascendant: {
            sign: ZODIAC_SIGNS[ascSignIdx],
            signIndex: ascSignIdx,
            degreeInSign: Number(ascDegInSign.toFixed(2)),
            totalLongitude: Number(ascLong.toFixed(2)),
            nakshatra: NAKSHATRAS[ascNakIdx],
            pada: Math.floor((ascLong % (360 / 27)) / (360 / 108)) + 1,
            lord: SIGN_LORDS[ascSignIdx]
          },
          planets: planetsData,
          fullChartUrl: "https://www.vedalumina.com/?utm_source=mcp&utm_medium=tool&utm_campaign=calculate_vedic_chart",
          fullChartNote: "Enter the same birth details at vedalumina.com for divisional charts, KP, Shadbala and Swiss Ephemeris positions."
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case "calculate_dasha_periods": {
        const { birthDate, birthTime, latitude: _lat, longitude: _lng, targetDate, timezone, utcOffsetHours } = args as any;
        const { date: instant, timeBasis } = resolveInstant(birthDate, birthTime, timezone, utcOffsetHours);
        const { longitude: moonLong } = siderealPosition("Moon", instant);

        if (targetDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate))) {
          throw new Error(`Invalid targetDate: ${String(targetDate)} (expected YYYY-MM-DD)`);
        }
        const dashaData = { ...calculateVimshottari(moonLong, birthDate, targetDate), engine: ENGINE_LABEL, timeBasis };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(dashaData, null, 2)
            }
          ]
        };
      }

      case "get_daily_panchang": {
        const { date = new Date().toISOString().slice(0, 10), latitude, longitude, timezone, utcOffsetHours } = args as any;
        assertPlace(latitude, longitude);
        // Local noon when a zone is given; otherwise 12:00 UTC (reported in timeBasis).
        const { date: instant, timeBasis } = resolveInstant(date, "12:00", timezone, utcOffsetHours);
        const { longitude: sunLong } = siderealPosition("Sun", instant);
        const { longitude: moonLong } = siderealPosition("Moon", instant);

        // Tithi
        const diff = norm360(moonLong - sunLong);
        const tithiNum = Math.floor(diff / 12) + 1;
        const paksha = tithiNum <= 15 ? "Shukla (Waxing)" : "Krishna (Waning)";
        const tithiName = tithiNum <= 15 ? `Shukla ${tithiNum}` : `Krishna ${tithiNum - 15}`;

        // Nakshatra
        const nakIdx = Math.floor(moonLong / (360 / 27));

        // Yoga
        const yogaIdx = Math.floor(norm360(sunLong + moonLong) / (360 / 27));

        // Karana: the first half of Shukla Pratipada is the fixed Kimstughna,
        // then 56 movable karanas, then Shakuni, Chatushpada, Naga.
        const karanaIdx = Math.floor(diff / 6);
        const karanaName = karanaIdx === 0
          ? "Kimstughna"
          : karanaIdx <= 56 ? KARANAS_MOVABLE[(karanaIdx - 1) % 7] : ["Shakuni", "Chatushpada", "Naga"][karanaIdx - 57];

        // Weekday of the civil date (Vedic vara technically runs sunrise to sunrise).
        const [yy, mm, dd] = String(date).split("-").map(Number);
        const weekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
        const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday];

        const panchangResult = {
          date,
          location: { latitude, longitude },
          engine: ENGINE_LABEL,
          computedAt: instant.toISOString(),
          timeBasis,
          panchanga: {
            tithi: { name: tithiName, paksha, number: tithiNum },
            vara: { day: dayOfWeek, lord: WEEKDAY_LORDS[weekday] },
            nakshatra: { name: NAKSHATRAS[nakIdx], lord: NAKSHATRA_LORDS[nakIdx] },
            yoga: { name: YOGAS[yogaIdx], auspicious: !["Vyatipata", "Vaidhriti", "Atiganda", "Shula"].includes(YOGAS[yogaIdx]) },
            karana: { name: karanaName, isVishtiBhadra: karanaName === "Vishti" }
          },
          notComputed: "Hora, Choghadiya, Brahma/Abhijit Muhurta, Rahu Kaal and Yamaghanta depend on local sunrise and are not computed by this server. Use https://www.vedalumina.com for them."
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(panchangResult, null, 2)
            }
          ]
        };
      }

      case "calculate_jaimini_karakas": {
        const { birthDate, birthTime, latitude: _lat, longitude: _lng, timezone, utcOffsetHours } = args as any;
        const { date: instant } = resolveInstant(birthDate, birthTime, timezone, utcOffsetHours);

        const planets = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"].map((p) => {
          const { longitude: pLong } = siderealPosition(p, instant);
          return { name: p, degreeInSign: pLong % 30, totalLong: pLong };
        });

        // Sort descending by degree within sign
        planets.sort((a, b) => b.degreeInSign - a.degreeInSign);

        const karakaTitles = [
          "Atmakaraka (AK - Soul Purpose)",
          "Amatyakaraka (AmK - Career & Intellect)",
          "Bhratrikaraka (BK - Siblings & Guru)",
          "Matrikaraka (MK - Mother & Sanctuary)",
          "Putrakaraka (PK - Progeny & Creativity)",
          "Gnatikaraka (GK - Obstacles & Competitors)",
          "Darakaraka (DK - Spouse & Partnerships)"
        ];

        const karakaMapping: Record<string, string> = {};
        planets.forEach((p, idx) => {
          karakaMapping[karakaTitles[idx]] = `${p.name} (${p.degreeInSign.toFixed(2)}°)`;
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                system: "Jaimini Upadesha Sutras (7-Karaka Scheme)",
                atmakaraka: planets[0].name,
                amatyakaraka: planets[1].name,
                karakas: karakaMapping,
                soulLesson: `With ${planets[0].name} as Atmakaraka, the soul's karmic evolution in this lifetime centers on mastering ${planets[0].name === "Sun" ? "humility and true leadership" : planets[0].name === "Moon" ? "emotional detachment and unconditional compassion" : planets[0].name === "Mars" ? "righteous courage without aggression" : planets[0].name === "Mercury" ? "truthful communication and wisdom" : planets[0].name === "Jupiter" ? "spiritual teaching and ethical integrity" : planets[0].name === "Venus" ? "sublimation of desires into higher love" : "discipline, patience, and serving the vulnerable"}.`
              }, null, 2)
            }
          ]
        };
      }

      case "analyze_vastu_zone": {
        const { zone } = args as any;
        const VASTU_DATA: Record<string, any> = {
          N: { name: "North", element: "Water", lord: "Kubera / Mercury", attribute: "Opportunities, Money Inflow, New Horizons" },
          NE: { name: "North-East (Ishanya)", element: "Water", lord: "Shiva / Jupiter", attribute: "Clarity of Mind, Spiritual Connection, Wisdom" },
          E: { name: "East", element: "Air", lord: "Indra / Sun", attribute: "Social Connectivity, Leadership, Government Networking" },
          SE: { name: "South-East (Agneya)", element: "Fire", lord: "Agni / Venus", attribute: "Cash Liquidity, Passion, Vitality" },
          S: { name: "South", element: "Fire", lord: "Yama / Mars", attribute: "Fame, Recognition, Relaxation" },
          SW: { name: "South-West (Nairutya)", element: "Earth", lord: "Nirriti / Rahu", attribute: "Relationships, Skill Mastery, Family Stability" },
          W: { name: "West", element: "Space", lord: "Varuna / Saturn", attribute: "Gains, Commercial Profits, Fruition of Efforts" },
          NW: { name: "North-West (Vayavya)", element: "Air/Space", lord: "Vayu / Moon", attribute: "Support Systems, Banking Assistance, Allies" }
        };

        const info = VASTU_DATA[zone];
        if (!info) throw new Error(`Unknown Vastu direction '${zone}'. Use one of N, NE, E, SE, S, SW, W, NW.`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                system: "Vastu Shastra, 8 principal directions",
                zoneCode: zone,
                ...info
              }, null, 2)
            }
          ]
        };
      }

      case "calculate_muhurta_score":
      case "get_pancha_pakshi_state":
        // These returned fixed placeholder results (a constant score of 84,
        // a permanently "Ruling" bird) presented as calculations (F-150).
        throw new Error(`${name} is not available in the MCP server. Use https://www.vedalumina.com for muhurta and Pancha Pakshi timing.`);

      default:
        throw new Error(`Unknown tool requested: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message || String(error)}`
        }
      ]
    };
  }
}
