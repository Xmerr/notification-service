import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "../../src/config/index.js";

describe("loadConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env = { ...originalEnv };
		process.env["RABBITMQ_URL"] = "amqp://localhost";
		process.env["DISCORD_CHANNEL_DEFAULT"] = "123456789";
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

		it("should throw if DISCORD_CHANNEL_DEFAULT is missing", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_DEFAULT"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow(
				"DISCORD_CHANNEL_DEFAULT environment variable is required",
			);
		});
	});

	describe("channel configuration", () => {
		it("should load default channel", () => {
			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.defaultChannel).toBe("123456789");
		});

		it("should load all DISCORD_CHANNEL_* variables", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_INFO"] = "111111111";
			process.env["DISCORD_CHANNEL_ERRORS"] = "222222222";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.channels["info"]).toBe("111111111");
			expect(config.discord.channels["errors"]).toBe("222222222");
			expect(config.discord.channels["default"]).toBe("123456789");
		});

		it("should convert channel names to lowercase", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_MyChannel"] = "333333333";

			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.channels["mychannel"]).toBe("333333333");
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
