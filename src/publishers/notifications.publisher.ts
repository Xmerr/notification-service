import type { Channel } from "amqplib";
import type { Logger } from "pino";
import { EXCHANGE, EXCHANGE_DELAY, EXCHANGE_DLQ } from "../config/rabbitmq.js";
import type { DLQMessage, RetryHeaders } from "../types/index.js";

const MAX_RETRIES = 20;
const MAX_BACKOFF_MS = 16 * 60 * 60 * 1000; // 16 hours

function calculateBackoff(retryCount: number): number {
	if (retryCount === 0) return 0;
	const baseDelayMs = 1000;
	const delay = baseDelayMs * 2 ** (retryCount - 1);
	return Math.min(delay, MAX_BACKOFF_MS);
}

export async function publishToRetry(
	channel: Channel,
	routingKey: string,
	content: Buffer,
	currentHeaders: Partial<RetryHeaders>,
	error: Error,
	logger: Logger,
): Promise<void> {
	const retryCount = (currentHeaders["x-retry-count"] ?? 0) + 1;

	if (retryCount > MAX_RETRIES) {
		logger.warn({ routingKey, retryCount }, "Max retries exceeded, publishing to DLQ");
		await publishToDLQ(channel, routingKey, content, retryCount, error, logger);
		return;
	}

	const delay = calculateBackoff(retryCount);
	const headers: RetryHeaders = {
		"x-retry-count": retryCount,
		"x-first-failure-timestamp":
			currentHeaders["x-first-failure-timestamp"] ?? new Date().toISOString(),
		"x-last-error": error.message,
		"x-delay": delay,
	};

	logger.info({ routingKey, retryCount, delay }, "Publishing to retry queue");

	channel.publish(EXCHANGE_DELAY, routingKey, content, {
		persistent: true,
		headers,
	});
}

export async function publishToDLQ(
	channel: Channel,
	routingKey: string,
	content: Buffer,
	retryCount: number,
	error: Error,
	logger: Logger,
): Promise<void> {
	logger.error({ routingKey, retryCount, error: error.message }, "Publishing to DLQ");

	channel.publish(EXCHANGE_DLQ, routingKey, content, { persistent: true });

	const dlqAlert: DLQMessage = {
		service: "notification-service",
		queue: "notifications",
		error: error.message,
		retryCount,
		originalMessage: content.toString().slice(0, 500),
		timestamp: new Date().toISOString(),
		routingKey,
	};

	channel.publish(
		EXCHANGE,
		"notifications.dlq.notification-service",
		Buffer.from(JSON.stringify(dlqAlert)),
		{
			persistent: true,
		},
	);

	logger.info("DLQ alert published");
}

export async function publishDirectToDLQ(
	channel: Channel,
	routingKey: string,
	content: Buffer,
	error: Error,
	logger: Logger,
): Promise<void> {
	await publishToDLQ(channel, routingKey, content, 0, error, logger);
}
