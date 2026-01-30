import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "../../src/config/index.js";

describe("loadConfig", () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		process.env = { ...originalEnv };
		process.env["RABBITMQ_URL"] = "amqp://localhost";
		process.env["DISCORD_CHANNEL_INFO"] = "info-channel-id";
		process.env["DISCORD_CHANNEL_WARN"] = "warn-channel-id";
		process.env["DISCORD_CHANNEL_ERROR"] = "error-channel-id";
		process.env["DISCORD_CHANNEL_CRITICAL"] = "critical-channel-id";
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

		it("should throw if DISCORD_CHANNEL_INFO is missing", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_INFO"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow("DISCORD_CHANNEL_INFO environment variable is required");
		});

		it("should throw if DISCORD_CHANNEL_WARN is missing", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_WARN"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow("DISCORD_CHANNEL_WARN environment variable is required");
		});

		it("should throw if DISCORD_CHANNEL_ERROR is missing", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_ERROR"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow("DISCORD_CHANNEL_ERROR environment variable is required");
		});

		it("should throw if DISCORD_CHANNEL_CRITICAL is missing", () => {
			// Arrange
			process.env["DISCORD_CHANNEL_CRITICAL"] = undefined;

			// Act & Assert
			expect(() => loadConfig()).toThrow(
				"DISCORD_CHANNEL_CRITICAL environment variable is required",
			);
		});
	});

	describe("channel configuration", () => {
		it("should load all severity channels", () => {
			// Act
			const config = loadConfig();

			// Assert
			expect(config.discord.infoChannel).toBe("info-channel-id");
			expect(config.discord.warnChannel).toBe("warn-channel-id");
			expect(config.discord.errorChannel).toBe("error-channel-id");
			expect(config.discord.criticalChannel).toBe("critical-channel-id");
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
