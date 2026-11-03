# Playerscout

Scouting-platform til fodboldklubber. Flere klubber kan bruge den samme installation, og hver klubs data er helt adskilt. Esbjerg fB er første klub.

## Stak

- **Cloudflare Worker** med statiske filer (én deploy)
- **API:** [Hono](https://hono.dev) i `worker/`
- **Web-app:** React + Vite i `src/`
- **Database:** Cloudflare D1 (SQLite) med [Drizzle ORM](https://orm.drizzle.team), skema i `worker/db/schema.ts`

## Sådan er klubdata adskilt

- Alle tabeller med klubdata har `tenant_id`.
- Routes må kun hente data via `scoped(db, tenantId)` i `worker/db/scoped.ts`, som altid filtrerer på den indloggede brugers klub.
- Klubben bestemmes af login-sessionen, aldrig af noget, klienten sender.
- `scripts/isolation-test.mjs` tester, at en klub ikke kan se, ændre eller linke til en anden klubs spillere, rapporter og shortlists.

## Roller

| Rolle | Kan |
| --- | --- |
| admin | Alt, inkl. at oprette brugere i egen klub |
| chefscout | Oprette, rette og slette spillere, rapporter og shortlists |
| scout | Oprette og rette spillere, rapporter og shortlists |
| coach | Kun læse |

## Kom i gang lokalt

```bash
npm install
npm run db:migrate:local

# Opret en klub med en admin-bruger
node scripts/create-tenant.mjs --name "Esbjerg fB" --slug efb \
  --email dig@efb.dk --admin-name "Dit navn" --password "mindst-10-tegn" > tenant.sql
npx wrangler d1 execute playerscout --local --file tenant.sql
rm tenant.sql

npm run dev   # http://localhost:5173
```

## Deploy til Cloudflare

1. Opret databasen i EU:
   ```bash
   npx wrangler d1 create playerscout --jurisdiction eu
   ```
   Kopier `database_id` ind i `wrangler.jsonc`.
2. Kør migrationer mod produktion: `npm run db:migrate:remote`
3. Opret EfB som klub med `create-tenant.mjs` og `wrangler d1 execute playerscout --remote --file tenant.sql`.
4. I Cloudflare-dashboardet: **Workers & Pages → Create → Import a repository**, vælg dette GitHub-repo.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`
5. Hvert push til `main` deployer nu automatisk.

## Ændringer i databasen

Ret `worker/db/schema.ts`, kør `npm run db:generate`, og commit den nye fil i `migrations/`.

## Test

```bash
npm run typecheck
npm run dev   # i en anden terminal
BASE=http://localhost:5173 A_EMAIL=... A_PASSWORD=... B_EMAIL=... B_PASSWORD=... npm run test:isolation
```
