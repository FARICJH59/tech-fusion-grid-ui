"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/hooks/useSupabase";
import { useRouter } from "next/navigation";

type Entitlements = {
  subscription_active: boolean;
  subscription_level: string;
} | null;

export default function AccessMatrix() {
  const router = useRouter();
  const { user, supabase } = useSupabase();

  const [entitlements, setEntitlements] = useState<Entitlements>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadEntitlements = async () => {
      const { data, error } = await supabase
        .from("entitlements")
        .select("*")
        .eq("email", user.email)
        .single();

      if (error) {
        console.error("Entitlement fetch error:", error);
      }

      setEntitlements(data);
      setLoading(false);
    };

    loadEntitlements();
  }, [user]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#0b1220",
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <p>Loading access matrix…</p>
      </main>
    );
  }

  const isActive = entitlements?.subscription_active === true;
  const tier = entitlements?.subscription_level ?? "none";

  const modules = [
    {
      name: "Verification Dashboard",
      key: "verification",
      unlocked: isActive,
    },
    {
      name: "Agent Orchestration",
      key: "agents",
      unlocked: isActive,
    },
    {
      name: "Carbon Engine",
      key: "carbon",
      unlocked: tier === "pro",
    },
    {
      name: "Energy Engine",
      key: "energy",
      unlocked: tier === "pro",
    },
    {
      name: "Global Fleet Matrix",
      key: "fleet",
      unlocked: tier === "enterprise",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "#fff",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Access Matrix</h1>
      <p style={{ color: "#9ca3af", marginBottom: 32 }}>
        Subscription tier:{" "}
        <strong style={{ color: isActive ? "#34d399" : "#f87171" }}>
          {tier === "none" ? "No active subscription" : tier.toUpperCase()}
        </strong>
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        {modules.map((mod) => (
          <div
            key={mod.key}
            style={{
              background: mod.unlocked ? "#0f2a1d" : "#162033",
              border: `1px solid ${mod.unlocked ? "#064e3b" : "#263248"}`,
              borderRadius: 12,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "1.25rem" }}>
                {mod.unlocked ? "🔓" : "🔒"}
              </span>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>{mod.name}</h3>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color: mod.unlocked ? "#34d399" : "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {mod.unlocked ? "Unlocked" : "Locked"}
            </span>
            {mod.unlocked && (
              <button
                onClick={() => router.push(`/${mod.key}`)}
                style={{
                  marginTop: "auto",
                  background: "#065f46",
                  color: "#d1fae5",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Open
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
