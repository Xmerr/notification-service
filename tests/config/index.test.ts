import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "../../src/config/index.js";

describe("loadConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env = { ...originalEnv };
		process.env["RABBITMQ_URL"] = "amqp://localhost";
		process.env["DISCORD_WEBHOOK_DEFAULT"] = "https://discord.com/api/webhooks/default/token";
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("required environment variables", () => {
		it("should throw if RABBITMQ_URL is missing", () => {
			// Arrange
			process.env["RABBITMQ_URL"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow("RABBITMQ_URL environment variable is required");
		});

		it("should throw if DISCORD_WEBHOOK_DEFAULT is missing", () => {
			// Arrange
			process.env["DISCORD_WEBHOOK_DEFAULT"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow(
				"DISCORD_WEBHOOK_DEFAULT environment variable is required",
			);
		});
	});

	describe("webhook configuration", () => {
		it("should load default webhook", () => {
			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.defaultWebhook).toBe("https://discord.com/api/webhooks/default/token");
		});

		it("should load all DISCORD_WEBHOOK_* variables", () => {
			// Arrange
			process.env["DISCORD_WEBHOOK_INFO"] = "https://discord.com/api/webhooks/info/token";
			process.env["DISCORD_WEBHOOK_ERRORS"] = "https://discord.com/api/webhooks/errors/token";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.webhooks["info"]).toBe("https://discord.com/api/webhooks/info/token");
			expect(config.discord.webhooks["errors"]).toBe(
				"https://discord.com/api/webhooks/errors/token",
			);
			expect(config.discord.webhooks["default"]).toBe(
				"https://discord.com/api/webhooks/default/token",
			);
		});

		it("should convert webhook names to lowercase", () => {
			// Arrange
			process.env["DISCORD_WEBHOOK_MyWebhook"] = "https://discord.com/api/webhooks/my/token";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.webhooks["mywebhook"]).toBe(
				"https://discord.com/api/webhooks/my/token",
			);
		});
	});

	describe("route configuration", () => {
		it("should load all DISCORD_ROUTE_* variables", () => {
			// Arrange
			process.env["DISCORD_ROUTE_CI"] = "info";
			process.env["DISCORD_ROUTE_PR"] = "prs";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.routes["ci"]).toBe("info");
			expect(config.discord.routes["pr"]).toBe("prs");
		});

		it("should convert route values to lowercase", () => {
			// Arrange
			process.env["DISCORD_ROUTE_CI"] = "INFO";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.routes["ci"]).toBe("info");
		});
	});

	describe("error routes", () => {
		it("should use default error routes when not specified", () => {
			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.errorRoutes).toContain("ci.failure");
			expect(config.discord.errorRoutes).toContain("deploy.failure");
			expect(config.discord.errorRoutes).toContain("dlq");
			expect(config.discord.errorRoutes).toContain("polling.failure");
		});

		it("should parse custom error routes", () => {
			// Arrange
			process.env["DISCORD_ERROR_ROUTES"] = "custom.error,another.error";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.errorRoutes).toEqual(["custom.error", "another.error"]);
		});

		it("should trim whitespace from error routes", () => {
			// Arrange
			process.env["DISCORD_ERROR_ROUTES"] = "error1 , error2 , error3";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.errorRoutes).toEqual(["error1", "error2", "error3"]);
		});
	});

	describe("infrastructure configuration", () => {
		it("should load Loki host when provided", () => {
			// Arrange
			process.env["LOKI_HOST"] = "http://loki:3100";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.loki.host).toBe("http://loki:3100");
		});

		it("should have undefined Loki host when not provided", () => {
			// Act
			const config = loadConfig();

			// Assert
			expect(config.loki.host).toBeUndefined();
		});

		it("should use default log level when not specified", () => {
			// Act
			const config = loadConfig();

			// Assert
			expect(config.logLevel).toBe("info");
		});

		it("should load custom log level", () => {
			// Arrange
			process.env["LOG_LEVEL"] = "debug";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.logLevel).toBe("debug");
		});
	});
});
