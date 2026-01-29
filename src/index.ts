import pino from "pino";
import { loadConfig } from "./config/index.js";
import { setupRabbitMQ } from "./config/rabbitmq.js";
import { startConsumer } from "./consumers/notifications.consumer.js";

const config = loadConfig();

const transports: pino.TransportTargetOptions[] = [
	{
		target: "pino-pretty",
		options: { colorize: true },
	},
];

if (config.loki.host) {
	transports.push({
		target: "pino-loki",
		options: {
			host: config.loki.host,
			labels: {
				job: "notification-service",
				environment: process.env["NODE_ENV"] ?? "development",
			},
			batching: true,
			interval: 5,
		},
	});
}

const logger = pino({
	level: config.logLevel,
	transport: { targets: transports },
});

async function main(): Promise<void> {
	logger.info("Starting notification service...");

	const { connection, channel } = await setupRabbitMQ(config.rabbitmq.url, logger);

	await startConsumer(channel, config, logger);

	const shutdown = async (): Promise<void> => {
		logger.info("Shutting down...");
		await channel.close();
		await connection.close();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	logger.info("Notification service started");
}

main().catch((error) => {
	logger.fatal({ error }, "Failed to start notification service");
	process.exit(1);
});
