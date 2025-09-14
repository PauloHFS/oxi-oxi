import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { executions, flows } from "./flows";

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  flowId: text("flow_id")
    .notNull()
    .references(() => flows.id),
  type: text("type").notNull(), // "API", "WEBHOOK", "OLLAMA"
  name: text("name").notNull(),
  data: text("data", { mode: "json" }).notNull(),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const node_results = sqliteTable("node_results", {
  id: text("id").primaryKey(),
  executionId: text("execution_id")
    .notNull()
    .references(() => executions.id),
  nodeId: text("node_id")
    .notNull()
    .references(() => nodes.id),
  result: text("result", { mode: "json" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
