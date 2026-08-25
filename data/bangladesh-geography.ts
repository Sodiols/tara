/**
 * Bangladesh administrative geography — the single source of truth.
 *
 * TARA ships to divisions and districts only. Upazilas, thanas, unions and
 * neighbourhood names are deliberately absent: the courier needs the free-text
 * street address for that level of detail, and asking for a fifth dropdown only
 * created lists that drifted out of date.
 *
 * All 8 divisions and all 64 districts are listed, with each district under the
 * division it actually belongs to. Nothing here is an upazila masquerading as a
 * district — the previous list carried Zakiganj, Golapganj, Beanibazar and
 * Sylhet Sadar, which are upazilas of Sylhet district, and omitted 40 real ones.
 *
 * The same data is mirrored into `public.bd_divisions` / `public.bd_districts`
 * by supabase/migrations/0009_catalogue_geography_and_delivery.sql, and `place_order()`
 * re-validates every submitted pair against those tables. This module is what
 * the browser and the server actions use; the database is the authority.
 *
 * Names are the standard English spellings used by the Bangladesh Bureau of
 * Statistics. They are place names, not translated interface text.
 */

export const DIVISIONS = [
  "Barishal",
  "Chattogram",
  "Dhaka",
  "Khulna",
  "Mymensingh",
  "Rajshahi",
  "Rangpur",
  "Sylhet",
] as const;

export type Division = (typeof DIVISIONS)[number];

export const DISTRICTS_BY_DIVISION: Readonly<Record<Division, readonly string[]>> = {
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Chattogram: [
    "Bandarban",
    "Brahmanbaria",
    "Chandpur",
    "Chattogram",
    "Cox's Bazar",
    "Cumilla",
    "Feni",
    "Khagrachhari",
    "Lakshmipur",
    "Noakhali",
    "Rangamati",
  ],
  Dhaka: [
    "Dhaka",
    "Faridpur",
    "Gazipur",
    "Gopalganj",
    "Kishoreganj",
    "Madaripur",
    "Manikganj",
    "Munshiganj",
    "Narayanganj",
    "Narsingdi",
    "Rajbari",
    "Shariatpur",
    "Tangail",
  ],
  Khulna: [
    "Bagerhat",
    "Chuadanga",
    "Jashore",
    "Jhenaidah",
    "Khulna",
    "Kushtia",
    "Magura",
    "Meherpur",
    "Narail",
    "Satkhira",
  ],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  Rajshahi: [
    "Bogura",
    "Chapai Nawabganj",
    "Joypurhat",
    "Naogaon",
    "Natore",
    "Pabna",
    "Rajshahi",
    "Sirajganj",
  ],
  Rangpur: [
    "Dinajpur",
    "Gaibandha",
    "Kurigram",
    "Lalmonirhat",
    "Nilphamari",
    "Panchagarh",
    "Rangpur",
    "Thakurgaon",
  ],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
};

/** Every district in the country, sorted, for lookups that ignore division. */
export const ALL_DISTRICTS: readonly string[] = Object.values(DISTRICTS_BY_DIVISION)
  .flat()
  .sort((a, b) => a.localeCompare(b, "en"));

/**
 * Case- and spacing-insensitive matching.
 *
 * A saved address written years ago, or a value typed with an odd capital,
 * should still resolve to the canonical spelling rather than be rejected.
 */
function normalise(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

const DIVISION_BY_KEY = new Map<string, Division>(
  DIVISIONS.map((division) => [normalise(division), division]),
);

/**
 * Divisions renamed in 2018 (and the transliterations still in circulation).
 * Accepting them keeps historic addresses and bookmarked links working without
 * offering the outdated spelling anywhere in the interface.
 */
const DIVISION_ALIASES: Record<string, Division> = {
  barisal: "Barishal",
  chittagong: "Chattogram",
  comilla: "Chattogram",
  rajshai: "Rajshahi",
};

const DISTRICT_KEYS_BY_DIVISION = new Map<Division, Set<string>>(
  DIVISIONS.map((division) => [
    division,
    new Set(DISTRICTS_BY_DIVISION[division].map(normalise)),
  ]),
);

const DISTRICT_ALIASES: Record<string, string> = {
  jessore: "Jashore",
  bogra: "Bogura",
  comilla: "Cumilla",
  chittagong: "Chattogram",
  barisal: "Barishal",
  "chapainawabganj": "Chapai Nawabganj",
  "nawabganj": "Chapai Nawabganj",
  "coxs bazar": "Cox's Bazar",
  "cox bazar": "Cox's Bazar",
  khagrachari: "Khagrachhari",
  "brahmanbaria": "Brahmanbaria",
  maulvibazar: "Moulvibazar",
  moulavibazar: "Moulvibazar",
};

/** The canonical division name, or null when the value is not a division. */
export function resolveDivision(value: unknown): Division | null {
  const key = normalise(value);
  if (!key) return null;
  return DIVISION_BY_KEY.get(key) ?? DIVISION_ALIASES[key] ?? null;
}

/**
 * The canonical district name for a division, or null when the district does
 * not exist or does not belong to that division.
 *
 * Both halves matter: "Sylhet / Dhaka" must fail even though each name is real
 * on its own, because a courier zone is chosen from the pair.
 */
export function resolveDistrict(division: unknown, value: unknown): string | null {
  const resolvedDivision = resolveDivision(division);
  if (!resolvedDivision) return null;

  const key = normalise(value);
  if (!key) return null;

  const candidate = DISTRICT_ALIASES[key] ?? null;
  const canonicalKey = candidate ? normalise(candidate) : key;

  if (!DISTRICT_KEYS_BY_DIVISION.get(resolvedDivision)?.has(canonicalKey)) return null;

  return (
    DISTRICTS_BY_DIVISION[resolvedDivision].find(
      (district) => normalise(district) === canonicalKey,
    ) ?? null
  );
}

export interface ResolvedLocation {
  division: Division;
  district: string;
}

/**
 * Validates a division/district pair and returns it in canonical spelling.
 *
 * This is the function both the browser form and the server action use, so the
 * two can never disagree about what counts as a deliverable address.
 */
export function resolveLocation(
  division: unknown,
  district: unknown,
): ResolvedLocation | null {
  const resolvedDivision = resolveDivision(division);
  if (!resolvedDivision) return null;
  const resolvedDistrict = resolveDistrict(resolvedDivision, district);
  if (!resolvedDistrict) return null;
  return { division: resolvedDivision, district: resolvedDistrict };
}

export function districtsForDivision(division: unknown): readonly string[] {
  const resolved = resolveDivision(division);
  return resolved ? DISTRICTS_BY_DIVISION[resolved] : [];
}
