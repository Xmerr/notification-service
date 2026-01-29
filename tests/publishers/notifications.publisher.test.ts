import { beforeEach, describe, expect, it, mock } from "bun:test";
import pino from "pino";
import {
	publishDirectToDLQ,
	publishToRetry,
} from "../../src/publishers/notifications.publisher.js";

const logger = pino({ level: "silent" });

type PublishCall = [
	string,
	string,
	Buffer,
	{ persistent: boolean; headers?: Record<string, unknown> },
];

function createMockChannel() {
	return {
		publish: mock(() => true) as ReturnType<typeof mock> & { mock: { calls: PublishCall[] } },
	};
}

describe("publishToRetry", () => {
	let channel: ReturnType<typeof createMockChannel>;

	beforeEach(() => {
		channel = createMockChannel();
	});

	it("should publish to delay exchange with incremented retry count", async () => {
		// Arrange
		const content = Buffer.from(JSON.stringify({ test: "data" }));
		const headers = { "x-retry-count": 0 };
		const error = new Error("Test error");

		// Act
		await publishToRetry(channel as never, "test.routing", content, headers, error, logger);

		// Assert
		expect(channel.publish).toHaveBeenCalledTimes(1);
		const call = channel.publish.mock.calls[0];
		expect(call?.[0]).toBe("notifications.delay");
		expect(call?.[1]).toBe("test.routing");
		expect(call?.[3]?.headers?.["x-retry-count"]).toBe(1);
	});

	it("should set first failure timestamp on first retry", async () => {
		// Arrange
		const content = Buffer.from("{}");
		const headers = {};
		const error = new Error("Test error");

		// Act
		await publishToRetry(channel as never, "test.routing", content, headers, error, logger);

		// Assert
		const call = channel.publish.mock.calls[0];
		expect(call?.[3]?.headers?.["x-first-failure-timestamp"]).toBeDefined();
	});

	it("should preserve first failure timestamp on subsequent retries", async () => {
		// Arrange
		const content = Buffer.from("{}");
		const originalTimestamp = "2024-01-01T00:00:00.000Z";
		const headers = {
			"x-retry-count": 5,
			"x-first-failure-timestamp": originalTimestamp,
		};
		const error = new Error("Test error");

		// Act
		await publishToRetry(channel as never, "test.routing", content, headers, error, logger);

		// Assert
		const call = channel.publish.mock.calls[0];
		expect(call?.[3]?.headers?.["x-first-failure-timestamp"]).toBe(originalTimestamp);
	});

	it("should calculate exponential backoff delay", async () => {
		// Arrange
		const content = Buffer.from("{}");
		const error = new Error("Test error");

		// Act - passing 0 results in retry count 1 after increment, delay = 1000 * 2^0 = 1000ms
		await publishToRetry(
			channel as never,
			"test.routing",
			content,
			{ "x-retry-count": 0 },
			error,
			logger,
		);

		// Assert
		const call1 = channel.publish.mock.calls[0];
		expect(call1?.[3]?.headers?.["x-delay"]).toBe(1000);

		// Act - passing 2 results in retry count 3 after increment, delay = 1000 * 2^2 = 4000ms
		channel.publish.mockClear();
		await publishToRetry(
			channel as never,
			"test.routing",
			content,
			{ "x-retry-count": 2 },
			error,
			logger,
		);

		const call2 = channel.publish.mock.calls[0];
		expect(call2?.[3]?.headers?.["x-delay"]).toBe(4000);
	});

	it("should cap backoff at 16 hours", async () => {
		// Arrange
		const content = Buffer.from("{}");
		const headers = { "x-retry-count": 19 };
		const error = new Error("Test error");
		const maxBackoff = 16 * 60 * 60 * 1000;

		// Act
		await publishToRetry(channel as never, "test.routing", content, headers, error, logger);

		// Assert
		const call = channel.publish.mock.calls[0];
		expect(call?.[3]?.headers?.["x-delay"]).toBe(maxBackoff);
	});

	it("should publish to DLQ after max retries exceeded", async () => {
		// Arrange
		const content = Buffer.from(JSON.stringify({ test: "data" }));
		const headers = { "x-retry-count": 20 };
		const error = new Error("Test error");

		// Act
		await publishToRetry(channel as never, "test.routing", content, headers, error, logger);

		// Assert
		expect(channel.publish).toHaveBeenCalledTimes(2);
		const dlqCall = channel.publish.mock.calls[0];
		expect(dlqCall?.[0]).toBe("notifications.dlq");
	});
});

describe("publishDirectToDLQ", () => {
	let channel: ReturnType<typeof createMockChannel>;

	beforeEach(() => {
		channel = createMockChannel();
	});

	it("should publish to DLQ exchange", async () => {
		// Arrange
		const content = Buffer.from("{}");
		const error = new Error("Invalid message");

		// Act
		await publishDirectToDLQ(channel as never, "test.routing", content, error, logger);

		// Assert
		expect(channel.publish).toHaveBeenCalledTimes(2);
		const dlqCall = channel.publish.mock.calls[0];
		expect(dlqCall?.[0]).toBe("notifications.dlq");
		expect(dlqCall?.[1]).toBe("test.routing");
	});

	it("should publish DLQ alert to notifications exchange", async () => {
		// Arrange
		const content = Buffer.from(JSON.stringify({ original: "message" }));
		const error = new Error("Processing failed");

		// Act
		await publishDirectToDLQ(channel as never, "test.routing", content, error, logger);

		// Assert
		const alertCall = channel.publish.mock.calls[1];
		expect(alertCall?.[0]).toBe("notifications");
		expect(alertCall?.[1]).toBe("notifications.dlq.notification-service");

		const alertPayload = JSON.parse(alertCall?.[2]?.toString() ?? "{}");
		expect(alertPayload.service).toBe("notification-service");
		expect(alertPayload.queue).toBe("notifications");
		expect(alertPayload.error).toBe("Processing failed");
		expect(alertPayload.routingKey).toBe("test.routing");
	});

	it("should truncate long original messages in DLQ alert", async () => {
		// Arrange
		const longMessage = "x".repeat(1000);
		const content = Buffer.from(longMessage);
		const error = new Error("Test");

		// Act
		await publishDirectToDLQ(channel as never, "test.routing", content, error, logger);

		// Assert
		const alertCall = channel.publish.mock.calls[1];
		const alertPayload = JSON.parse(alertCall?.[2]?.toString() ?? "{}");
		expect(alertPayload.originalMessage.length).toBeLessThanOrEqual(500);
	});
});
