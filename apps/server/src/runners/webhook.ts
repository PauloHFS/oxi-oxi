import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import { randomUUID } from "crypto";
import type { Runner } from ".";
import { eq, inArray } from "drizzle-orm";
import { edges } from "@/db/schema/edges";
import { publish, ROUTING_KEYS } from "@/queue";
import { executions } from "@/db/schema/flows";

interface WebhookRunner extends Runner {
  body?: Record<string, any>;
}

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

export const WebhookRunner = async ({
  executionId,
  nodeId,
  body,
}: WebhookRunner) => {
  // 1. Salva o resultado do nó atual (para webhooks, geralmente é o corpo da requisição)
  await db.insert(node_results).values({
    nodeId,
    executionId,
    id: randomUUID(),
    result: JSON.stringify(body || {}),
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
