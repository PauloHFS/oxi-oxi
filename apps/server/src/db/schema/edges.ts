import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { flows } from "./flows";
import { nodes } from "./nodes";

export const edges = sqliteTable("edges", {
  id: text("id").primaryKey(),
  flowId: text("flow_id")
    .notNull()
    .references(() => flows.id),
  sourceNodeId: text("source_node_id")
    .notNull()
    .references(() => nodes.id),
  targetNodeId: text("target_node_id")
    .notNull()
    .references(() => nodes.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
