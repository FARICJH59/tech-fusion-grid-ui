import { describe, expect, it } from "vitest";
import { validateStoreCameraEvent, type StoreCameraEvent, type StoreCameraSource } from "./store-camera";

const source: StoreCameraSource = {
  sourceId: "camera-1",
  tenantId: "tenant-1",
  retailer: "demo-retailer",
  storeId: "store-1",
  zoneId: "aisle-7",
  authorized: true,
};

const event: StoreCameraEvent = {
  eventId: "event-1",
  sourceId: "camera-1",
  tenantId: "tenant-1",
  retailer: "demo-retailer",
  storeId: "store-1",
  zoneId: "aisle-7",
  type: "LAYOUT_CHANGE_DETECTED",
  confidence: 0.94,
  occurredAt: new Date().toISOString(),
};

describe("store camera event validation", () => {
  it("accepts an authorized event with matching tenant/store/zone", () => {
    expect(validateStoreCameraEvent(source, event)).toEqual({ valid: true });
  });

  it("rejects unauthorized camera sources", () => {
    expect(validateStoreCameraEvent({ ...source, authorized: false }, event)).toEqual({
      valid: false,
      reason: "CAMERA_SOURCE_NOT_AUTHORIZED",
    });
  });

  it("rejects tenant mismatches", () => {
    expect(validateStoreCameraEvent(source, { ...event, tenantId: "tenant-2" })).toEqual({
      valid: false,
      reason: "TENANT_MISMATCH",
    });
  });

  it("rejects invalid confidence values", () => {
    expect(validateStoreCameraEvent(source, { ...event, confidence: 1.2 })).toEqual({
      valid: false,
      reason: "INVALID_CONFIDENCE",
    });
  });
});
