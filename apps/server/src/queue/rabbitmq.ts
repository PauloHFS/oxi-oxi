import amqp from "amqplib";
import { EventEmitter } from "events";

export class RabbitMQClient extends EventEmitter {
  private static instance: RabbitMQClient;
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private isConnecting = false;
  private readonly amqpUrl: string;
  private readonly exchangeName: string;

  private constructor(amqpUrl: string, exchangeName: string) {
    super(); // Inicializa o EventEmitter
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

  public async connect(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (this.isConnecting) {
      return this.waitForConnection();
    }

    this.isConnecting = true;
    try {
      this.connection = await amqp.connect(this.amqpUrl, { heartbeat: 30 });
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });

      this.connection.on("close", (err) => {
        console.error(
          "Conexão com RabbitMQ fechada.",
          err ? `Erro: ${err.message}` : ""
        );
        this.handleDisconnect();
      });

      this.connection.on("error", (err) => {
        console.error("Erro na conexão com RabbitMQ.", `Erro: ${err.message}`);
      });

      console.log(
        `[✓] Conectado ao RabbitMQ e exchange '${this.exchangeName}' assertada.`
      );
      this.emit("connected", this.channel); // Emite evento de conexão
      return this.channel;
    } catch (error) {
      console.error(
        "Erro ao conectar ou assertar RabbitMQ:",
        (error as Error).message
      );
      this.handleDisconnect();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  private waitForConnection(): Promise<amqp.Channel> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.channel) {
          clearInterval(checkInterval);
          resolve(this.channel);
        }
      }, 500);
    });
  }

  private handleDisconnect(): void {
    this.connection = null;
    this.channel = null;
    this.emit("disconnected"); // Emite evento de desconexão
    setTimeout(() => this.reconnect(), 5000);
  }

  private async reconnect(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      console.error(
        "Falha na reconexão. Tentando novamente...",
        (error as Error).message
      );
    }
  }
}

export class RabbitMQPublisher {
  private readonly client: RabbitMQClient;
  private readonly exchangeName: string;

  constructor(client: RabbitMQClient, exchangeName: string) {
    this.client = client;
    this.exchangeName = exchangeName;
  }

  async publish(routingKey: string, msg: string): Promise<void> {
    const channel = await this.client.connect();

    try {
      const sent = channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(msg),
        { persistent: true }
      );
      if (!sent) {
        await new Promise<void>((resolve) => channel.once("drain", resolve));
      }
      console.log(`[✓] Mensagem publicada para '${routingKey}'.`);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Falha na publicação:", error.message);
      } else {
        console.error("Erro desconhecido na publicação.");
      }
      throw error;
    }
  }
}

export class RabbitMQSubscriber {
  private readonly client: RabbitMQClient;
  private readonly queueName: string;
  private readonly exchangeName: string;
  private readonly routingKey: string;
  private processMessageFn: (message: string) => Promise<void>;

  constructor(
    client: RabbitMQClient,
    queueName: string,
    exchangeName: string,
    routingKey: string
  ) {
    this.client = client;
    this.queueName = queueName;
    this.exchangeName = exchangeName;
    this.routingKey = routingKey;
    this.processMessageFn = () =>
      new Promise(() => {
        throw new Error("Process Message FN Missing");
      });
  }

  public async setup(): Promise<RabbitMQSubscriber> {
    const channel = await this.client.connect();
    try {
      await channel.assertQueue(this.queueName, { durable: true });
      await channel.bindQueue(
        this.queueName,
        this.exchangeName,
        this.routingKey
      );
      console.log(`[✓] Fila '${this.queueName}' vinculada à exchange.`);
      return this;
    } catch (error) {
      console.error(
        `[✗] Erro ao configurar o subscriber:`,
        (error as Error).message
      );
      throw error;
    }
  }

  public async startConsuming(
    processMessageFn: (message: string) => Promise<void>
  ): Promise<void> {
    this.processMessageFn = processMessageFn;
    await this.registerConsumer();

    // Re-registra o consumidor em caso de reconexão
    this.client.on("connected", () => {
      this.registerConsumer().catch(console.error);
    });
  }

  private async registerConsumer(): Promise<void> {
    const channel = await this.client.connect();
    if (!channel) {
      return; // Retorna se o canal não estiver pronto
    }

    channel.consume(this.queueName, async (msg: amqp.ConsumeMessage | null) => {
      if (msg) {
        try {
          const content = msg.content.toString();
          await this.processMessageFn(content);
          channel.ack(msg);
          console.log(`[✓] Mensagem processada: '${content}'`);
        } catch (error) {
          console.error(`[✗] Erro no processamento:`, (error as Error).message);
          channel.nack(msg, false, false);
        }
      }
    });
  }
}
