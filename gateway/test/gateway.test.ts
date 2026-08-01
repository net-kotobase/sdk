import assert from "node:assert/strict";
import test from "node:test";
import { createHandler } from "../src/index.ts";

const endpoint = "https://kotobase.net/xrpc/ai.gftd.apps.kotobase.query.execute";

test("requires authentication before dispatch", async () => {
  const handler = createHandler(async () => { throw new Error("must not dispatch"); });
  const response = await handler(new Request(endpoint, {
    method: "POST",
    body: JSON.stringify({ language: "cypher", query: "MATCH (n:users) RETURN n.name" }),
  }));
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "unauthorized");
});

test("maps Cypher to its native protocol and wraps the result", async () => {
  let captured: { url: string; init?: RequestInit } | undefined;
  const handler = createHandler(async (input, init) => {
    captured = { url: String(input), init };
    return Response.json({ results: [{ columns: ["n.name"], data: [{ row: ["Ada"] }] }], errors: [] });
  });
  const response = await handler(new Request(endpoint, {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json", "x-request-id": "req-1" },
    body: JSON.stringify({ language: "cypher", query: "MATCH (n:users) RETURN n.name", parameters: { role: "admin" } }),
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(captured?.url, "https://cypher.kotobase.net/db/data/transaction/commit");
  assert.equal(new Headers(captured?.init?.headers).get("authorization"), "Bearer test");
  assert.deepEqual(JSON.parse(String(captured?.init?.body)), {
    statements: [{ statement: "MATCH (n:users) RETURN n.name", parameters: { role: "admin" } }],
  });
  assert.equal(result.meta.requestId, "req-1");
  assert.equal(result.meta.engine, "org-opencypher-cypher");
});

test("maps Datalog to the tenant-scoped apex query", async () => {
  let body: Record<string, unknown> | undefined;
  const handler = createHandler(async (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ graph: "bafygraph", rows_edn: [["\"Ada\""]], basis_t: "bafybasis" });
  });
  const response = await handler(new Request(endpoint, {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify({
      language: "datalog",
      database: "people",
      query: "{:find [?n] :where [[?e :person/name ?n]]}",
      options: { limit: 10, emitCid: true },
    }),
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body?.db_name, "people");
  assert.equal(body?.limit, 10);
  assert.equal(result.meta.basisT, "bafybasis");
});

test("returns an explicit unavailable error on DNS or transport failure", async () => {
  const handler = createHandler(async () => { throw new TypeError("DNS failure"); });
  const response = await handler(new Request(endpoint, {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify({ language: "graphql", query: "{ users { name } }" }),
  }));
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.error.code, "engine_unavailable");
  assert.equal(result.error.retryable, true);
});

test("does not expose a query engine 5xx response body", async () => {
  const handler = createHandler(async () => Response.json(
    { error: { message: "internal credential and object-key details" } },
    { status: 500 },
  ));
  const response = await handler(new Request(endpoint, {
    method: "POST",
    headers: { authorization: "Bearer test", "content-type": "application/json" },
    body: JSON.stringify({ language: "sparql", query: "SELECT * WHERE { ?s ?p ?o }" }),
  }));
  const result = await response.json();
  assert.equal(response.status, 503);
  assert.equal(result.error.message, "sparql query engine is unavailable");
  assert.doesNotMatch(JSON.stringify(result), /credential|object-key/);
});

test("CORS preflight is handled on the exact route", async () => {
  const handler = createHandler();
  const response = await handler(new Request(endpoint, { method: "OPTIONS" }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});
