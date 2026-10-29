import { Kafka, logLevel, type Consumer } from "kafkajs";

export type KafkaMessageHandler = (topic: string, value: string) => Promise<void>;

export class MarketConsumer {
  private readonly consumer: Consumer;
  private started = false;

  constructor(brokers: string[], teamUsername: string, private readonly handle: KafkaMessageHandler) {
    if (!brokers.length || brokers.some((broker) => !broker.trim()))
      throw new Error("At least one configured Kafka broker is required.");
    if (!/^[a-zA-Z0-9._-]+$/.test(teamUsername))
      throw new Error("TEAM_USERNAME contains characters that cannot be used in a Kafka group ID.");
    const kafka = new Kafka({
      clientId: "manthan-edge-local-bot",
      brokers,
      logLevel: logLevel.ERROR,
    });
    this.consumer = kafka.consumer({ groupId: `group-${teamUsername}` });
  }

  async start(): Promise<void> {
    if (this.started) throw new Error("Kafka consumer is already started.");
    await this.consumer.connect();
    try {
      await this.consumer.subscribe({ topic: "market.ticks", fromBeginning: false });
      await this.consumer.subscribe({ topic: "market.news", fromBeginning: false });
      await this.consumer.run({
        autoCommit: false,
        eachMessage: async ({ topic, partition, message }) => {
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
        },
      });
      this.started = true;
      console.info("Kafka consumer connected and subscribed to market topics.");
    } catch (error) {
      await this.consumer.disconnect();
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    await this.consumer.stop();
    await this.consumer.disconnect();
    console.info("Kafka consumer shut down.");
  }
}
