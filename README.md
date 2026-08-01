# Kotobase SDK

One query client for Kotobase from TypeScript, Python, Rust, and PHP.

The SDKs share one wire contract and expose the same five read-only query
families:

- Datomic-shaped Datalog
- openCypher
- Apache TinkerPop Gremlin bytecode
- GraphQL
- SPARQL

The client does not translate one query language into another. It sends a
versioned JSON query envelope to Kotobase, where the request is dispatched to
the existing language engine. This keeps parsing and query semantics on the
server and makes authentication, errors, timeouts, provenance, and result
metadata consistent in every host language.

```ts
import { KotobaseClient } from "@net-kotobase/sdk";

const db = new KotobaseClient({
  endpoint: "https://kotobase.net",
  token: process.env.KOTOBASE_TOKEN,
});

const result = await db.cypher(
  "MATCH (n:users) WHERE n.role = $role RETURN n.name",
  { parameters: { role: "admin" } },
);
console.log(result.data);
```

```python
from kotobase import KotobaseClient

db = KotobaseClient("https://kotobase.net", token="...")
result = db.sparql("SELECT ?s WHERE { ?s <urn:kotobase:role> \"admin\" }")
print(result.data)
```

```rust
use net_kotobase::{KotobaseClient, RequestOptions};

let db = KotobaseClient::new("https://kotobase.net").with_token("...");
let result = db
    .datalog(
        "{:find [?n] :where [[?e :person/name ?n]]}",
        RequestOptions::default(),
    )
    .await?;
println!("{}", result.data);
```

```php
use NetKotobase\KotobaseClient;

$db = new KotobaseClient('https://kotobase.net', token: '...');
$result = $db->graphql('{ users { name } }');
var_dump($result->data);
```

## Repository layout

| Path | Purpose |
|---|---|
| `spec/openapi.yaml` | Authoritative `query.execute` HTTP contract |
| `packages/typescript` | Browser, Node.js, Deno, and edge client |
| `packages/python` | Python 3.9+ client |
| `packages/rust` | Async Rust client |
| `packages/php` | PHP 8.1+ client |
| `docs/adr` | Architecture decisions and server integration plan |

## Wire endpoint

All clients call:

```text
POST /xrpc/ai.gftd.apps.kotobase.query.execute
Content-Type: application/json
Authorization: Bearer <token>       # optional for public graphs
```

See [`spec/openapi.yaml`](spec/openapi.yaml) for request, result, and error
shapes. Servers that have not installed the query gateway will return a normal
`404`; the SDK does not pretend that an unavailable engine is usable.

## Status

This repository defines and implements the portable client boundary. The
Kotobase edge still needs to mount `query.execute` and dispatch it to the
existing protocol implementations before the public endpoint is live; see
[`ADR-0001`](docs/adr/0001-unified-query-envelope.md).

## License

Apache-2.0
