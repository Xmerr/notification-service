import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import pino from "pino";
import type { Config } from "../../src/config/index.js";
import * as channelRouterModule from "../../src/discord/channel-router.js";
import * as formatterModule from "../../src/discord/formatter.js";
import * as discordPublisherModule from "../../src/publishers/discord.publisher.js";
import { processNotification } from "../../src/services/notifications.service.js";

const logger = pino({ level: "silent" });

function createConfig(): Config {
	return {
		rabbitmq: { url: "amqp://localhost" },
		discord: {
			channels: {
				default: "100000000000000000",
				info: "111111111111111111",
				errors: "222222222222222222",
			},
			routes: { ci: "info" },
			errorRoutes: ["ci.failure"],
			defaultChannel: "100000000000000000",
		},
		loki: { host: undefined },
		logLevel: "info",
	};
}

function createMockChannel() {
	return {
		publish: mock(() => true),
	};
}

describe("processNotification", () => {
	let channel: ReturnType<typeof createMockChannel>;
	let publishToDiscordSpy: ReturnType<typeof spyOn>;
	let getChannelIdsSpy: ReturnType<typeof spyOn>;
	let formatEmbedSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		channel = createMockChannel();
		publishToDiscordSpy = spyOn(discordPublisherModule, "publishToDiscord").mockImplementation(
			() => {},
		);
		getChannelIdsSpy = spyOn(channelRouterModule, "getChannelIds").mockReturnValue([
			"111111111111111111",
		]);
		formatEmbedSpy = spyOn(formatterModule, "formatEmbed").mockReturnValue({
			title: "Test",
			color: 0x57f287,
		});
	});

	afterEach(() => {
		mock.restore();
	});

	it("should process notification and publish to discord", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		expect(publishToDiscordSpy).toHaveBeenCalledTimes(1);
	});

	it("should publish to multiple channels for error routes", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };
		getChannelIdsSpy.mockReturnValue(["111111111111111111", "222222222222222222"]);

		// Act
		processNotification("ci.failure", payload, config, channel as never, logger);

		// Assert
		expect(publishToDiscordSpy).toHaveBeenCalledTimes(2);
	});

	it("should call formatEmbed with correct arguments", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		expect(formatEmbedSpy).toHaveBeenCalledWith("ci.success", payload);
	});

	it("should call getChannelIds with correct arguments", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		expect(getChannelIdsSpy).toHaveBeenCalledWith("ci.success", config);
	});

	it("should generate unique correlation IDs for each message", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo" };
		getChannelIdsSpy.mockReturnValue(["111111111111111111", "222222222222222222"]);

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		const firstCall = publishToDiscordSpy.mock.calls[0] as [unknown, { id: string }, unknown];
		const secondCall = publishToDiscordSpy.mock.calls[1] as [unknown, { id: string }, unknown];
		expect(firstCall[1].id).toMatch(/^notification-/);
		expect(secondCall[1].id).toMatch(/^notification-/);
		expect(firstCall[1].id).not.toBe(secondCall[1].id);
	});

	it("should include correct channel_id in published message", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo" };
		getChannelIdsSpy.mockReturnValue(["444444444444444444"]);

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		const call = publishToDiscordSpy.mock.calls[0] as [unknown, { channel_id: string }, unknown];
		expect(call[1].channel_id).toBe("444444444444444444");
	});

	it("should include embed in published message", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo" };
		const testEmbed = { title: "CI Build Succeeded", color: 0x57f287 };
		formatEmbedSpy.mockReturnValue(testEmbed);

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		const call = publishToDiscordSpy.mock.calls[0] as [
			unknown,
			{ embed: { title: string; color: number } },
			unknown,
		];
		expect(call[1].embed).toEqual(testEmbed);
	});
});
