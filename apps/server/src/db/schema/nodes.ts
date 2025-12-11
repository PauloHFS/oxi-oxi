import {
  pgTable,
  text,
  timestamp,
  integer,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { executions, flows } from "./flows";

export const nodes = pgTable("nodes", {
  id: varchar("id").primaryKey(),
  flowId: varchar("flow_id")
    .notNull()
    .references(() => flows.id),
  type: varchar("type").notNull(), // "API", "WEBHOOK", "OLLAMA"
  name: varchar("name").notNull(),
  data: jsonb("data").notNull(),
  positionX: integer("position_x").notNull(),
  positionY: integer("position_y").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const node_results = pgTable("node_results", {
  id: varchar("id").primaryKey(),
  executionId: varchar("execution_id")
    .notNull()
    .references(() => executions.id),
  nodeId: varchar("node_id")
    .notNull()
    .references(() => nodes.id),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});
