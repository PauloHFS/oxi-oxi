// src/queue/index.ts

import {
  RabbitMQClient,
  RabbitMQPublisher,
  RabbitMQSubscriber,
} from "./rabbitmq";
import { consumer } from "../runners"; // Importa o consumer para ser passado à função de setup

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

export const rabbitmqClient = RabbitMQClient.getInstance(
  RABBITMQ_URL,
  RABBITMQ_EXCHANGE
);

export let producer: RabbitMQPublisher | null = null;
export let subscribers: { [key: string]: RabbitMQSubscriber } | null = null;

export async function setupQueue() {
  await rabbitmqClient.connect();

  producer = new RabbitMQPublisher(rabbitmqClient, RABBITMQ_EXCHANGE);
  subscribers = {
    webhook: new RabbitMQSubscriber(
      rabbitmqClient,
      QUEUES.webhook,
      RABBITMQ_EXCHANGE,
      ROUTING_KEYS.webhook
    ),
    api: new RabbitMQSubscriber(
      rabbitmqClient,
      QUEUES.api,
      RABBITMQ_EXCHANGE,
      ROUTING_KEYS.api
    ),
    ollama: new RabbitMQSubscriber(
      rabbitmqClient,
      QUEUES.ollama,
      RABBITMQ_EXCHANGE,
      ROUTING_KEYS.ollama
    ),
  };

  await Promise.all([
    subscribers.webhook.setup().then((s) => s.startConsuming(consumer)),
    subscribers.api.setup().then((s) => s.startConsuming(consumer)),
    subscribers.ollama.setup().then((s) => s.startConsuming(consumer)),
  ]);
}
