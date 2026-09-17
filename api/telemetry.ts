import { createClient } from "@supabase/supabase-js";
import { telemetryHandler } from "../server/telemetry";

const handler = telemetryHandler({
  authenticate: async (token) => {
    if (process.env.TELEMETRY_ENABLED !== "true" || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    return !error && Boolean(data.user);
  },
  log: (value) => console.info(JSON.stringify(value)),
});
export default { fetch: handler };
