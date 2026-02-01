import { describe, expect, it } from "bun:test";
import type { Config } from "../../src/config/index.js";
import { getChannelId } from "../../src/discord/channel-router.js";

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

describe("getChannelId", () => {
	describe("severity-based routing", () => {
		it("should route info.* to info channel", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("info.diskspace", config);

			// Assert
			expect(channelId).toBe("info-channel-id");
		});

		it("should route warn.* to warn channel", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("warn.diskspace", config);

			// Assert
			expect(channelId).toBe("warn-channel-id");
		});

		it("should route error.* to error channel", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("error.diskspace", config);

			// Assert
			expect(channelId).toBe("error-channel-id");
		});

		it("should route critical.* to critical channel", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("critical.diskspace", config);

			// Assert
			expect(channelId).toBe("critical-channel-id");
		});
	});

	describe("fallback to info channel", () => {
		it("should fallback to info for ci.* routing keys", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("ci.success", config);

			// Assert
			expect(channelId).toBe("info-channel-id");
		});

		it("should fallback to info for pr.* routing keys", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("pr.opened", config);

			// Assert
			expect(channelId).toBe("info-channel-id");
		});

		it("should fallback to info for unknown routing keys", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("unknown.event", config);

			// Assert
			expect(channelId).toBe("info-channel-id");
		});

		it("should fallback to info for empty routing key", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("", config);

			// Assert
			expect(channelId).toBe("info-channel-id");
		});
	});

	describe("case insensitivity", () => {
		it("should be case-insensitive for severity prefix", () => {
			// Arrange
			const config = createConfig();

			// Act & Assert
			expect(getChannelId("WARN.diskspace", config)).toBe("warn-channel-id");
			expect(getChannelId("Warn.diskspace", config)).toBe("warn-channel-id");
			expect(getChannelId("ERROR.test", config)).toBe("error-channel-id");
		});
	});

	describe("routing key extraction", () => {
		it("should handle routing keys with multiple dots", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("error.diskspace.critical", config);

			// Assert
			expect(channelId).toBe("error-channel-id");
		});

		it("should handle single-part routing key", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("warn", config);

			// Assert
			expect(channelId).toBe("warn-channel-id");
		});
	});

	describe("DLQ routing", () => {
		it("should route notifications.dlq.* to error channel", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("notifications.dlq.qbittorrent", config);

			// Assert
			expect(channelId).toBe("error-channel-id");
		});

		it("should route any *.dlq.* pattern to error channel", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelId = getChannelId("service.dlq.consumer-name", config);

			// Assert
			expect(channelId).toBe("error-channel-id");
		});
	});
});
