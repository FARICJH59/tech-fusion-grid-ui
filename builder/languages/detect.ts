import { BUILD_CAPABILITIES } from "./catalog";
import type { DetectedBuildCapability } from "./types";

export function detectBuildCapabilities(files: string[]): DetectedBuildCapability[] {
  const normalized = files.map((file) => file.replaceAll("\\", "/"));

  return BUILD_CAPABILITIES.map((capability) => {
    const detectedBy = normalized.filter((file) =>
      capability.markers.some((marker) => marker.startsWith(".")
        ? file.endsWith(marker)
        : file === marker || file.includes(`/${marker}`)),
    );

    const confidence: DetectedBuildCapability["confidence"] =
      detectedBy.length >= 2 ? "high" : detectedBy.length === 1 ? "medium" : "low";

    return {
      ...capability,
      detected_by: detectedBy,
      confidence,
    };
  }).filter((capability) => capability.detected_by.length > 0);
}
