import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import { randomUUID } from "crypto";
import type { Runner } from ".";
import { edges } from "@/db/schema/edges";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { executions } from "@/db/schema/flows";
import { publish, ROUTING_KEYS } from "@/queue";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

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

interface OllamaRunnerPayload extends Runner {}

export const OllamaRunner = async ({
  executionId,
  nodeId,
}: OllamaRunnerPayload) => {
  const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).get();

  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found.`);
  }
  if (node.type !== "OLLAMA") {
    throw new Error(`Node with ID ${nodeId} is not of type OLLAMA.`);
  }

  const CONFIG = z.object({ prompt: z.string() }).parse(node.data);

  const incoming_edge = await db
    .select()
    .from(edges)
    .where(eq(edges.targetNodeId, nodeId))
    .limit(1)
    .get();

  if (!incoming_edge) {
    throw new Error(`No incoming edge found for node ${nodeId}`);
  }

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

  const injectedPrompt = CONFIG.prompt.replace(
    "{{ replace }}",
    previousNodeResult.result ? JSON.stringify(previousNodeResult.result) : ""
  );

  const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
    method: "POST",
    body: JSON.stringify({
      model: "qwen3:1.7b",
      prompt: injectedPrompt,
      stream: false,
    }),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Ollama API request failed with status ${response.status}: ${await response.text()}`
    );
  }

  const res_body = await response.json();

  // 1. Salva o resultado do nó atual
  await db.insert(node_results).values({
    nodeId,
    executionId,
    id: randomUUID(),
    result: res_body?.response ?? "",
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
