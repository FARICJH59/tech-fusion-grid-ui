"use client";

import { useState } from "react";
import type { ShelfScanResult } from "@/lib/shelf-scouter/types";

export default function ShelfScouterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [storeId, setStoreId] = useState("demo-store");
  const [result, setResult] = useState<ShelfScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function scan() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("storeId", storeId);
      const response = await fetch("/api/shelf-scouter/analyze", {
        method: "POST",
        headers: { "x-tenant-id": "local-demo" },
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "SCAN_FAILED");
      setResult(data as ShelfScanResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SCAN_FAILED");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>HOARE Shelf Scouter</h1>
      <p>Point your phone at a product or shelf label. The MVP identifies the item and resolves a store-layout location through a provider-neutral catalog adapter.</p>

      <label style={{ display: "block", margin: "20px 0" }}>
        Store ID
        <input
          value={storeId}
          onChange={(event) => setStoreId(event.target.value)}
          style={{ display: "block", width: "100%", padding: 12, marginTop: 8 }}
        />
      </label>

      <label style={{ display: "block", padding: 20, border: "1px solid #ccc", borderRadius: 12, textAlign: "center" }}>
        <strong>Take shelf photo</strong>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          style={{ display: "block", width: "100%", marginTop: 14 }}
        />
      </label>

      {file && <p>Selected: {file.name}</p>}

      <button
        onClick={scan}
        disabled={!file || busy}
        style={{ width: "100%", padding: 14, marginTop: 14, borderRadius: 10, border: 0 }}
      >
        {busy ? "Scanning…" : "Scan with Shelf Scouter"}
      </button>

      {error && <p role="alert">Error: {error}</p>}

      {result && (
        <section style={{ marginTop: 24, padding: 18, border: "1px solid #ccc", borderRadius: 12 }}>
          <h2>{result.observation.productName}</h2>
          <p>Confidence: {Math.round(result.observation.confidence * 100)}%</p>
          <p>Mode: {result.mode}</p>
          {result.location ? (
            <>
              <h3>Store location</h3>
              <p><strong>Aisle {result.location.aisle}</strong>{result.location.bay ? ` · Bay ${result.location.bay}` : ""}</p>
              <p>{result.location.section || "Section not supplied"}</p>
            </>
          ) : <p>No catalog location found for this store.</p>}
          <h3>Next steps</h3>
          <ol>{result.guidance.map((item) => <li key={item}>{item}</li>)}</ol>
          <small>Request: {result.requestId}</small>
        </section>
      )}
    </main>
  );
}
