import { supabase } from "@/lib/supabase";

export default async function AuditPage() {
  const { data: events } = await supabase
    .from("audit_events")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Audit Timeline</h2>
      <ul className="space-y-2 text-xs">
        {events?.map((e) => (
          <li key={e.id} className="border border-slate-800 p-2 rounded">
            <strong>{e.action}</strong> — {e.details}
            <br />
            <span className="text-slate-500">{e.timestamp}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
