import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const tournaments = sqliteTable("tournaments", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull(),
  body: text("body").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  body: text("body").notNull(),
  expires: integer("expires").notNull(),
});
export const admins = sqliteTable("admins", {
  username: text("username").primaryKey(),
  subject: text("subject").notNull(),
  issuer: text("issuer").notNull(),
});
