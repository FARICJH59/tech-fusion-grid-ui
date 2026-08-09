export type ShelfObservation = {
  productName: string;
  brand?: string;
  barcode?: string;
  category?: string;
  confidence: number;
};

export type ShelfLocation = {
  retailer: string;
  storeId: string;
  storeName: string;
  aisle: string;
  section?: string;
  bay?: string;
  confidence: number;
  source: "catalog" | "demo" | "vision-only";
};

export type ShelfScanResult = {
  tenantId: string;
  observation: ShelfObservation;
  location?: ShelfLocation;
  guidance: string[];
  mode: "vision+catalog" | "vision-only" | "demo";
  requestId: string;
};
