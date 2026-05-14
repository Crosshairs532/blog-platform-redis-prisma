// src/config/rabbitmq.ts
import amqp from "amqplib";

class RabbitMQService {
  private connection: any;
  private channel: any;

  async init() {
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL || "amqp://localhost",
      );
      this.channel = await this.connection.createChannel();

      // Queues Assert
      await this.channel.assertQueue("post_fanout_queue", { durable: true });
      await this.channel.assertQueue("notification_queue", { durable: true });
      await this.channel.assertQueue("cache_invalidation", { durable: true });

      console.log("✅ RabbitMQ Connected and Queues Asserted");
    } catch (error) {
      console.error("❌ RabbitMQ Connection Failed:", error);
      process.exit(1);
    }
  }

  getChannel() {
    if (!this.channel) {
      throw new Error(
        "RabbitMQ Channel is not initialized. Call init() first.",
      );
    }
    return this.channel;
  }
}

export const rabbitMQ = new RabbitMQService();
