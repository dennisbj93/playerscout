#!/usr/bin/env node
// Opretter en ny klub (tenant) med en admin-bruger.
//
// Brug:
//   node scripts/create-tenant.mjs --name "Esbjerg fB" --slug efb \
//     --email admin@efb.dk --admin-name "Dennis" --password "et-langt-kodeord" > tenant.sql
//   npx wrangler d1 execute playerscout --local  --file tenant.sql   # lokalt
//   npx wrangler d1 execute playerscout --remote --file tenant.sql   # produktion
//
// Slet tenant.sql bagefter; den indeholder et password-hash.

import { parseArgs } from "node:util";
import { webcrypto as crypto } from "node:crypto";

const { values: a } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    email: { type: "string" },
    "admin-name": { type: "string" },
    password: { type: "string" },
  },
});

for (const k of ["name", "slug", "email", "admin-name", "password"]) {
  if (!a[k]) {
    console.error(`Mangler --${k}`);
    process.exit(1);
  }
}
if (a.password.length < 10) {
  console.error("Kodeordet skal være mindst 10 tegn.");
  process.exit(1);
}

const ITERATIONS = 100_000; // samme som worker/lib/crypto.ts
const hex = (b) => Buffer.from(b).toString("hex");
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(a.password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
const hash = ["pbkdf2", ITERATIONS, hex(salt), hex(bits)].join("$");

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;
const tenantId = crypto.randomUUID();
const userId = crypto.randomUUID();

console.log(
  [
    `INSERT INTO tenants (id, name, slug) VALUES (${q(tenantId)}, ${q(a.name)}, ${q(a.slug)});`,
    `INSERT INTO users (id, tenant_id, email, name, role, password_hash) VALUES (${q(userId)}, ${q(tenantId)}, ${q(a.email.toLowerCase())}, ${q(a["admin-name"])}, 'admin', ${q(hash)});`,
  ].join("\n"),
);
