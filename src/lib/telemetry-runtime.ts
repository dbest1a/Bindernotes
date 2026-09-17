import { supabase } from "@/lib/supabase";
import { saveQueue } from "@/lib/save-queue";
import { clearOperationMetrics, setOperationMetricSink } from "@/lib/operation-metrics";

saveQueue.subscribeAccount(clearOperationMetrics);
if (import.meta.env.VITE_TELEMETRY_ENABLED === "true") {
  setOperationMetricSink(async (metrics) => {
    const ownerId = saveQueue.getAccount();
    if (!supabase || !ownerId) throw new Error("No active metrics session");
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== ownerId || saveQueue.getAccount() !== ownerId) throw new Error("Metrics session changed");
    const result = await fetch("/api/telemetry", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ metrics }), keepalive: true,
    });
    if (!result.ok) throw new Error("Metrics delivery unavailable");
  });
}
