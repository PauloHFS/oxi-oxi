import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import type { Runner } from ".";
import { randomUUIDv7 } from "bun";
import { edges } from "@/db/schema/edges";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { executions } from "@/db/schema/flows";
import { producer, ROUTING_KEYS } from "@/queue";

interface ApiRunner extends Runner {}

export const ApiRunner = async ({ executionId, nodeId }: ApiRunner) => {
  const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).get();

  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found.`);
  }
  if (node.type !== "API") {
    throw new Error(`Node with ID ${nodeId} is not of type API.`);
  }

  const CONFIG = z
    .object({
      url: z.url(),
      body: z.record(z.string(), z.any()).optional(),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
      headers: z.record(z.string(), z.string()).optional(),
    })
    .parse(node.data);

  // pega o id do node anterior
  const incoming_edge = await db
    .select()
    .from(edges)
    .where(eq(edges.targetNodeId, nodeId))
    .limit(1)
    .get();

  if (!incoming_edge) {
    throw new Error(`No incoming edge found for node ${nodeId}`);
  }

  // pegar o resultado do node anterior
  const previousNodeResult = await db
    .select()
    .from(node_results)
    .where(
      and(
        eq(node_results.executionId, executionId),
        eq(node_results.nodeId, incoming_edge.sourceNodeId)
      )
    )
    .orderBy(node_results.createdAt)
    .limit(1)
    .get();

  if (!previousNodeResult) {
    throw new Error(
      `No previous node result found for execution ${executionId} and node ${incoming_edge.sourceNodeId}`
    );
  }

  let injectedBody;

  if (CONFIG.body) {
    // Deep clone para manipular objetos/arrays aninhados com segurança
    const tempBody = JSON.parse(JSON.stringify(CONFIG.body));

    if (
      Array.isArray(tempBody.embeds) &&
      tempBody.embeds.length > 0 &&
      typeof tempBody.embeds[0].description === "string"
    ) {
      const description = tempBody.embeds[0].description;
      tempBody.embeds[0].description = description
        .replace("{{ replace }}", previousNodeResult.result as string)
        .replace(/^<think>[\s\S]*?<\/think>\s*/, "");
    }

    injectedBody = JSON.stringify(tempBody);
  } else {
    injectedBody = undefined;
  }

  const response = await fetch(CONFIG.url, {
    method: CONFIG.method,
    headers: { ...CONFIG.headers, "Content-Type": "application/json" },
    body: injectedBody,
  });

  if (!response.ok) {
    Promise.all([
      db.insert(node_results).values({
        nodeId,
        executionId,
        id: randomUUIDv7(),
        result: JSON.stringify({
          status: response.status,
          statusText: response.statusText,
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      db
        .update(executions)
        .set({
          status: "error",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(executions.id, executionId)),
    ]);
    throw new Error(
      `API request failed with status ${response.status}: ${response.statusText}`
    );
  }

  const res_body = await response.json();

  await db.insert(node_results).values({
    nodeId,
    executionId,
    id: randomUUIDv7(),
    result: JSON.stringify(res_body),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const source_edges = await db
    .select()
    .from(edges)
    .where(eq(edges.sourceNodeId, nodeId));

  if (source_edges.length === 0) {
    console.log(`No outgoing edges from node ${nodeId}. Execution ends here.`);
    await db
      .update(executions)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(executions.id, executionId));
    return;
  }

  const targetNodeIds = source_edges.map((edge) => edge.targetNodeId);

  if (targetNodeIds.length > 0) {
    const targetNodes = await db
      .select()
      .from(nodes)
      .where(inArray(nodes.id, targetNodeIds))
      .all();

    const nodesMap = new Map(targetNodes.map((node) => [node.id, node]));

    // MIGRAR ISSO AQUI PARA PROMISE.ALL?
    for (const edge of source_edges) {
      const targetNode = nodesMap.get(edge.targetNodeId);

      if (!targetNode) {
        console.error(`Target node with ID ${edge.targetNodeId} not found.`);
        continue;
      }

      if (!producer) {
        throw new Error("Producer not initialized");
      }
      await producer.publish(
        ROUTING_KEYS.api,
        JSON.stringify({
          nodeId: targetNode.id,
          executionId,
        })
      );
    }
  }
};
