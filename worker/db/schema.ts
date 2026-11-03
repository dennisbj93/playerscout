import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Hver tabel med klubdata har tenant_id. Adgang sker KUN via worker/db/scoped.ts,
// som altid filtrerer på den indloggede klub.

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: text("settings", { mode: "json" }).$type<{ template?: { attributes: { key: string; label: string }[] } }>(),
  createdAt: text("created_at").notNull().default(now),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["admin", "chefscout", "scout", "coach"] }).notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email), index("users_tenant_idx").on(t.tenantId)],
);

export const sessions = sqliteTable("sessions", {
  // SHA-256 af session-token; selve token findes kun i brugerens cookie.
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().references(() => tenants.id),
  expiresAt: text("expires_at").notNull(),
});

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    birthDate: text("birth_date"),
    nationality: text("nationality"),
    position: text("position"),
    foot: text("foot"),
    currentClub: text("current_club"),
    contractUntil: text("contract_until"),
    transfermarktUrl: text("transfermarkt_url"),
    wyscoutId: text("wyscout_id"),
    instatId: text("instat_id"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(now),
    updatedAt: text("updated_at").notNull().default(now),
  },
  (t) => [index("players_tenant_name_idx").on(t.tenantId, t.name)],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull().references(() => users.id),
    matchDescription: text("match_description"),
    matchDate: text("match_date"),
    positionPlayed: text("position_played"),
    ratings: text("ratings", { mode: "json" }).$type<Record<string, number>>().notNull(),
    overall: integer("overall"),
    recommendation: text("recommendation", { enum: ["sign", "follow", "reject"] }).notNull(),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("reports_tenant_player_idx").on(t.tenantId, t.playerId)],
);

export const shortlists = sqliteTable(
  "shortlists",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [index("shortlists_tenant_idx").on(t.tenantId)],
);

export const shortlistPlayers = sqliteTable(
  "shortlist_players",
  {
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    shortlistId: text("shortlist_id").notNull().references(() => shortlists.id, { onDelete: "cascade" }),
    playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["watching", "priority", "contacted", "rejected"] }).notNull().default("watching"),
    addedAt: text("added_at").notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.shortlistId, t.playerId] })],
);
