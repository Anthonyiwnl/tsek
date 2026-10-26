export class ApplicationsApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApplicationsApiError";
    this.status = status;
    this.code = code;
  }
}

export function createApplicationsApi({
  baseUrl = "",
  getHeaders,
  fetchImpl = fetch,
}) {
  const apiBaseUrl = baseUrl.replace(/\/+$/, "");

  async function request(path, { method = "GET", body, authenticated = true } = {}) {
    const headers = new Headers(authenticated ? await getHeaders() : undefined);
    const options = { method, headers };
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(body);
    }

    const response = await fetchImpl(`${apiBaseUrl}${path}`, options);
    if (response.status === 204) return undefined;

    let payload;
    try {
      payload = await response.json();
    } catch {
      if (response.ok) {
        throw new Error("The server returned an invalid response.");
      }
    }

    if (!response.ok) {
      throw new ApplicationsApiError(
        payload?.error?.message || "The request could not be completed.",
        response.status,
        payload?.error?.code,
      );
    }
    return payload?.data;
  }

  async function recordRequest(path, options) {
    const data = await request(path, options);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("The server returned an invalid response.");
    }
    return data;
  }

  return {
    async list() {
      const data = await request("/api/applications");
      if (!Array.isArray(data)) {
        throw new Error("The server returned an invalid response.");
      }
      return data;
    },
    get: (id) => recordRequest(`/api/applications/${encodeURIComponent(id)}`),
    async catalogue() {
      const data = await request("/api/document-types", { authenticated: false });
      if (!Array.isArray(data)) {
        throw new Error("The server returned an invalid response.");
      }
      return data;
    },
    create: (application) =>
      recordRequest("/api/applications", { method: "POST", body: application }),
    update: (id, changes) =>
      recordRequest(`/api/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: changes,
      }),
    remove: (id) =>
      request(`/api/applications/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  };
}
