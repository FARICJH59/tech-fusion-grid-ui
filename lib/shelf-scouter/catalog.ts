import type { ShelfLocation, ShelfObservation } from "@/lib/shelf-scouter/types";

export type RetailerCatalog = {
  name: string;
  findLocation: (observation: ShelfObservation, storeId: string) => Promise<ShelfLocation | undefined>;
};

const DEMO_ITEMS = [
  {
    match: ["coca-cola", "coke"],
    productName: "Coca-Cola 12 oz cans, 12 pack",
    aisle: "B12",
    section: "Soft Drinks",
    bay: "3",
  },
  {
    match: ["oreo"],
    productName: "OREO Original Sandwich Cookies",
    aisle: "A7",
    section: "Cookies",
    bay: "2",
  },
  {
    match: ["crest"],
    productName: "Crest 3D White Toothpaste",
    aisle: "H4",
    section: "Oral Care",
    bay: "1",
  },
  {
    match: ["tide"],
    productName: "Tide Laundry Detergent",
    aisle: "F9",
    section: "Laundry",
    bay: "4",
  },
];

export const demoRetailerCatalog: RetailerCatalog = {
  name: "Demo Store Layout",
  async findLocation(observation, storeId) {
    const haystack = `${observation.productName} ${observation.brand ?? ""}`.toLowerCase();
    const item = DEMO_ITEMS.find((candidate) => candidate.match.some((term) => haystack.includes(term)));
    if (!item) return undefined;

    return {
      retailer: "Demo Retailer",
      storeId,
      storeName: "Phone Test Store",
      aisle: item.aisle,
      section: item.section,
      bay: item.bay,
      confidence: 0.82,
      source: "demo",
    };
  },
};

export async function findCatalogLocation(
  observation: ShelfObservation,
  storeId: string,
): Promise<ShelfLocation | undefined> {
  // This boundary is intentionally provider-neutral. A licensed retailer API,
  // approved partner feed, or tenant-owned catalog can replace this adapter
  // without changing the Shelf Scouter UI or agent contract.
  return demoRetailerCatalog.findLocation(observation, storeId);
}
