export type WebSearchRequest = {
  tenant_id: string;
  project_id: string;
  query: string;
  location?: string;
  engine?: string;
};

export type WebSearchResult = {
  provider: "serpapi";
  query: string;
  location?: string;
  engine: string;
  data: unknown;
  provenance_hash: string;
};

export type SearchCapability = {
  capability_id: "search.web";
  provider: "serpapi";
  secret_ref: string;
  execution_class: "external_io";
};
