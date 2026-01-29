import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import pino from "pino";
import { sendEmbed } from "../../src/discord/client.js";
import { NonRetryableError, RetryableError } from "../../src/errors/index.js";
import type { DiscordEmbed } from "../../src/types/index.js";

const logger = pino({ level: "silent" });

const testEmbed: DiscordEmbed = {
	title: "Test",
	color: 0x00ff00,
};

describe("sendEmbed", () => {
	let fetchMock: ReturnType<typeof mock>;

	beforeEach(() => {
		fetchMock = mock(() => Promise.resolve(new Response(null, { status: 200 })));
		spyOn(globalThis, "fetch").mockImplementation(fetchMock as unknown as typeof fetch);
	});

	afterEach(() => {
		mock.restore();
	});

	describe("successful requests", () => {
		it("should send embed to webhook successfully", async () => {
			// Arrange
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act
			await sendEmbed(webhookUrl, testEmbed, logger);

			// Assert
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(fetchMock).toHaveBeenCalledWith(
				webhookUrl,
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
				}),
			);
		});

		it("should send correct payload structure", async () => {
			// Arrange
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act
			await sendEmbed(webhookUrl, testEmbed, logger);

			// Assert
			const call = fetchMock.mock.calls[0] as [string, RequestInit];
			const body = JSON.parse(call[1].body as string);
			expect(body).toEqual({ embeds: [testEmbed] });
		});
	});

	describe("rate limiting (429)", () => {
		it("should throw RetryableError on rate limit", async () => {
			// Arrange
			fetchMock.mockResolvedValue(
				new Response(null, {
					status: 429,
					headers: { "retry-after": "5" },
				}),
			);
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			await expect(sendEmbed(webhookUrl, testEmbed, logger)).rejects.toBeInstanceOf(RetryableError);
		});

		it("should include retry-after in error context", async () => {
			// Arrange
			fetchMock.mockResolvedValue(
				new Response(null, {
					status: 429,
					headers: { "retry-after": "10" },
				}),
			);
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			try {
				await sendEmbed(webhookUrl, testEmbed, logger);
			} catch (error) {
				expect(error).toBeInstanceOf(RetryableError);
				expect((error as RetryableError).code).toBe("RATE_LIMITED");
				expect((error as RetryableError).context?.["retryAfter"]).toBe(10000);
			}
		});
	});

	describe("server errors (5xx)", () => {
		it("should retry on server error and throw RetryableError after max retries", async () => {
			// Arrange
			fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			await expect(sendEmbed(webhookUrl, testEmbed, logger)).rejects.toBeInstanceOf(RetryableError);
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});
	});

	describe("client errors (4xx)", () => {
		it("should throw NonRetryableError on client error", async () => {
			// Arrange
			fetchMock.mockResolvedValue(new Response("Bad Request", { status: 400 }));
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			await expect(sendEmbed(webhookUrl, testEmbed, logger)).rejects.toBeInstanceOf(
				NonRetryableError,
			);
		});

		it("should not retry on 4xx errors", async () => {
			// Arrange
			fetchMock.mockResolvedValue(new Response("Forbidden", { status: 403 }));
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			try {
				await sendEmbed(webhookUrl, testEmbed, logger);
			} catch {
				// Expected
			}
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
	});

	describe("network errors", () => {
		it("should throw RetryableError on network failure after retries", async () => {
			// Arrange
			fetchMock.mockRejectedValue(new Error("Network error"));
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			await expect(sendEmbed(webhookUrl, testEmbed, logger)).rejects.toBeInstanceOf(RetryableError);
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});
	});

	describe("timeout errors", () => {
		it("should throw RetryableError on timeout after max retries", async () => {
			// Arrange
			const abortError = new Error("The operation was aborted");
			abortError.name = "AbortError";
			fetchMock.mockRejectedValue(abortError);
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act & Assert
			await expect(sendEmbed(webhookUrl, testEmbed, logger)).rejects.toBeInstanceOf(RetryableError);
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});

		it("should retry on timeout before throwing", async () => {
			// Arrange
			const abortError = new Error("The operation was aborted");
			abortError.name = "AbortError";
			fetchMock
				.mockRejectedValueOnce(abortError)
				.mockRejectedValueOnce(abortError)
				.mockResolvedValueOnce(new Response(null, { status: 200 }));
			const webhookUrl = "https://discord.com/api/webhooks/123/token";

			// Act
			await sendEmbed(webhookUrl, testEmbed, logger);

			// Assert
			expect(fetchMock).toHaveBeenCalledTimes(3);
		});
	});

	describe("invalid URLs", () => {
		it("should handle invalid webhook URL gracefully", async () => {
			// Arrange
			fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
			const invalidUrl = "not-a-valid-url";

			// Act
			await sendEmbed(invalidUrl, testEmbed, logger);

			// Assert
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});
	});
});
