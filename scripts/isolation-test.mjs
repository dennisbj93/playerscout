#!/usr/bin/env node
// Tester at to klubber ikke kan se eller ændre hinandens data.
//
// Kræver en kørende server (npm run dev) og to klubber oprettet med create-tenant.mjs.
//   BASE=http://localhost:5173 \
//   A_EMAIL=admin@efb.test A_PASSWORD=... B_EMAIL=admin@test.test B_PASSWORD=... \
//   node scripts/isolation-test.mjs

const BASE = process.env.BASE ?? "http://localhost:5173";
let failures = 0;

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login fejlede for ${email}: ${res.status}`);
  const cookie = res.headers.get("set-cookie").split(";")[0];
  return async (method, path, body) => {
    const r = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { cookie, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
}

function check(name, ok) {
  console.log(`${ok ? "OK  " : "FEJL"} ${name}`);
  if (!ok) failures++;
}

const a = await login(process.env.A_EMAIL, process.env.A_PASSWORD);
const b = await login(process.env.B_EMAIL, process.env.B_PASSWORD);

const unauth = await fetch(`${BASE}/api/players`);
check("uden login giver 401", unauth.status === 401);

const name = `Isolationstest ${Date.now()}`;
const created = await a("POST", "/players", { name, position: "VB" });
check("klub A kan oprette spiller", created.status === 201);
const pid = created.body.id;

const rep = await a("POST", "/reports", { playerId: pid, ratings: { pace: 4 }, recommendation: "follow", summary: "Test" });
check("klub A kan oprette rapport", rep.status === 201);
const sl = await a("POST", "/shortlists", { name: "A-liste" });
check("klub A kan oprette shortlist", sl.status === 201);
check("klub A kan tilføje spiller til shortlist", (await a("PUT", `/shortlists/${sl.body.id}/players/${pid}`, {})).status === 200);

check("klub A ser egen spiller", (await a("GET", `/players/${pid}`)).status === 200);
check("klub B kan ikke hente A's spiller", (await b("GET", `/players/${pid}`)).status === 404);
check("klub B ser ikke A's spiller i liste", !(await b("GET", `/players?q=${encodeURIComponent(name)}`)).body.some((p) => p.id === pid));
check("klub B ser ikke A's rapporter", !(await b("GET", "/reports")).body.some((r) => r.playerId === pid));
check("klub B ser ikke A's shortlists", !(await b("GET", "/shortlists")).body.some((s) => s.id === sl.body.id));
check("klub B kan ikke hente A's shortlist", (await b("GET", `/shortlists/${sl.body.id}`)).status === 404);
check("klub B kan ikke ændre A's spiller", (await b("PUT", `/players/${pid}`, { name: "Hacket" })).status === 404);
check("klub B kan ikke slette A's spiller", (await b("DELETE", `/players/${pid}`)).status === 404);
check(
  "klub B kan ikke skrive rapport på A's spiller",
  (await b("POST", "/reports", { playerId: pid, ratings: {}, recommendation: "sign", summary: "x" })).status === 404,
);
const bList = await b("POST", "/shortlists", { name: "B-liste" });
check("klub B kan ikke lægge A's spiller på egen shortlist", (await b("PUT", `/shortlists/${bList.body.id}/players/${pid}`, {})).status === 404);
check("klub B kan ikke ændre A's shortlist", (await b("PUT", `/shortlists/${sl.body.id}/players/${pid}`, { status: "rejected" })).status === 404);
check("A's spiller er uændret", (await a("GET", `/players/${pid}`)).body.player.name === name);

// Ryd op
await a("DELETE", `/players/${pid}`);
await a("DELETE", `/shortlists/${sl.body.id}`);
await b("DELETE", `/shortlists/${bList.body.id}`);

console.log(failures ? `\n${failures} test(s) fejlede` : "\nAlle isolationstests bestået");
process.exit(failures ? 1 : 0);
