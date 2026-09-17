import { billingEndpoint } from "../../server/billing/runtime.js";
export default { fetch: billingEndpoint("webhook") };
