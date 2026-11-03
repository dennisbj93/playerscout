import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import * as schema from "./db/schema";
import { scoped } from "./db/scoped";
import { randomToken, sha256, verifyPassword } from "./lib/crypto";
import type { AppEnv } from "./env";
import { DEFAULT_TEMPLATE, type Role } from "../shared/types";

const COOKIE = "ps_session";
const SESSION_DAYS = 30;

export const db = (d1: D1Database) => drizzle(d1, { schema });

/** Kræver login. Sætter session og et klub-afgrænset datalag på context. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const d = db(c.env.DB);
  const rows = await d
    .select({ user: schema.users, tenant: schema.tenants })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.sessions.tenantId))
    .where(and(eq(schema.sessions.id, await sha256(token)), gt(schema.sessions.expiresAt, new Date().toISOString())))
    .limit(1);
  const row = rows[0];
  // Brugerens klub skal matche sessionens klub.
  if (!row || row.user.tenantId !== row.tenant.id) return c.json({ error: "unauthorized" }, 401);

  c.set("session", {
    user: { id: row.user.id, name: row.user.name, email: row.user.email, role: row.user.role },
    tenant: {
      id: row.tenant.id,
      name: row.tenant.name,
      slug: row.tenant.slug,
      template: row.tenant.settings?.template ?? DEFAULT_TEMPLATE,
    },
  });
  c.set("data", scoped(d, row.tenant.id));
  await next();
});

/** Kræver en af de angivne roller. */
export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get("session").user.role)) return c.json({ error: "forbidden" }, 403);
    await next();
  });

export const WRITE_ROLES: Role[] = ["admin", "chefscout", "scout"];

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

export const authRoutes = new Hono<AppEnv>()
  .post("/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid_input" }, 400);

    const d = db(c.env.DB);
    const user = (
      await d.select().from(schema.users).where(eq(schema.users.email, parsed.data.email.toLowerCase())).limit(1)
    )[0];
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return c.json({ error: "invalid_credentials" }, 401);
    }

    const token = randomToken();
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    await d.insert(schema.sessions).values({
      id: await sha256(token),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt: expires.toISOString(),
    });
    setCookie(c, COOKIE, token, {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === "https:",
      sameSite: "Lax",
      path: "/",
      expires,
    });
    return c.json({ ok: true });
  })
  .post("/logout", async (c) => {
    const token = getCookie(c, COOKIE);
    if (token) await db(c.env.DB).delete(schema.sessions).where(eq(schema.sessions.id, await sha256(token)));
    deleteCookie(c, COOKIE, { path: "/" });
    return c.json({ ok: true });
  });
