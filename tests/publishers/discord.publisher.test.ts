import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import pino from "pino";
import { publishToDiscord } from "../../src/publishers/discord.publisher.js";
import type { SendPostMessage } from "../../src/types/index.js";

const logger = pino({ level: "silent" });

function createMockChannel() {
	return {
		publish: mock(() => true),
	};
}

describe("publishToDiscord", () => {
	let channel: ReturnType<typeof createMockChannel>;

	beforeEach(() => {
		channel = createMockChannel();
	});

	afterEach(() => {
		mock.restore();
	});

	it("should publish message to discord exchange", () => {
		// Arrange
		const message: SendPostMessage = {
			id: "notification-123",
			channel_id: "111111111111111111",
			embed: { title: "Test", color: 0x57f287 },
		};

		// Act
		publishToDiscord(channel as never, message, logger);

		// Assert
		expect(channel.publish).toHaveBeenCalledTimes(1);
		expect(channel.publish).toHaveBeenCalledWith("discord", "post.send", expect.any(Buffer), {
			persistent: true,
		});
	});

	it("should serialize message to JSON buffer", () => {
		// Arrange
		const message: SendPostMessage = {
			id: "notification-456",
			channel_id: "222222222222222222",
			content: "Hello world",
		};

		// Act
		publishToDiscord(channel as never, message, logger);

		// Assert
		const call = channel.publish.mock.calls[0] as [string, string, Buffer, object];
		const publishedBuffer = call[2];
		const parsedMessage = JSON.parse(publishedBuffer.toString());
		expect(parsedMessage).toEqual(message);
	});

	it("should include embed in serialized message", () => {
		// Arrange
		const message: SendPostMessage = {
			id: "notification-789",
			channel_id: "333333333333333333",
			embed: {
				title: "CI Build Succeeded",
				description: "owner/repo",
				color: 0x57f287,
				fields: [{ name: "Status", value: "success", inline: true }],
			},
		};

		// Act
		publishToDiscord(channel as never, message, logger);

		// Assert
		const call = channel.publish.mock.calls[0] as [string, string, Buffer, object];
		const publishedBuffer = call[2];
		const parsedMessage = JSON.parse(publishedBuffer.toString());
		expect(parsedMessage.embed.title).toBe("CI Build Succeeded");
		expect(parsedMessage.embed.fields).toHaveLength(1);
	});

	it("should use persistent delivery mode", () => {
		// Arrange
		const message: SendPostMessage = {
			id: "notification-abc",
			channel_id: "444444444444444444",
		};

		// Act
		publishToDiscord(channel as never, message, logger);

		// Assert
		const call = channel.publish.mock.calls[0] as [string, string, Buffer, { persistent: boolean }];
		expect(call[3].persistent).toBe(true);
	});
});
