/**
 * The business categories offered on the discovery map.
 *
 * Each category is a bundle of OpenStreetMap tag filters. OSM has no single
 * "business type" field — it has hundreds of loosely-related `shop`, `amenity`,
 * `office`, `craft`, `healthcare`, `tourism`, and `leisure` values. Presenting
 * those raw would be unusable, so they are grouped here into the verticals a
 * software studio actually sells to.
 *
 * Deliberately pure and free of any provider client, so the catalogue can be
 * unit-tested and shared by the query builder, the normaliser, and the UI chips
 * without pulling in a network layer.
 *
 * Attribution: OSM data is ODbL. Anything derived from it and shown to a user
 * must carry the credit in `OSM_ATTRIBUTION` — one string, so no surface can
 * quietly omit it.
 */

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

/**
 * One OSM tag test. An empty `values` array means "this key exists with any
 * value", which is how broad families such as `craft=*` are expressed.
 */
export interface OsmTagFilter {
  key: string;
  values: string[];
}

export interface ProspectCategory {
  /** Stable slug. Persisted on searches and prospects, so never renamed. */
  id: string;
  label: string;
  /** One line shown under the chip; explains the commercial angle. */
  description: string;
  filters: OsmTagFilter[];
}

/**
 * The catalogue, ordered by how well each vertical converts for a web studio:
 * businesses that lose money directly when their site is bad — restaurants
 * taking orders, clinics taking appointments, hotels taking bookings — first.
 */
export const PROSPECT_CATEGORIES: ProspectCategory[] = [
  {
    id: "food-drink",
    label: "Food & drink",
    description:
      "Restaurants, cafés, bakeries and bars — online ordering and reservations.",
    filters: [
      {
        key: "amenity",
        values: [
          "restaurant",
          "cafe",
          "fast_food",
          "bar",
          "pub",
          "ice_cream",
          "food_court",
          "biergarten",
        ],
      },
      {
        key: "shop",
        values: [
          "bakery",
          "confectionery",
          "coffee",
          "deli",
          "butcher",
          "greengrocer",
          "cheese",
          "chocolate",
          "pastry",
          "tea",
        ],
      },
    ],
  },
  {
    id: "health",
    label: "Health & medical",
    description:
      "Clinics, dentists, pharmacies and vets — appointment booking and patient forms.",
    filters: [
      {
        key: "amenity",
        values: [
          "doctors",
          "dentist",
          "clinic",
          "pharmacy",
          "veterinary",
          "hospital",
        ],
      },
      {
        key: "healthcare",
        values: [
          "doctor",
          "dentist",
          "clinic",
          "physiotherapist",
          "optometrist",
          "psychotherapist",
          "alternative",
          "laboratory",
          "midwife",
          "podiatrist",
          "speech_therapist",
          "nutrition_counselling",
        ],
      },
      { key: "shop", values: ["optician", "hearing_aids", "medical_supply"] },
    ],
  },
  {
    id: "beauty-wellness",
    label: "Beauty & wellness",
    description:
      "Salons, spas and studios — bookings, memberships and class schedules.",
    filters: [
      {
        key: "shop",
        values: [
          "hairdresser",
          "beauty",
          "massage",
          "nail_salon",
          "tattoo",
          "cosmetics",
          "herbalist",
        ],
      },
      { key: "leisure", values: ["spa", "sauna"] },
      { key: "amenity", values: ["spa"] },
    ],
  },
  {
    id: "fitness",
    label: "Fitness & sport",
    description:
      "Gyms, studios and sports centres — memberships, timetables and sign-ups.",
    filters: [
      {
        key: "leisure",
        values: [
          "fitness_centre",
          "sports_centre",
          "dance",
          "sports_hall",
          "swimming_pool",
          "horse_riding",
          "golf_course",
          "pitch",
        ],
      },
      { key: "shop", values: ["sports", "bicycle", "fitness"] },
    ],
  },
  {
    id: "professional-services",
    label: "Professional services",
    description:
      "Lawyers, accountants, agencies and consultancies — the highest-budget vertical.",
    filters: [
      {
        key: "office",
        values: [
          "lawyer",
          "accountant",
          "estate_agent",
          "insurance",
          "financial",
          "financial_advisor",
          "consulting",
          "company",
          "architect",
          "it",
          "advertising_agency",
          "employment_agency",
          "engineer",
          "surveyor",
          "tax_advisor",
          "notary",
          "logistics",
          "moving_company",
          "property_management",
          "travel_agent",
        ],
      },
    ],
  },
  {
    id: "retail",
    label: "Retail & shops",
    description: "Independent retailers — e-commerce and click-and-collect.",
    filters: [
      {
        key: "shop",
        values: [
          "clothes",
          "shoes",
          "jewelry",
          "furniture",
          "electronics",
          "mobile_phone",
          "computer",
          "hardware",
          "doityourself",
          "florist",
          "gift",
          "books",
          "toys",
          "pet",
          "boutique",
          "interior_decoration",
          "kitchen",
          "lighting",
          "bag",
          "watches",
          "musical_instrument",
          "art",
          "photo",
          "stationery",
          "fabric",
          "garden_centre",
          "houseware",
          "second_hand",
          "supermarket",
          "convenience",
          "department_store",
        ],
      },
    ],
  },
  {
    id: "hospitality",
    label: "Hotels & stays",
    description:
      "Hotels, guest houses and rentals — direct booking beats the OTA commission.",
    filters: [
      {
        key: "tourism",
        values: [
          "hotel",
          "guest_house",
          "hostel",
          "motel",
          "apartment",
          "chalet",
          "resort",
          "camp_site",
          "bed_and_breakfast",
        ],
      },
    ],
  },
  {
    id: "trades",
    label: "Trades & contractors",
    description:
      "Builders, electricians, plumbers and fitters — quote requests and job enquiries.",
    filters: [
      { key: "craft", values: [] },
      {
        key: "shop",
        values: ["trade", "building_materials", "electrical", "plumber"],
      },
    ],
  },
  {
    id: "automotive",
    label: "Automotive",
    description:
      "Dealers, garages and workshops — service booking and stock listings.",
    filters: [
      {
        key: "shop",
        values: [
          "car",
          "car_repair",
          "car_parts",
          "motorcycle",
          "motorcycle_repair",
          "tyres",
          "truck",
          "caravan",
        ],
      },
      { key: "amenity", values: ["car_wash", "car_rental", "driving_school"] },
    ],
  },
  {
    id: "education",
    label: "Education & training",
    description:
      "Schools, coaching centres and academies — enrolment and course catalogues.",
    filters: [
      {
        key: "amenity",
        values: [
          "school",
          "college",
          "university",
          "language_school",
          "music_school",
          "kindergarten",
          "childcare",
          "training",
          "prep_school",
        ],
      },
    ],
  },
  {
    id: "events",
    label: "Events & venues",
    description:
      "Venues, planners and photographers — enquiry funnels and galleries.",
    filters: [
      { key: "amenity", values: ["events_venue", "conference_centre"] },
      { key: "shop", values: ["wedding", "party", "photo_studio"] },
      { key: "craft", values: ["photographer", "caterer"] },
      { key: "office", values: ["event_management"] },
    ],
  },
  {
    id: "real-estate",
    label: "Real estate",
    description:
      "Agents and developers — listing portals and lead capture at scale.",
    filters: [
      { key: "office", values: ["estate_agent", "property_management"] },
      { key: "shop", values: ["estate_agent"] },
    ],
  },
];

