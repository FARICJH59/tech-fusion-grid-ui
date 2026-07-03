"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SubscribePage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    const apiBaseUrl = process.env.NEXT_PUBLIC_HOARE_API_URL;

    if (!trimmedEmail) {
      setError("Enter the email address tied to your HOARE access.");
      return;
    }

    if (!apiBaseUrl) {
      setError("Billing is unavailable because NEXT_PUBLIC_HOARE_API_URL is not set.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${apiBaseUrl}/api/billing/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        url?: string;
      };

      if (!res.ok || !data.url) {
        throw new Error(data.message || "Unable to create a Stripe checkout session.");
      }

      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setIsLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#fff",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 540,
          background: "#162033",
          border: "1px solid #263248",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 18px 48px rgba(0, 0, 0, 0.35)",
        }}
      >
        <p style={{ color: "#60a5fa", margin: "0 0 8px" }}>HOARE Console Access</p>
        <h1 style={{ fontSize: "2rem", margin: "0 0 12px" }}>Subscribe to unlock HOARE</h1>
        <p style={{ color: "#9ca3af", lineHeight: 1.6, margin: "0 0 24px" }}>
          Payment, provisioning, and entitlement activation are completed by the backend.
          After checkout, sign in with the same email to unlock the HOARE Console.
        </p>

        <form onSubmit={handleSubscribe} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#cbd5e1" }}>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#fff",
                fontSize: 16,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              background: isLoading ? "#475569" : "#2563eb",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: isLoading ? "wait" : "pointer",
            }}
          >
            {isLoading ? "Redirecting to Stripe..." : "Subscribe"}
          </button>
        </form>

        {error ? (
          <p style={{ color: "#fca5a5", marginTop: 16 }} role="alert">
            {error}
          </p>
        ) : null}

        <p style={{ marginTop: 24 }}>
          <Link href="/" style={{ color: "#93c5fd" }}>
            Return to dashboard
          </Link>
        </p>
      </section>
    </main>
  );
}
