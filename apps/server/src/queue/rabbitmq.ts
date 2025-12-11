import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import amqp from "amqp-connection-manager";
import type { Channel, ConsumeMessage } from "amqplib";

// Type for the message processing function remains the same
export type MessageProcessor = (
  channel: Channel,
  message: ConsumeMessage
) => Promise<void>;

// --- Module-scoped state ---
let connection: AmqpConnectionManager;
let publishChannel: ChannelWrapper;
let exchangeName: string;

/**
 * Initializes the connection manager and the main publishing channel.
 * This function should be called once when the application starts.
 * @param amqpUrl The RabbitMQ connection URL.
 * @param exName The name of the topic exchange to use.
 */
export function initializeRabbitMQ(amqpUrl: string, exName: string): void {
  // Prevent re-initialization
  if (connection) {
    return;
  }

  exchangeName = exName;
  connection = amqp.connect([amqpUrl], {
    heartbeatIntervalInSeconds: 30,
  });

  connection.on("connect", () => console.log(`[✓] RabbitMQ: Conectado!`));
  connection.on("disconnect", (err) =>
    console.error("[✗] RabbitMQ: Desconectado.", err?.err.message)
  );

  // Setup a single channel wrapper for publishing and asserting the exchange
  publishChannel = connection.createChannel({
    json: false,
    setup: async (channel: Channel) => {
      await channel.assertExchange(exchangeName, "topic", { durable: true });
      console.log(`[✓] RabbitMQ: Exchange '${exchangeName}' assertada.`);
    },
  });

  console.log("[...] RabbitMQ: Gerenciador de conexão inicializado.");
}

/**
 * Publishes a message to the pre-configured exchange.
 * Messages are published as persistent.
 * @param routingKey The routing key for the message.
 * @param msg The message content (string).
 */
export async function publish(routingKey: string, msg: string): Promise<void> {
  if (!publishChannel) {
    throw new Error(
      "RabbitMQ não foi inicializado. Chame initializeRabbitMQ() primeiro."
    );
  }

  try {
    await publishChannel.publish(exchangeName, routingKey, Buffer.from(msg), {
      persistent: true,
      contentType: "application/json",
    });
    console.log(`[✓] RabbitMQ: Mensagem publicada para '${routingKey}'.`);
  } catch (error) {
    console.error(
      `[✗] RabbitMQ: Falha na publicação para '${routingKey}':`,
      (error as Error).message
    );
    // The channel wrapper handles retries, so we just log the error.
  }
}

/**
 * Sets up a subscriber for a given queue.
 * It creates a dedicated channel for the consumer to manage prefetch and acks independently.
 * @param queueName The name of the queue.
 * @param routingKey The routing key to bind the queue to the exchange.
 * @param processMessage The function to process incoming messages.
 * @param prefetch The number of messages to fetch at a time.
 */
export async function subscribe(
  queueName: string,
  routingKey: string,
  processMessage: MessageProcessor,
  prefetch: number = 10
): Promise<void> {
  if (!connection) {
    throw new Error(
      "RabbitMQ não foi inicializado. Chame initializeRabbitMQ() primeiro."
    );
  }

  connection.createChannel({
    json: false,
    setup: async (channel: Channel) => {
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, exchangeName, routingKey);
      await channel.prefetch(prefetch);
      console.log(
        `[✓] RabbitMQ: Fila '${queueName}' vinculada com prefetch(${prefetch}).`
      );

      await channel.consume(
        queueName,
        async (msg: ConsumeMessage | null) => {
          if (msg) {
            await processMessage(channel, msg);
          }
        },
        {
          noAck: false, // Manual acknowledgment is required
        }
      );
      console.log(`[✓] RabbitMQ: Consumidor iniciado na fila '${queueName}'.`);
    },
  });
}