/** Every category id, for validation. */
export const PROSPECT_CATEGORY_IDS: string[] = PROSPECT_CATEGORIES.map(
  (category) => category.id,
);

export function getProspectCategory(id: string): ProspectCategory | undefined {
  return PROSPECT_CATEGORIES.find((category) => category.id === id);
}

/**
 * Keeps only ids that exist in the catalogue, de-duplicated and in catalogue
 * order. Input comes from a URL or a form, so it is untrusted: an unknown id is
 * dropped rather than passed through to the query builder.
 */
export function normalizeCategoryIds(input: readonly string[]): string[] {
  const requested = new Set(input);
  return PROSPECT_CATEGORY_IDS.filter((id) => requested.has(id));
}

/**
 * A readable label for one business, derived from its raw OSM tags.
 *
 * Prefers the value of whichever catalogue key the element carries, turning
 * `fast_food` into `Fast food`. Falls back to null so callers can decide
 * whether to show "Uncategorised" or nothing at all.
 */
export function describeOsmTags(tags: Record<string, string>): {
  categoryId: string | null;
  categoryLabel: string | null;
  rawCategory: string | null;
} {
  for (const category of PROSPECT_CATEGORIES) {
    for (const filter of category.filters) {
      const value = tags[filter.key];
      if (!value) continue;
      const matches =
        filter.values.length === 0 || filter.values.includes(value);
      if (!matches) continue;
      return {
        categoryId: category.id,
        categoryLabel: humanizeTagValue(value),
        rawCategory: `${filter.key}=${value}`,
      };
    }
  }

  // Not in the catalogue, but still a named business — keep the raw tag so the
  // operator can see what it is rather than a blank cell.
  for (const key of ["shop", "amenity", "office", "craft", "healthcare"]) {
    const value = tags[key];
    if (value) {
      return {
        categoryId: null,
        categoryLabel: humanizeTagValue(value),
        rawCategory: `${key}=${value}`,
      };
    }
  }

  return { categoryId: null, categoryLabel: null, rawCategory: null };
}

/** `fast_food` → `Fast food`; `car_repair` → `Car repair`. */
export function humanizeTagValue(value: string): string {
  const cleaned = value.replace(/[_;]+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
