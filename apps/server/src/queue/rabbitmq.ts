import amqp, { type Channel } from "amqplib";

export class RabbitMQClient {
  private static instance: RabbitMQClient;
  private connection: amqp.ChannelModel | null = null;
  private channel: Channel | null = null;
  private readonly amqpUrl: string;
  private readonly exchangeName: string;

  private constructor(amqpUrl: string, exchangeName: string) {
    this.amqpUrl = amqpUrl;
    this.exchangeName = exchangeName;
  }

  public static getInstance(
    amqpUrl: string,
    exchangeName: string
  ): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient(amqpUrl, exchangeName);
    }
    return RabbitMQClient.instance;
  }

  public async connect(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    try {
      this.connection = await amqp.connect(this.amqpUrl, { heartbeat: 30 });
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });

      this.connection.on("close", () => {
        console.error("Conexão com RabbitMQ fechada. Tentando reconectar...");
        this.connection = null;
        this.channel = null;
        setTimeout(() => this.connect(), 5000);
      });

      console.log(
        `[✓] Conectado ao RabbitMQ e exchange '${this.exchangeName}' assertada.`
      );
      return this.channel;
    } catch (error) {
      console.error(
        "Erro ao conectar ou assertar RabbitMQ:",
        (error as Error).message
      );
      this.connection = null;
      this.channel = null;
      throw error;
    }
  }

  public getChannel(): Channel {
    if (!this.channel) {
      throw new Error("Canal não está pronto. Conecte primeiro.");
    }
    return this.channel;
  }

  public async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.channel = null;
    }
  }
}

export class RabbitMQPublisher {
  private channel: amqp.Channel;
  private exchangeName: string;

  constructor(client: RabbitMQClient, exchangeName: string) {
    this.channel = client.getChannel();
    this.exchangeName = exchangeName;
  }

  async publish(routingKey: string, msg: string) {
    if (!this.channel) {
      throw new Error("Canal não está pronto. Conecte primeiro.");
    }

    try {
      const sent = this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(msg)
      );
      if (!sent) {
        await new Promise((resolve) => this.channel.once("drain", resolve));
        await this.channel.publish(
          this.exchangeName,
          routingKey,
          Buffer.from(msg)
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error("Falha na publicação ou confirmação:", error.message);
      } else {
        console.error("Erro desconhecido na publicação.");
      }
      throw error;
    }
  }
}

export class RabbitMQSubscriber {
  private channel: amqp.Channel;
  private queueName: string;
  private exchangeName: string;
  private routingKey: string;

  constructor(
    client: RabbitMQClient,
    queueName: string,
    exchangeName: string,
    routingKey: string
  ) {
    this.channel = client.getChannel();
    this.queueName = queueName;
    this.exchangeName = exchangeName;
    this.routingKey = routingKey;
  }

  public async setup(): Promise<RabbitMQSubscriber> {
    try {
      await this.channel.assertQueue(this.queueName, { durable: true });
      await this.channel.bindQueue(
        this.queueName,
        this.exchangeName,
        this.routingKey
      );
      console.log(
        `[✓] Fila '${this.queueName}' vinculada à exchange '${this.exchangeName}' com routing key '${this.routingKey}'.`
      );
      return this;
    } catch (error) {
      console.error(
        `[✗] Erro ao configurar o subscriber para a fila '${this.queueName}':`,
        (error as Error).message
      );
      throw error;
    }
  }

  public async startConsuming(
    processMessageFn: (message: string) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error("Canal não está pronto. Conecte primeiro.");
    }

    this.channel.consume(this.queueName, async (msg) => {
      if (msg) {
        try {
          const content = msg.content.toString();
          await processMessageFn(content);
          this.channel?.ack(msg);
          console.log(`[✓] Mensagem processada: '${content}'`);
        } catch (error) {
          if (error instanceof Error) {
            console.error(`[✗] Erro no processamento: ${error.message}`);
          } else {
            console.error("[✗] Erro desconhecido no processamento.");
          }
          this.channel?.nack(msg, false, false);
        }
      }
    });
  }
}
