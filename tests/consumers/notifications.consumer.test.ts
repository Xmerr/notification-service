import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import pino from "pino";
import type { Config } from "../../src/config/index.js";
import { startConsumer } from "../../src/consumers/notifications.consumer.js";
import { NonRetryableError, RetryableError } from "../../src/errors/index.js";
import * as publisherModule from "../../src/publishers/notifications.publisher.js";
import * as serviceModule from "../../src/services/notifications.service.js";

const logger = pino({ level: "silent" });

function createConfig(): Config {
	return {
		rabbitmq: { url: "amqp://localhost" },
		discord: {
			channels: { default: "100000000000000000" },
			routes: {},
			errorRoutes: [],
			defaultChannel: "100000000000000000",
		},
		loki: { host: undefined },
		logLevel: "info",
	};
}

function createMockChannel() {
	let messageHandler: ((msg: unknown) => Promise<void>) | null = null;

	return {
		consume: mock((_queue: string, handler: (msg: unknown) => Promise<void>) => {
			messageHandler = handler;
			return Promise.resolve();
		}),
		ack: mock(() => {}),
		publish: mock(() => true),
		getMessageHandler: () => messageHandler,
	};
}

function createMessage(content: object, routingKey: string, headers: object = {}) {
	return {
		content: Buffer.from(JSON.stringify(content)),
		fields: { routingKey },
		properties: { headers },
	};
}

describe("startConsumer", () => {
	let channel: ReturnType<typeof createMockChannel>;
	let processNotificationSpy: ReturnType<typeof spyOn>;
	let publishToRetrySpy: ReturnType<typeof spyOn>;
	let publishDirectToDLQSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		channel = createMockChannel();
		processNotificationSpy = spyOn(serviceModule, "processNotification").mockImplementation(
			() => {},
		);
		publishToRetrySpy = spyOn(publisherModule, "publishToRetry").mockResolvedValue(undefined);
		publishDirectToDLQSpy = spyOn(publisherModule, "publishDirectToDLQ").mockResolvedValue(
			undefined,
		);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should start consuming from queue", async () => {
		// Arrange
		const config = createConfig();

		// Act
		await startConsumer(channel as never, config, logger);

		// Assert
		expect(channel.consume).toHaveBeenCalledTimes(1);
		expect(channel.consume).toHaveBeenCalledWith("notifications", expect.any(Function), {
			noAck: false,
		});
	});

	it("should process valid messages and ack", async () => {
		// Arrange
		const config = createConfig();
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;
		const message = createMessage({ test: "data" }, "ci.success");

		// Act
		await handler(message);

		// Assert
		expect(processNotificationSpy).toHaveBeenCalledWith(
			"ci.success",
			{ test: "data" },
			config,
			channel,
			logger,
		);
		expect(channel.ack).toHaveBeenCalledWith(message);
	});

	it("should handle null messages", async () => {
		// Arrange
		const config = createConfig();
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;

		// Act
		await handler(null);

		// Assert
		expect(processNotificationSpy).not.toHaveBeenCalled();
		expect(channel.ack).not.toHaveBeenCalled();
	});

	it("should send invalid JSON to DLQ", async () => {
		// Arrange
		const config = createConfig();
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;
		const message = {
			content: Buffer.from("not valid json"),
			fields: { routingKey: "test.route" },
			properties: { headers: {} },
		};

		// Act
		await handler(message);

		// Assert
		expect(channel.ack).toHaveBeenCalledWith(message);
		expect(publishDirectToDLQSpy).toHaveBeenCalled();
		const errorArg = publishDirectToDLQSpy.mock.calls[0]?.[3] as NonRetryableError;
		expect(errorArg).toBeInstanceOf(NonRetryableError);
		expect(errorArg.code).toBe("INVALID_JSON");
	});

	it("should retry on RetryableError", async () => {
		// Arrange
		const config = createConfig();
		processNotificationSpy.mockImplementation(() => {
			throw new RetryableError("Network error", "NETWORK_ERROR");
		});
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;
		const message = createMessage({ test: "data" }, "ci.success", { "x-retry-count": 1 });

		// Act
		await handler(message);

		// Assert
		expect(channel.ack).toHaveBeenCalledWith(message);
		expect(publishToRetrySpy).toHaveBeenCalled();
	});

	it("should send NonRetryableError directly to DLQ", async () => {
		// Arrange
		const config = createConfig();
		processNotificationSpy.mockImplementation(() => {
			throw new NonRetryableError("Bad request", "CLIENT_ERROR");
		});
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;
		const message = createMessage({ test: "data" }, "ci.success");

		// Act
		await handler(message);

		// Assert
		expect(channel.ack).toHaveBeenCalledWith(message);
		expect(publishDirectToDLQSpy).toHaveBeenCalled();
	});

	it("should treat unexpected errors as retryable", async () => {
		// Arrange
		const config = createConfig();
		processNotificationSpy.mockImplementation(() => {
			throw new Error("Unexpected error");
		});
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;
		const message = createMessage({ test: "data" }, "ci.success");

		// Act
		await handler(message);

		// Assert
		expect(channel.ack).toHaveBeenCalledWith(message);
		expect(publishToRetrySpy).toHaveBeenCalled();
	});

	it("should treat non-Error throws as retryable", async () => {
		// Arrange
		const config = createConfig();
		processNotificationSpy.mockImplementation(() => {
			throw "string error";
		});
		await startConsumer(channel as never, config, logger);
		const handler = channel.getMessageHandler()!;
		const message = createMessage({ test: "data" }, "ci.success");

		// Act
		await handler(message);

		// Assert
		expect(channel.ack).toHaveBeenCalledWith(message);
		expect(publishToRetrySpy).toHaveBeenCalled();
	});
});
