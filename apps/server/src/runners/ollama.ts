import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import { randomUUID } from "crypto";
import type { Runner } from ".";
import { edges } from "@/db/schema/edges";
import { eq, inArray, and } from "drizzle-orm";
import { z } from "zod";
import { executions } from "@/db/schema/flows";
import { producer, ROUTING_KEYS } from "@/queue";

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";

interface OllamaRunner extends Runner {}

export const OllamaRunner = async ({ executionId, nodeId }: OllamaRunner) => {
  const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).get();

  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found.`);
  }
  if (node.type !== "OLLAMA") {
    throw new Error(`Node with ID ${nodeId} is not of type OLLAMA.`);
  }

  const CONFIG = z
    .object({
      prompt: z.string(),
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

  // substituir {{replace}} no prompt pelo resultado do node anterior
  // TODO melhorar isso aqui pra substituir múltiplas ocorrências e talvez permitir mais variáveis
  // Exemplo: https://stackoverflow.com/questions/1144783/replacing-multiple-occurrences-of-a-string-in-javascript
  // ou usar alguma template engine mesmo
  // Exemplo: https://handlebarsjs.com/guide/
  // ou até mesmo regex
  // Exemplo: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressios
  // ou alguma biblioteca tipo mustache
  // Exemplo:

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

  const res_body = await response.json();

  await db.insert(node_results).values({
    nodeId,
    executionId,
    id: randomUUID(),
    result: res_body?.response ?? "",
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
        ROUTING_KEYS.ollama,
        JSON.stringify({
          nodeId: targetNode.id,
          executionId,
        })
      );
    }
  }
};
