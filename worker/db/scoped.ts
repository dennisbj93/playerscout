import { and, asc, desc, eq, like, sql, type Column } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { newId } from "../lib/crypto";

const { players, reports, shortlistPlayers, shortlists, users } = schema;

export type DB = DrizzleD1Database<typeof schema>;

export type PlayerInput = Omit<typeof players.$inferInsert, "id" | "tenantId" | "createdAt" | "updatedAt">;
export type ReportInput = Omit<typeof reports.$inferInsert, "id" | "tenantId" | "authorId" | "createdAt">;
type ShortlistStatus = (typeof shortlistPlayers.$inferInsert)["status"];
type UserRole = (typeof users.$inferInsert)["role"];

/**
 * Det ENESTE sted, routes må hente eller ændre klubdata.
 * Alle forespørgsler er bundet til én tenantId, så en klub aldrig kan
 * læse eller ændre en anden klubs data, heller ikke med et gættet ID.
 */
export function scoped(db: DB, tenantId: string) {
  const own = (t: { tenantId: Column }) => eq(t.tenantId, tenantId);

  const ownsPlayer = async (playerId: string) =>
    (await db.select({ id: players.id }).from(players).where(and(own(players), eq(players.id, playerId))).limit(1)).length > 0;
  const ownsShortlist = async (id: string) =>
    (await db.select({ id: shortlists.id }).from(shortlists).where(and(own(shortlists), eq(shortlists.id, id))).limit(1)).length > 0;

  return {
    tenantId,

    players: {
      list: (q?: string) =>
        db
          .select()
          .from(players)
          .where(q ? and(own(players), like(players.name, `%${q}%`)) : own(players))
          .orderBy(asc(players.name))
          .limit(200),
      get: async (id: string) =>
        (await db.select().from(players).where(and(own(players), eq(players.id, id))).limit(1))[0] ?? null,
      create: async (input: PlayerInput) => {
        const row = { ...input, id: newId(), tenantId };
        await db.insert(players).values(row);
        return row.id;
      },
      update: async (id: string, input: Partial<PlayerInput>) => {
        const res = await db
          .update(players)
          .set({ ...input, updatedAt: new Date().toISOString() })
          .where(and(own(players), eq(players.id, id)));
        return res.meta.changes > 0;
      },
      remove: async (id: string) => {
        const res = await db.delete(players).where(and(own(players), eq(players.id, id)));
        return res.meta.changes > 0;
      },
    },

    reports: {
      forPlayer: (playerId: string) =>
        db
          .select({ report: reports, authorName: users.name })
          .from(reports)
          .innerJoin(users, eq(users.id, reports.authorId))
          .where(and(own(reports), eq(reports.playerId, playerId)))
          .orderBy(desc(reports.createdAt)),
      recent: (limit = 20) =>
        db
          .select({ report: reports, authorName: users.name, playerName: players.name })
          .from(reports)
          .innerJoin(users, eq(users.id, reports.authorId))
          .innerJoin(players, and(eq(players.id, reports.playerId), own(players)))
          .where(own(reports))
          .orderBy(desc(reports.createdAt))
          .limit(limit),
      create: async (authorId: string, input: ReportInput) => {
        if (!(await ownsPlayer(input.playerId))) return null; // spilleren skal tilhøre samme klub
        const row = { ...input, id: newId(), tenantId, authorId };
        await db.insert(reports).values(row);
        return row.id;
      },
      remove: async (id: string) => {
        const res = await db.delete(reports).where(and(own(reports), eq(reports.id, id)));
        return res.meta.changes > 0;
      },
    },

    shortlists: {
      list: () =>
        db
          .select({
            id: shortlists.id,
            name: shortlists.name,
            description: shortlists.description,
            createdAt: shortlists.createdAt,
            playerCount: sql<number>`(select count(*) from shortlist_players sp where sp.shortlist_id = ${shortlists.id} and sp.tenant_id = ${tenantId})`,
          })
          .from(shortlists)
          .where(own(shortlists))
          .orderBy(asc(shortlists.name)),
      get: async (id: string) =>
        (await db.select().from(shortlists).where(and(own(shortlists), eq(shortlists.id, id))).limit(1))[0] ?? null,
      players: (id: string) =>
        db
          .select({ player: players, status: shortlistPlayers.status, addedAt: shortlistPlayers.addedAt })
          .from(shortlistPlayers)
          .innerJoin(players, and(eq(players.id, shortlistPlayers.playerId), own(players)))
          .where(and(own(shortlistPlayers), eq(shortlistPlayers.shortlistId, id)))
          .orderBy(asc(players.name)),
      create: async (name: string, description?: string | null) => {
        const row = { id: newId(), tenantId, name, description: description ?? null };
        await db.insert(shortlists).values(row);
        return row.id;
      },
      setPlayer: async (shortlistId: string, playerId: string, status: ShortlistStatus = "watching") => {
        if (!(await ownsShortlist(shortlistId)) || !(await ownsPlayer(playerId))) return false;
        await db
          .insert(shortlistPlayers)
          .values({ tenantId, shortlistId, playerId, status })
          .onConflictDoUpdate({ target: [shortlistPlayers.shortlistId, shortlistPlayers.playerId], set: { status } });
        return true;
      },
      removePlayer: async (shortlistId: string, playerId: string) => {
        const res = await db
          .delete(shortlistPlayers)
          .where(and(own(shortlistPlayers), eq(shortlistPlayers.shortlistId, shortlistId), eq(shortlistPlayers.playerId, playerId)));
        return res.meta.changes > 0;
      },
      remove: async (id: string) => {
        const res = await db.delete(shortlists).where(and(own(shortlists), eq(shortlists.id, id)));
        return res.meta.changes > 0;
      },
    },

    users: {
      list: () =>
        db
          .select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt })
          .from(users)
          .where(own(users))
          .orderBy(asc(users.name)),
      create: async (input: { email: string; name: string; role: UserRole; passwordHash: string }) => {
        const row = { ...input, email: input.email.toLowerCase(), id: newId(), tenantId };
        await db.insert(users).values(row);
        return row.id;
      },
    },
  };
}

export type Scoped = ReturnType<typeof scoped>;
