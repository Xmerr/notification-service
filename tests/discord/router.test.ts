import { describe, expect, it } from "bun:test";
import type { Config } from "../../src/config/index.js";
import { getWebhookUrls } from "../../src/discord/router.js";

function createConfig(overrides: Partial<Config["discord"]> = {}): Config {
	const defaultWebhooks = {
		default: "https://discord.com/api/webhooks/default/token",
		info: "https://discord.com/api/webhooks/info/token",
		errors: "https://discord.com/api/webhooks/errors/token",
	};

	return {
		rabbitmq: { url: "amqp://localhost" },
		discord: {
			webhooks: overrides.webhooks ?? defaultWebhooks,
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
			defaultWebhook: overrides.defaultWebhook ?? "https://discord.com/api/webhooks/default/token",
		},
		loki: { host: undefined },
		logLevel: "info",
	};
}

describe("getWebhookUrls", () => {
	describe("primary webhook routing", () => {
		it("should route to mapped webhook when route exists", () => {
			// Arrange
			const config = createConfig();

			// Act
			const urls = getWebhookUrls("ci.success", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/info/token");
		});

		it("should route to default webhook when no route exists", () => {
			// Arrange
			const config = createConfig();

			// Act
			const urls = getWebhookUrls("unknown.event", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/default/token");
			expect(urls).toHaveLength(1);
		});

		it("should route to default when mapped webhook does not exist", () => {
			// Arrange
			const config = createConfig({
				routes: { ci: "nonexistent" },
			});

			// Act
			const urls = getWebhookUrls("ci.success", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/default/token");
		});
	});

	describe("error webhook routing", () => {
		it("should add errors webhook for error routes", () => {
			// Arrange
			const config = createConfig();

			// Act
			const urls = getWebhookUrls("ci.failure", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/info/token");
			expect(urls).toContain("https://discord.com/api/webhooks/errors/token");
			expect(urls).toHaveLength(2);
		});

		it("should add errors webhook for dlq routes", () => {
			// Arrange
			const config = createConfig();

			// Act
			const urls = getWebhookUrls("dlq.some-service", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/errors/token");
		});

		it("should not add errors webhook when not configured", () => {
			// Arrange
			const config = createConfig({
				webhooks: {
					default: "https://discord.com/api/webhooks/default/token",
					info: "https://discord.com/api/webhooks/info/token",
				},
			});

			// Act
			const urls = getWebhookUrls("ci.failure", config);

			// Assert
			expect(urls).toHaveLength(1);
		});

		it("should not add errors webhook for non-error routes", () => {
			// Arrange
			const config = createConfig();

			// Act
			const urls = getWebhookUrls("ci.success", config);

			// Assert
			expect(urls).not.toContain("https://discord.com/api/webhooks/errors/token");
			expect(urls).toHaveLength(1);
		});

		it("should not duplicate if primary and errors are same webhook", () => {
			// Arrange
			const config = createConfig({
				webhooks: {
					default: "https://discord.com/api/webhooks/default/token",
					info: "https://discord.com/api/webhooks/same/token",
					errors: "https://discord.com/api/webhooks/same/token",
				},
			});

			// Act
			const urls = getWebhookUrls("ci.failure", config);

			// Assert
			expect(urls).toHaveLength(1);
			expect(urls[0]).toBe("https://discord.com/api/webhooks/same/token");
		});
	});

	describe("routing key extraction", () => {
		it("should extract category from single-part routing key", () => {
			// Arrange
			const config = createConfig({ routes: { deploy: "info" } });

			// Act
			const urls = getWebhookUrls("deploy", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/info/token");
		});

		it("should extract category from multi-part routing key", () => {
			// Arrange
			const config = createConfig({ routes: { notifications: "info" } });

			// Act
			const urls = getWebhookUrls("notifications.dlq.some-service", config);

			// Assert
			expect(urls).toContain("https://discord.com/api/webhooks/info/token");
		});
	});
});
