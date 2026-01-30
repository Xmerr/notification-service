import { describe, expect, it } from "bun:test";
import type { Config } from "../../src/config/index.js";
import { getChannelIds } from "../../src/discord/channel-router.js";

function createConfig(overrides: Partial<Config["discord"]> = {}): Config {
	const defaultChannels = {
		default: "100000000000000000",
		info: "111111111111111111",
		errors: "222222222222222222",
	};

	return {
		rabbitmq: { url: "amqp://localhost" },
		discord: {
			channels: overrides.channels ?? defaultChannels,
			routes: {
				ci: "info",
				pr: "info",
				...overrides.routes,
			},
			errorRoutes: overrides.errorRoutes ?? [
				"ci.failure",
				"deploy.failure",
				"dlq",
				"polling.failure",
			],
			defaultChannel: overrides.defaultChannel ?? "100000000000000000",
		},
		loki: { host: undefined },
		logLevel: "info",
	};
}

describe("getChannelIds", () => {
	describe("primary channel routing", () => {
		it("should route to mapped channel when route exists", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelIds = getChannelIds("ci.success", config);

			// Assert
			expect(channelIds).toContain("111111111111111111");
		});

		it("should route to default channel when no route exists", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelIds = getChannelIds("unknown.event", config);

			// Assert
			expect(channelIds).toContain("100000000000000000");
			expect(channelIds).toHaveLength(1);
		});

		it("should route to default when mapped channel does not exist", () => {
			// Arrange
			const config = createConfig({
				routes: { ci: "nonexistent" },
			});

			// Act
			const channelIds = getChannelIds("ci.success", config);

			// Assert
			expect(channelIds).toContain("100000000000000000");
		});
	});

	describe("error channel routing", () => {
		it("should add errors channel for error routes", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelIds = getChannelIds("ci.failure", config);

			// Assert
			expect(channelIds).toContain("111111111111111111");
			expect(channelIds).toContain("222222222222222222");
			expect(channelIds).toHaveLength(2);
		});

		it("should add errors channel for dlq routes", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelIds = getChannelIds("dlq.some-service", config);

			// Assert
			expect(channelIds).toContain("222222222222222222");
		});

		it("should not add errors channel when not configured", () => {
			// Arrange
			const config = createConfig({
				channels: {
					default: "100000000000000000",
					info: "111111111111111111",
				},
			});

			// Act
			const channelIds = getChannelIds("ci.failure", config);

			// Assert
			expect(channelIds).toHaveLength(1);
		});

		it("should not add errors channel for non-error routes", () => {
			// Arrange
			const config = createConfig();

			// Act
			const channelIds = getChannelIds("ci.success", config);

			// Assert
			expect(channelIds).not.toContain("222222222222222222");
			expect(channelIds).toHaveLength(1);
		});

		it("should not duplicate if primary and errors are same channel", () => {
			// Arrange
			const config = createConfig({
				channels: {
					default: "100000000000000000",
					info: "333333333333333333",
					errors: "333333333333333333",
				},
			});

			// Act
			const channelIds = getChannelIds("ci.failure", config);

			// Assert
			expect(channelIds).toHaveLength(1);
			expect(channelIds[0]).toBe("333333333333333333");
		});
	});

	describe("routing key extraction", () => {
		it("should extract category from single-part routing key", () => {
			// Arrange
			const config = createConfig({ routes: { deploy: "info" } });

			// Act
			const channelIds = getChannelIds("deploy", config);

			// Assert
			expect(channelIds).toContain("111111111111111111");
		});

		it("should extract category from multi-part routing key", () => {
			// Arrange
			const config = createConfig({ routes: { notifications: "info" } });

			// Act
			const channelIds = getChannelIds("notifications.dlq.some-service", config);

			// Assert
			expect(channelIds).toContain("111111111111111111");
		});
	});
});
