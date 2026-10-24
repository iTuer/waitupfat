import { pgTable, text, integer, bigint, boolean, timestamp, primaryKey, index } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true, mode: "date" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true, mode: "date" }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true, mode: "date" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull(),
});
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" }).notNull(),
});
export const rateLimit = pgTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("lastRequest", { mode: "number" }).notNull(),
});
export const meals = pgTable("meals", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull().references(() => user.id),
  title: text("title").notNull(),
  note: text("note").notNull().default(""),
  kind: text("kind").notNull(),
  emoji: text("emoji").notNull().default("🍚"),
  visibility: text("visibility").notNull().default("private"),
  eatenAt: text("eaten_at").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  withdrawn: integer("withdrawn").notNull().default(0),
}, (t) => [index("meals_owner_time").on(t.owner, t.createdAt), index("meals_feed").on(t.visibility, t.withdrawn, t.createdAt)]);
export const votes = pgTable("votes", {
  mealId: text("meal_id").notNull().references(() => meals.id),
  userId: text("user_id").notNull().references(() => user.id),
  value: integer("value").notNull(),
  reason: text("reason").notNull().default(""),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (t) => [primaryKey({ columns: [t.mealId, t.userId] })]);
export const likes = pgTable("likes", {
  mealId: text("meal_id").notNull().references(() => meals.id),
  userId: text("user_id").notNull().references(() => user.id),
}, (t) => [primaryKey({ columns: [t.mealId, t.userId] })]);
export const settings = pgTable("settings", {
  userId: text("user_id").primaryKey().references(() => user.id),
  breakfast: text("breakfast").notNull().default("08:30"),
  lunch: text("lunch").notNull().default("12:30"),
  dinner: text("dinner").notNull().default("18:30"),
  enabled: integer("enabled").notNull().default(0),
});
