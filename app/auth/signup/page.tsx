"use client";

import { useState, type FormEvent } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [result, setResult] = useState<string>("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult("Creating account...");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, organizationName }),
    });

    const body = (await response.json()) as { error?: string; message?: string };

    if (!response.ok) {
      setResult(body.error ?? "Signup failed");
      return;
    }

    setResult(body.message ?? "Signup completed");
  }

  return (
    <main style={{ padding: 24, maxWidth: 540, margin: "0 auto" }}>
      <h1>Create account</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          type="text"
          placeholder="Organization"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <button type="submit">Sign up</button>
      </form>
      <p>{result}</p>
    </main>
  );
}
