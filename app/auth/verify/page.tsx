"use client";

import { useState, type FormEvent } from "react";

export default function VerifyPage() {
  const [tokenHash, setTokenHash] = useState("");
  const [result, setResult] = useState<string>("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult("Verifying...");

    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenHash, type: "signup" }),
    });

    const body = (await response.json()) as { error?: string };
    setResult(response.ok ? "Verification complete" : body.error ?? "Verification failed");
  }

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>Verify email</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          type="text"
          placeholder="Token hash"
          value={tokenHash}
          onChange={(e) => setTokenHash(e.target.value)}
          required
        />
        <button type="submit">Verify</button>
      </form>
      <p>{result}</p>
    </main>
  );
}
