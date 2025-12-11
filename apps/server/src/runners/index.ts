import { db } from "@/db";
import { node_results, nodes } from "@/db/schema/nodes";
import { eq, and } from "drizzle-orm";
import { ApiRunner } from "./api";
import { OllamaRunner } from "./ollama";
import { WebhookRunner } from "./webhook";
import { executions } from "@/db/schema/flows";
import { randomUUIDv7 } from "bun";
import type { MessageProcessor } from "@/queue/rabbitmq";
import type { ConsumeMessage } from "amqplib";

// TODO refatorar isso aqui pra ficar mais clean e otimizado

export interface Runner {
  nodeId: string;
  executionId: string;
}

export const consumer: MessageProcessor = async (channel, msg) => {
  if (!msg) {
    console.warn("[!] Mensagem nula recebida, ignorando.");
    return;
  }

  let executionId: string | undefined;
  let nodeId: string | undefined;

  try {
    const messageContent = msg.content.toString();
    const MESSAGE = JSON.parse(messageContent); // TODO validar isso com zod depois

    nodeId = MESSAGE.nodeId;
    if (!nodeId) {
      console.error("[✗] Node ID está faltando na mensagem. Rejeitando.");
      channel.nack(msg, false, false); // Do not requeue if data is malformed
      return;
    }

    executionId = MESSAGE.executionId;

    // Se a execução já existe, verifica se o nó já foi processado (IDEMPOTÊNCIA)
    if (executionId) {
      const existingResult = await db
        .select({ id: node_results.id })
        .from(node_results)
        .where(
          and(
            eq(node_results.nodeId, nodeId),
            eq(node_results.executionId, executionId)
          )
        )
        .get();

      if (existingResult) {
        console.warn(
          `[!] Tarefa duplicada recebida para o nó ${nodeId} na execução ${executionId}. Ignorando.`
        );
        channel.ack(msg); // Confirma e remove a mensagem duplicada da fila
        return;
      }
    }

    const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).get();
    if (!node) {
      console.error(`[✗] Node com ID ${nodeId} não encontrado. Rejeitando.`);
      channel.nack(msg, false, false); // Do not requeue, node is missing
      return;
    }

    // Se não há ID de execução, é o início de um novo fluxo.
    if (!executionId) {
      executionId = randomUUIDv7();
      await db.insert(executions).values({
        id: executionId,
        flowId: node.flowId,
        status: "running",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (!["WEBHOOK", "OLLAMA", "API"].includes(node.type)) {
      console.error(`[✗] Tipo de node não suportado: ${node.type}. Rejeitando.`);
      channel.nack(msg, false, false); // Do not requeue for unsupported types
      return;
    }

    console.log(
      `[>] Processando node ${node.id} (Tipo: ${node.type}) para execução ${executionId}`
    );

    // Dispatch to the correct runner
    const runnerPayload = { nodeId: node.id, executionId: executionId };
    switch (node.type) {
      case "WEBHOOK":
        await WebhookRunner(runnerPayload);
        break;
      case "OLLAMA":
        await OllamaRunner(runnerPayload);
        break;
      case "API":
        await ApiRunner(runnerPayload);
        break;
    }

    // Acknowledge the message on successful processing of the task AND its chaining
    channel.ack(msg);
    console.log(`[✓] Mensagem para o node ${nodeId} processada com sucesso.`);
  } catch (error) {
    console.error(
      `[✗] Erro ao processar a mensagem para o nó ${nodeId} na execução ${executionId}:`,
      (error as Error).message
    );
    // Requeue the message for a retry, useful for transient errors
    channel.nack(msg, false, true);
  }
};
