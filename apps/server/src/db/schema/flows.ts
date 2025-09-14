import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const flows = sqliteTable("flows", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const flowVersions = sqliteTable("flow_versions", {
  id: text("id").primaryKey(),
  flowId: text("flow_id")
    .notNull()
    .references(() => flows.id),
  version: integer("version").notNull(),
  nodesData: text("nodes_data", { mode: "json" }).notNull(),
  edgesData: text("edges_data", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const executions = sqliteTable("executions", {
  id: text("id").primaryKey(),
  flowId: text("flow_id")
    .notNull()
    .references(() => flows.id),
  status: text("status").notNull(), // e.g., 'pending', 'running', 'completed', 'failed'
  startedAt: integer("started_at", { mode: "timestamp" }),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
