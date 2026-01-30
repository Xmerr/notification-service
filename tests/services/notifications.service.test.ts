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
			infoChannel: "info-channel-id",
			warnChannel: "warn-channel-id",
			errorChannel: "error-channel-id",
			criticalChannel: "critical-channel-id",
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
	let getChannelIdSpy: ReturnType<typeof spyOn>;
	let formatEmbedSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		channel = createMockChannel();
		publishToDiscordSpy = spyOn(discordPublisherModule, "publishToDiscord").mockImplementation(
			() => {},
		);
		getChannelIdSpy = spyOn(channelRouterModule, "getChannelId").mockReturnValue("info-channel-id");
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

	it("should call formatEmbed with correct arguments", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		expect(formatEmbedSpy).toHaveBeenCalledWith("ci.success", payload);
	});

	it("should call getChannelId with correct arguments", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		expect(getChannelIdSpy).toHaveBeenCalledWith("ci.success", config);
	});

	it("should generate unique correlation ID", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo" };

		// Act
		processNotification("ci.success", payload, config, channel as never, logger);

		// Assert
		const call = publishToDiscordSpy.mock.calls[0] as [unknown, { id: string }, unknown];
		expect(call[1].id).toMatch(/^notification-/);
	});

	it("should include correct channel_id in published message", () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo" };
		getChannelIdSpy.mockReturnValue("warn-channel-id");

		// Act
		processNotification("warn.diskspace", payload, config, channel as never, logger);

		// Assert
		const call = publishToDiscordSpy.mock.calls[0] as [unknown, { channel_id: string }, unknown];
		expect(call[1].channel_id).toBe("warn-channel-id");
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

	it("should route to different channels based on severity", () => {
		// Arrange
		const config = createConfig();
		const payload = { volume: "/share/Downloads", used_percent: 82 };

		// Act
		getChannelIdSpy.mockReturnValue("error-channel-id");
		processNotification("error.diskspace", payload, config, channel as never, logger);

		// Assert
		const call = publishToDiscordSpy.mock.calls[0] as [unknown, { channel_id: string }, unknown];
		expect(call[1].channel_id).toBe("error-channel-id");
	});
});
