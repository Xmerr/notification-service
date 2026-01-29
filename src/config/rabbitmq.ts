import amqp from "amqplib";
import type { Logger } from "pino";

export interface RabbitMQConnection {
	connection: Awaited<ReturnType<typeof amqp.connect>>;
	channel: amqp.Channel;
}

const EXCHANGE = "notifications";
const EXCHANGE_DLQ = "notifications.dlq";
const EXCHANGE_DELAY = "notifications.delay";
const EXCHANGE_GITHUB = "github";
const QUEUE = "notifications";
const QUEUE_DLQ = "notifications.dlq";

export async function setupRabbitMQ(url: string, logger: Logger): Promise<RabbitMQConnection> {
	logger.info("Connecting to RabbitMQ...");
	const connection = await amqp.connect(url);
	const channel = await connection.createChannel();

	logger.info("Asserting exchanges...");
	await channel.assertExchange(EXCHANGE, "topic", { durable: true });
	await channel.assertExchange(EXCHANGE_DLQ, "topic", { durable: true });
	await channel.assertExchange(EXCHANGE_DELAY, "x-delayed-message", {
		durable: true,
		arguments: { "x-delayed-type": "topic" },
	});
	await channel.assertExchange(EXCHANGE_GITHUB, "topic", { durable: true });

	logger.info("Asserting queues...");
	await channel.assertQueue(QUEUE, { durable: true });
	await channel.assertQueue(QUEUE_DLQ, { durable: true });

	logger.info("Binding queues to exchanges...");
	await channel.bindQueue(QUEUE, EXCHANGE, "#");
	await channel.bindQueue(QUEUE, EXCHANGE_DELAY, "#");
	await channel.bindQueue(QUEUE_DLQ, EXCHANGE_DLQ, "#");

	logger.info("Binding github exchange to notifications exchange...");
	await channel.bindExchange(EXCHANGE, EXCHANGE_GITHUB, "ci.#");
	await channel.bindExchange(EXCHANGE, EXCHANGE_GITHUB, "pr.#");

	await channel.prefetch(10);

	logger.info("RabbitMQ setup complete");
	return { connection, channel };
}

export { EXCHANGE, EXCHANGE_DLQ, EXCHANGE_DELAY, QUEUE };
