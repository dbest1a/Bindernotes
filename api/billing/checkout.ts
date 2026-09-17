import { billingEndpoint } from "../../server/billing/runtime";
export default { fetch: billingEndpoint("checkout") };
