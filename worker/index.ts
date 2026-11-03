import { Hono } from "hono";
import { z } from "zod";
import { authRoutes, requireAuth, requireRole, WRITE_ROLES } from "./auth";
import { hashPassword } from "./lib/crypto";
import type { AppEnv, Env } from "./env";
import { RECOMMENDATIONS, ROLES, SHORTLIST_STATUSES } from "../shared/types";

const opt = z.string().trim().max(500).nullish().transform((v) => (v ? v : null));
const date = z.iso.date().nullish().or(z.literal("").transform(() => null));

const playerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  birthDate: date,
  nationality: opt,
  position: opt,
  foot: opt,
  currentClub: opt,
  contractUntil: date,
  transfermarktUrl: z.url().nullish().or(z.literal("").transform(() => null)),
  wyscoutId: opt,
  instatId: opt,
  notes: z.string().max(10_000).nullish(),
});

const reportSchema = z.object({
  playerId: z.string().min(1),
  matchDescription: opt,
  matchDate: date,
  positionPlayed: opt,
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  overall: z.number().int().min(1).max(10).nullish(),
  recommendation: z.enum(RECOMMENDATIONS),
  summary: z.string().trim().min(1).max(20_000),
});

const parse = async <T extends z.ZodType>(schema: T, req: Request): Promise<z.infer<T> | null> => {
  const r = schema.safeParse(await req.json().catch(() => null));
  return r.success ? r.data : null;
};

const api = new Hono<AppEnv>()
  .route("/auth", authRoutes)
  .use("*", requireAuth)

  .get("/me", (c) => c.json(c.get("session")))

  // Spillere
  .get("/players", async (c) => c.json(await c.get("data").players.list(c.req.query("q")?.trim() || undefined)))
  .get("/players/:id", async (c) => {
    const data = c.get("data");
    const player = await data.players.get(c.req.param("id"));
    if (!player) return c.json({ error: "not_found" }, 404);
    const reports = (await data.reports.forPlayer(player.id)).map((r) => ({ ...r.report, authorName: r.authorName }));
    return c.json({ player, reports });
  })
  .post("/players", requireRole(...WRITE_ROLES), async (c) => {
    const input = await parse(playerSchema, c.req.raw);
    if (!input) return c.json({ error: "invalid_input" }, 400);
    return c.json({ id: await c.get("data").players.create(input) }, 201);
  })
  .put("/players/:id", requireRole(...WRITE_ROLES), async (c) => {
    const input = await parse(playerSchema.partial(), c.req.raw);
    if (!input) return c.json({ error: "invalid_input" }, 400);
    const ok = await c.get("data").players.update(c.req.param("id"), input);
    return ok ? c.json({ ok }) : c.json({ error: "not_found" }, 404);
  })
  .delete("/players/:id", requireRole("admin", "chefscout"), async (c) => {
    const ok = await c.get("data").players.remove(c.req.param("id"));
    return ok ? c.json({ ok }) : c.json({ error: "not_found" }, 404);
  })

  // Rapporter
  .get("/reports", async (c) =>
    c.json((await c.get("data").reports.recent()).map((r) => ({ ...r.report, authorName: r.authorName, playerName: r.playerName }))),
  )
  .post("/reports", requireRole(...WRITE_ROLES), async (c) => {
    const input = await parse(reportSchema, c.req.raw);
    if (!input) return c.json({ error: "invalid_input" }, 400);
    const allowed = new Set(c.get("session").tenant.template.attributes.map((a) => a.key));
    if (Object.keys(input.ratings).some((k) => !allowed.has(k))) return c.json({ error: "unknown_attribute" }, 400);
    const id = await c.get("data").reports.create(c.get("session").user.id, { ...input, overall: input.overall ?? null });
    return id ? c.json({ id }, 201) : c.json({ error: "not_found" }, 404);
  })
  .delete("/reports/:id", requireRole("admin", "chefscout"), async (c) => {
    const ok = await c.get("data").reports.remove(c.req.param("id"));
    return ok ? c.json({ ok }) : c.json({ error: "not_found" }, 404);
  })

  // Shortlists
  .get("/shortlists", async (c) => c.json(await c.get("data").shortlists.list()))
  .get("/shortlists/:id", async (c) => {
    const data = c.get("data");
    const list = await data.shortlists.get(c.req.param("id"));
    if (!list) return c.json({ error: "not_found" }, 404);
    const players = (await data.shortlists.players(list.id)).map((r) => ({ ...r.player, status: r.status, addedAt: r.addedAt }));
    return c.json({ shortlist: list, players });
  })
  .post("/shortlists", requireRole(...WRITE_ROLES), async (c) => {
    const input = await parse(z.object({ name: z.string().trim().min(1).max(200), description: opt }), c.req.raw);
    if (!input) return c.json({ error: "invalid_input" }, 400);
    return c.json({ id: await c.get("data").shortlists.create(input.name, input.description) }, 201);
  })
  .put("/shortlists/:id/players/:playerId", requireRole(...WRITE_ROLES), async (c) => {
    const input = await parse(z.object({ status: z.enum(SHORTLIST_STATUSES).default("watching") }), c.req.raw);
    if (!input) return c.json({ error: "invalid_input" }, 400);
    const ok = await c.get("data").shortlists.setPlayer(c.req.param("id"), c.req.param("playerId"), input.status);
    return ok ? c.json({ ok }) : c.json({ error: "not_found" }, 404);
  })
  .delete("/shortlists/:id/players/:playerId", requireRole(...WRITE_ROLES), async (c) => {
    const ok = await c.get("data").shortlists.removePlayer(c.req.param("id"), c.req.param("playerId"));
    return ok ? c.json({ ok }) : c.json({ error: "not_found" }, 404);
  })
  .delete("/shortlists/:id", requireRole("admin", "chefscout"), async (c) => {
    const ok = await c.get("data").shortlists.remove(c.req.param("id"));
    return ok ? c.json({ ok }) : c.json({ error: "not_found" }, 404);
  })

  // Brugere i egen klub (kun admin)
  .get("/users", requireRole("admin"), async (c) => c.json(await c.get("data").users.list()))
  .post("/users", requireRole("admin"), async (c) => {
    const input = await parse(
      z.object({ email: z.email(), name: z.string().trim().min(1), role: z.enum(ROLES), password: z.string().min(10) }),
      c.req.raw,
    );
    if (!input) return c.json({ error: "invalid_input" }, 400);
    try {
      const id = await c.get("data").users.create({ ...input, passwordHash: await hashPassword(input.password) });
      return c.json({ id }, 201);
    } catch {
      return c.json({ error: "email_taken" }, 409);
    }
  });

const app = new Hono<{ Bindings: Env }>()
  .route("/api", api)
  .all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
