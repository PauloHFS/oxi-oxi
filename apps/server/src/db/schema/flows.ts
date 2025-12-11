import {
  pgTable,
  text,
  timestamp,
  integer,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

export const flows = pgTable("flows", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const flowVersions = pgTable("flow_versions", {
  id: varchar("id").primaryKey(),
  flowId: varchar("flow_id")
    .notNull()
    .references(() => flows.id),
  version: integer("version").notNull(),
  nodesData: jsonb("nodes_data").notNull(),
  edgesData: jsonb("edges_data").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const executions = pgTable("executions", {
  id: varchar("id").primaryKey(),
  flowId: varchar("flow_id")
    .notNull()
    .references(() => flows.id),
  status: varchar("status").notNull(), // e.g., 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
