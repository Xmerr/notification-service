import type { Channel, ConsumeMessage } from "amqplib";
import type { Logger } from "pino";
import type { Config } from "../config/index.js";
import { QUEUE } from "../config/rabbitmq.js";
import { NonRetryableError, RetryableError } from "../errors/index.js";
import { publishDirectToDLQ, publishToRetry } from "../publishers/notifications.publisher.js";
import { processNotification } from "../services/notifications.service.js";
import type { RetryHeaders } from "../types/index.js";

export async function startConsumer(
	channel: Channel,
	config: Config,
	logger: Logger,
): Promise<void> {
	logger.info({ queue: QUEUE }, "Starting notifications consumer");

	await channel.consume(
		QUEUE,
		async (msg: ConsumeMessage | null) => {
			if (!msg) return;

			const routingKey = msg.fields.routingKey;
			const headers = (msg.properties.headers ?? {}) as Partial<RetryHeaders>;

			logger.debug({ routingKey }, "Received message");

			try {
				const content = msg.content.toString();
				let payload: Record<string, unknown>;

				try {
					payload = JSON.parse(content) as Record<string, unknown>;
				} catch {
					throw new NonRetryableError("Invalid JSON in message payload", "INVALID_JSON");
				}

				await processNotification(routingKey, payload, config, logger);

				channel.ack(msg);
				logger.info({ routingKey }, "Message processed successfully");
			} catch (error) {
				channel.ack(msg);

				if (error instanceof NonRetryableError) {
					logger.error(
						{ routingKey, error: error.message, code: error.code },
						"Non-retryable error",
					);
					await publishDirectToDLQ(channel, routingKey, msg.content, error, logger);
				} else if (error instanceof RetryableError) {
					logger.warn({ routingKey, error: error.message, code: error.code }, "Retryable error");
					await publishToRetry(channel, routingKey, msg.content, headers, error, logger);
				} else {
					const err = error instanceof Error ? error : new Error(String(error));
					logger.error({ routingKey, error: err.message }, "Unexpected error");
					await publishToRetry(channel, routingKey, msg.content, headers, err, logger);
				}
			}
		},
		{ noAck: false },
	);

	logger.info({ queue: QUEUE }, "Consumer started");
}
