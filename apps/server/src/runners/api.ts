import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import type { Runner } from ".";
import { randomUUIDv7 } from "bun";
import { edges } from "@/db/schema/edges";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { executions } from "@/db/schema/flows";
import { publish, ROUTING_KEYS } from "@/queue";

const getNodeRoutingKey = (nodeType: string): string => {
  switch (nodeType) {
    case "API":
      return ROUTING_KEYS.api;
    case "OLLAMA":
      return ROUTING_KEYS.ollama;
    case "WEBHOOK":
      return ROUTING_KEYS.webhook;
    default:
      throw new Error(`Tipo de nó desconhecido para roteamento: ${nodeType}`);
  }
};

interface ApiRunnerPayload extends Runner {}

export const ApiRunner = async ({ executionId, nodeId }: ApiRunnerPayload) => {
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

  // Pega o id do node anterior
  const incoming_edge = await db
    .select()
    .from(edges)
    .where(eq(edges.targetNodeId, nodeId))
    .limit(1)
    .get();

  if (!incoming_edge) {
    throw new Error(`No incoming edge found for node ${nodeId}`);
  }

  // Pegar o resultado do node anterior
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
  }

  const response = await fetch(CONFIG.url, {
    method: CONFIG.method,
    headers: { ...CONFIG.headers, "Content-Type": "application/json" },
    body: injectedBody,
  });

  if (!response.ok) {
    // Apenas lançamos o erro. O consumidor principal cuidará de NACK e logging.
    throw new Error(
      `API request failed with status ${response.status}: ${response.statusText}`
    );
  }

  const res_body = await response.json();

  // 1. Salva o resultado do nó atual
  await db.insert(node_results).values({
    nodeId,
    executionId,
    id: randomUUIDv7(),
    result: JSON.stringify(res_body),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // 2. Encontra todas as arestas de saída para encadear as próximas tarefas
  const source_edges = await db
    .select({ targetNodeId: edges.targetNodeId })
    .from(edges)
    .where(eq(edges.sourceNodeId, nodeId));

  if (source_edges.length === 0) {
    console.log(`[|] Fim do fluxo no nó ${nodeId}. Execução concluída.`);
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

  // 3. Busca os detalhes de todos os nós de destino de uma vez
  const targetNodeIds = source_edges.map((edge) => edge.targetNodeId);
  const targetNodes = await db
    .select({ id: nodes.id, type: nodes.type })
    .from(nodes)
    .where(inArray(nodes.id, targetNodeIds));

  // 4. Publica uma nova mensagem para cada nó de destino em paralelo
  const publishPromises = targetNodes.map((node) => {
    const routingKey = getNodeRoutingKey(node.type);
    return publish(
      routingKey,
      JSON.stringify({
        nodeId: node.id,
        executionId,
      })
    );
  });

  await Promise.all(publishPromises);
};
