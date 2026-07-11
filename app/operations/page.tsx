"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OperationsSnapshot } from "@/lib/enterprise/operations";

export default function OperationsPage() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/operations/stream");
    source.addEventListener("operations", (event) => {
      const message = event as MessageEvent<string>;
      setSnapshot(JSON.parse(message.data) as OperationsSnapshot);
    });

    return () => {
      source.close();
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "#0b1220", color: "#fff", padding: 32 }}>
      <h1>Real-Time Operations</h1>
      <p style={{ color: "#9ca3af" }}>
        Cloud Control Center with live deployments, autonomous actions, scaling, rollback, incidents, SLO, and approvals.
      </p>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      <p>
        <Link href="/">← Back to dashboard</Link>
      </p>
    </main>
  );
}
