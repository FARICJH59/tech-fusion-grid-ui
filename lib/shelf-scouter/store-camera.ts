export type StoreCameraEventType =
  | "SHELF_STATE_CHANGED"
  | "LAYOUT_CHANGE_DETECTED"
  | "RESTOCK_ACTIVITY"
  | "DISPLAY_CHANGE";

export type StoreCameraSource = {
  sourceId: string;
  tenantId: string;
  retailer: string;
  storeId: string;
  zoneId: string;
  authorized: boolean;
};

export type StoreCameraEvent = {
  eventId: string;
  sourceId: string;
  tenantId: string;
  retailer: string;
  storeId: string;
  zoneId: string;
  type: StoreCameraEventType;
  confidence: number;
  occurredAt: string;
  evidenceRef?: string;
};

export function validateStoreCameraEvent(
  source: StoreCameraSource,
  event: StoreCameraEvent,
): { valid: boolean; reason?: string } {
  if (!source.authorized) return { valid: false, reason: "CAMERA_SOURCE_NOT_AUTHORIZED" };
  if (source.tenantId !== event.tenantId) return { valid: false, reason: "TENANT_MISMATCH" };
  if (source.sourceId !== event.sourceId) return { valid: false, reason: "SOURCE_MISMATCH" };
  if (source.storeId !== event.storeId || source.zoneId !== event.zoneId) {
    return { valid: false, reason: "STORE_ZONE_MISMATCH" };
  }
  if (event.confidence < 0 || event.confidence > 1) {
    return { valid: false, reason: "INVALID_CONFIDENCE" };
  }
  return { valid: true };
}
