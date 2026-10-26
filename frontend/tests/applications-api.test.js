import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ApplicationsApiError,
  createApplicationsApi,
} from "../src/applications-api.js";

const application = {
  id: "application-uuid",
  document_type_id: "document-type-uuid",
  document_type_name: "Barangay Clearance",
  purpose: "Employment",
  status: "draft",
  created_at: "2026-10-26T10:00:00Z",
  updated_at: "2026-10-26T10:00:00Z",
};

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return body;
    },
  };
}

test("application API sends the session token and supports CRUD requests", async () => {
  const calls = [];
  const api = createApplicationsApi({
    baseUrl: "https://api.example.test",
    getHeaders: async () => ({ Authorization: "Bearer test-token" }),
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "DELETE") return response(204);
      if (url.endsWith("/api/document-types")) {
        return response(200, {
          data: [{ id: "document-type-uuid", name: "Barangay Clearance" }],
        });
      }
      if (options.method === "GET") {
        return response(
          200,
          { data: url.endsWith(application.id) ? application : [application] },
        );
      }
      return response(200, { data: application });
    },
  });

  assert.deepEqual(await api.list(), [application]);
  assert.equal((await api.catalogue())[0].id, application.document_type_id);
  assert.equal((await api.get(application.id)).id, application.id);
  assert.equal((await api.create({
    document_type_id: application.document_type_id,
    purpose: application.purpose,
  })).id, application.id);
  assert.equal((await api.update(application.id, { purpose: "Updated" })).id, application.id);
  assert.equal(await api.remove(application.id), undefined);
  assert.equal(calls.length, 6);
  for (const [index, { options }] of calls.entries()) {
    if (index === 1) {
      assert.equal(options.headers.get("Authorization"), null);
    } else {
      assert.equal(options.headers.get("Authorization"), "Bearer test-token");
    }
  }
  assert.equal(calls[3].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[3].options.body), {
    document_type_id: application.document_type_id,
    purpose: application.purpose,
  });
  assert.equal(calls[4].options.method, "PATCH");
  assert.equal(calls[5].options.method, "DELETE");
});

test("application API rejects malformed successful responses", async () => {
  const api = createApplicationsApi({
    getHeaders: async () => ({ Authorization: "Bearer test-token" }),
    fetchImpl: async () => response(200, { data: null }),
  });

  await assert.rejects(api.list(), /invalid response/);
});

test("application API reports safe server errors with status and code", async () => {
  const api = createApplicationsApi({
    getHeaders: async () => ({ Authorization: "Bearer test-token" }),
    fetchImpl: async () =>
      response(404, {
        error: { code: "NOT_FOUND", message: "Application not found." },
      }),
  });

  await assert.rejects(api.get("missing"), (error) => {
    assert.ok(error instanceof ApplicationsApiError);
    assert.equal(error.status, 404);
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(error.message, "Application not found.");
    return true;
  });
});

test("application API surfaces network failures instead of returning fake data", async () => {
  const api = createApplicationsApi({
    getHeaders: async () => ({ Authorization: "Bearer test-token" }),
    fetchImpl: async () => {
      throw new TypeError("network unavailable");
    },
  });

  await assert.rejects(api.list(), /network unavailable/);
});
