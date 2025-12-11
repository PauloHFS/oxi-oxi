import { initializeRabbitMQ, subscribe, publish } from "./rabbitmq";
import { consumer } from "../runners";

export const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://user:password@localhost:5672";
export const RABBITMQ_EXCHANGE = "task_exchange";

export const ROUTING_KEYS = {
  webhook: "webhook.request",
  api: "api.request",
  ollama: "ollama.request",
};

export const QUEUES = {
  webhook: "webhook_queue",
  api: "api_queue",
  ollama: "ollama_queue",
};


// Re-export the publish function so other modules can use it
export { publish };

/**
 * Sets up the entire queue topology and starts the consumers.
 */
export async function setupQueue() {
  console.log("[...] Configurando as filas e consumidores do RabbitMQ...");

  // 1. Initialize the connection and the main exchange
  initializeRabbitMQ(RABBITMQ_URL, RABBITMQ_EXCHANGE);

  const prefetchCount = 10; // Number of messages a consumer can handle at once

  // 2. Set up all subscribers in parallel
  await Promise.all([
    subscribe(
      QUEUES.webhook,
      ROUTING_KEYS.webhook,
      consumer,
      prefetchCount
    ),
    subscribe(QUEUES.api, ROUTING_KEYS.api, consumer, prefetchCount),
    subscribe(
      QUEUES.ollama,
      ROUTING_KEYS.ollama,
      consumer,
      prefetchCount
    ),
  ]);

  console.log("[✓] Todos os consumidores foram configurados com sucesso.");
}
