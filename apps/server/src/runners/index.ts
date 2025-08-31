import { db } from "@/db";
import { nodes } from "@/db/schema/nodes";
import { eq } from "drizzle-orm";
import { ApiRunner } from "./api";
import { OllamaRunner } from "./ollama";
import { WebhookRunner } from "./webhook";
import { executions } from "@/db/schema/flows";
import { randomUUIDv7 } from "bun";

// TODO refatorar isso aqui pra ficar mais clean e otimizado

export interface Runner {
  nodeId: string;
  executionId: string;
}

export const consumer = async (messageContent: string) => {
  const MESSAGE = JSON.parse(messageContent); // TODO validar isso com zod depois

  const nodeId = MESSAGE.nodeId;

  if (!nodeId) {
    throw new Error("Node ID is missing in the message.");
  }

  const node = await db.select().from(nodes).where(eq(nodes.id, nodeId)).get();

  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found.`);
  }

  let executionId = MESSAGE.executionId;

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

  const payload = MESSAGE.payload;

  if (!["WEBHOOK", "OLLAMA", "API"].includes(node.type)) {
    throw new Error(`Unsupported node type: ${node.type}`);
  }

  console.log(
    `Processing node ${node.id} of type ${node.type} for execution ${executionId}`
  );

  try {
    if (node.type === "WEBHOOK") {
      await WebhookRunner({
        nodeId: node.id,
        executionId,
      });
    } else if (node.type === "OLLAMA") {
      await OllamaRunner({
        nodeId: node.id,
        executionId,
      });
    } else if (node.type === "API") {
      await ApiRunner({
        nodeId: node.id,
        executionId,
      });
    }
  } catch (error) {
    await db
      .update(executions)
      .set({ status: "error", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(executions.id, executionId));
    console.error("Error processing message:", error);
    throw error;
  }
};
