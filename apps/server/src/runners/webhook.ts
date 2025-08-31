import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import { randomUUID } from "crypto";
import type { Runner } from ".";
import { eq } from "drizzle-orm";
import { edges } from "@/db/schema/edges";
import { producer, ROUTING_KEYS } from "@/queue";

interface WebhookRunner extends Runner {
  body?: Record<string, any>;
}

export const WebhookRunner = async ({
  executionId,
  nodeId,
  body,
}: WebhookRunner) => {
  await db.insert(node_results).values({
    nodeId,
    executionId,
    id: randomUUID(),
    result: JSON.stringify(body || {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const source_edges = await db
    .select()
    .from(edges)
    .where(eq(edges.sourceNodeId, nodeId));

  if (source_edges.length === 0) {
    console.log(`No outgoing edges from node ${nodeId}. Execution ends here.`);
    return;
  }

  // OTIMIZAR ISSO AQUI COM PROMISE.ALL
  for (const edge of source_edges) {
    const targetNode = await db
      .select()
      .from(nodes)
      .where(eq(nodes.id, edge.targetNodeId))
      .get();
    if (!targetNode) {
      console.error(`Target node with ID ${edge.targetNodeId} not found.`);
      continue;
    }
    if (!producer) {
      throw new Error("Producer not initialized");
    }
    await producer.publish(
      ROUTING_KEYS.webhook,
      JSON.stringify({
        nodeId: targetNode.id,
        executionId,
      })
    );
  }
};
