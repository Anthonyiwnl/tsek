import { sessionHeaders } from "./auth";
import { createApplicationsApi } from "./applications-api.js";

export const applicationsApi = createApplicationsApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  getHeaders: sessionHeaders,
});
