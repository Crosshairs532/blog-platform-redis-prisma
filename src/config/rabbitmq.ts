import amqp from "amqplib";

class RabbitMQService {
  private connection: any;
  private channel: any;

  async init() {
    this.connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://localhost",
    );
    this.channel = await this.connection.createChannel();

    // Assert Queues
    await this.channel.assertQueue("post_fanout_queue", { durable: true });
    await this.channel.assertQueue("notification_queue", { durable: true });

    console.log(" RabbitMQ Connected and Queues Asserted");
  }

  getChannel() {
    return this.channel;
  }
}

export const rabbitMQ = new RabbitMQService();
