import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import pino from "pino";
import type { Config } from "../../src/config/index.js";
import { RetryableError } from "../../src/errors/index.js";
import { processNotification } from "../../src/services/notifications.service.js";

const logger = pino({ level: "silent" });

function createConfig(): Config {
	return {
		rabbitmq: { url: "amqp://localhost" },
		discord: {
			webhooks: {
				default: "https://discord.com/api/webhooks/default/token",
				info: "https://discord.com/api/webhooks/info/token",
				errors: "https://discord.com/api/webhooks/errors/token",
			},
			routes: { ci: "info" },
			errorRoutes: ["ci.failure"],
			defaultWebhook: "https://discord.com/api/webhooks/default/token",
		},
		loki: { host: undefined },
		logLevel: "info",
	};
}

describe("processNotification", () => {
	let fetchMock: ReturnType<typeof mock>;

	beforeEach(() => {
		fetchMock = mock(() => Promise.resolve(new Response(null, { status: 200 })));
		spyOn(globalThis, "fetch").mockImplementation(fetchMock as unknown as typeof fetch);
	});

	afterEach(() => {
		mock.restore();
	});

	it("should process notification and send to webhook", async () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		await processNotification("ci.success", payload, config, logger);

		// Assert
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("should send to multiple webhooks for error routes", async () => {
		// Arrange
		const config = createConfig();
		const payload = { repository: "owner/repo", status: "complete" };

		// Act
		await processNotification("ci.failure", payload, config, logger);

		// Assert
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("should throw error if any webhook fails", async () => {
		// Arrange
		const config = createConfig();
		fetchMock.mockRejectedValue(new RetryableError("Network error", "NETWORK_ERROR"));
		const payload = { repository: "owner/repo" };

		// Act & Assert
		await expect(processNotification("ci.success", payload, config, logger)).rejects.toBeInstanceOf(
			RetryableError,
		);
	});

	it("should format payload into Discord embed", async () => {
		// Arrange
		const config = createConfig();
		const payload = {
			repository: "owner/repo",
			status: "complete",
			run_url: "https://github.com/owner/repo/actions/runs/123",
		};

		// Act
		await processNotification("ci.success", payload, config, logger);

		// Assert
		const call = fetchMock.mock.calls[0] as [string, RequestInit];
		const body = JSON.parse(call[1].body as string);
		expect(body.embeds[0].title).toBe("CI Build Succeeded");
		expect(body.embeds[0].color).toBe(0x57f287);
	});
});
