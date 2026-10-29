import { Kafka, logLevel, type Consumer } from "kafkajs";

export type KafkaMessageHandler = (topic: string, value: string) => Promise<void>;

export class MarketConsumer {
  private readonly consumer: Consumer;
  private started = false;
  private connected = false;
  private processedMessages = 0;
  private reachedMessageLimit = false;
  private resolveCompletion!: () => void;
  readonly completion = new Promise<void>((resolve) => {
    this.resolveCompletion = resolve;
  });

  constructor(brokers: string[], teamUsername: string, private readonly handle: KafkaMessageHandler) {
    if (!brokers.length || brokers.some((broker) => !broker.trim()))
      throw new Error("At least one configured Kafka broker is required.");
    if (!/^[a-zA-Z0-9._-]+$/.test(teamUsername))
      throw new Error("TEAM_USERNAME contains characters that cannot be used in a Kafka group ID.");
    const kafka = new Kafka({
      clientId: "manthan-edge-local-bot",
      brokers,
      logLevel: logLevel.ERROR,
      connectionTimeout: 2500,
      requestTimeout: 3000,
      retry: { retries: 5, maxRetryTime: 2000 },
    });
    this.consumer = kafka.consumer({ groupId: `group-${teamUsername}` });
  }

  async start(maxEvents?: number): Promise<void> {
    if (this.started) throw new Error("Kafka consumer is already started.");
    if (maxEvents !== undefined && (!Number.isInteger(maxEvents) || maxEvents < 1))
      throw new Error("maxEvents must be a positive integer.");
    await this.consumer.connect();
    this.connected = true;
    try {
      await this.consumer.subscribe({ topic: "market.ticks", fromBeginning: false });
      await this.consumer.subscribe({ topic: "market.news", fromBeginning: false });
      await this.consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
          if (this.reachedMessageLimit) return;
          const value = message.value?.toString("utf8");
          if (value === undefined) {
            console.error(`Skipping empty Kafka message from ${topic}.`);
          } else {
            await this.handle(topic, value);
          }
          await this.consumer.commitOffsets([{
            topic,
            partition,
            offset: (BigInt(message.offset) + 1n).toString(),
          }]);
          this.processedMessages += 1;
          if (maxEvents !== undefined && this.processedMessages >= maxEvents) {
            this.reachedMessageLimit = true;
            this.resolveCompletion();
          }
        },
      });
      this.started = true;
      console.info("Kafka consumer connected and subscribed to market topics.");
    } catch (error) {
      try {
        await this.consumer.disconnect();
      } finally {
        this.connected = false;
        this.resolveCompletion();
      }
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.connected) return;
    this.started = false;
    try {
      if (this.processedMessages > 0) await this.consumer.stop();
      await this.consumer.disconnect();
    } finally {
      this.connected = false;
      this.resolveCompletion();
      console.info("Kafka consumer shut down.");
    }
  }
}
