import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { flows } from "./flows";
import { nodes } from "./nodes";

export const edges = pgTable("edges", {
  id: varchar("id").primaryKey(),
  flowId: varchar("flow_id")
    .notNull()
    .references(() => flows.id),
  sourceNodeId: varchar("source_node_id")
    .notNull()
    .references(() => nodes.id),
  targetNodeId: varchar("target_node_id")
    .notNull()
    .references(() => nodes.id),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
