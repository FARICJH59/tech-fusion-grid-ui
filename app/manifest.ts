import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HOARE Shelf Scouter",
    short_name: "Shelf Scouter",
    description: "HOARE-powered shelf and product intelligence for retail clients.",
    start_url: "/shelf-scouter",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0b1020",
    background_color: "#0b1020",
  };
}
