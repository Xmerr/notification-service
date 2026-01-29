import type { Logger } from "pino";
import { NonRetryableError, RetryableError } from "../errors/index.js";
import type { DiscordEmbed, DiscordWebhookPayload } from "../types/index.js";

const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;

function redactWebhookUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		return `${urlObj.origin}/webhooks/***/***/`;
	} catch {
		return "[invalid-url]";
	}
}

export async function sendEmbed(
	webhookUrl: string,
	embed: DiscordEmbed,
	logger: Logger,
): Promise<void> {
	const payload: DiscordWebhookPayload = { embeds: [embed] };
	const redactedUrl = redactWebhookUrl(webhookUrl);

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

			const response = await fetch(webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				logger.debug({ url: redactedUrl }, "Discord webhook sent successfully");
				return;
			}

			if (response.status === 429) {
				const retryAfter = response.headers.get("retry-after");
				const waitMs = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 5000;
				logger.warn({ url: redactedUrl, retryAfter: waitMs }, "Discord rate limited");
				throw new RetryableError("Rate limited by Discord", "RATE_LIMITED", { retryAfter: waitMs });
			}

			if (response.status >= 500) {
				logger.warn({ url: redactedUrl, status: response.status, attempt }, "Discord server error");
				if (attempt === MAX_RETRIES) {
					throw new RetryableError(`Discord server error: ${response.status}`, "SERVER_ERROR", {
						status: response.status,
					});
				}
				await Bun.sleep(1000 * attempt);
				continue;
			}

			const errorBody = await response.text();
			throw new NonRetryableError(`Discord client error: ${response.status}`, "CLIENT_ERROR", {
				status: response.status,
				body: errorBody,
			});
		} catch (error) {
			if (error instanceof RetryableError || error instanceof NonRetryableError) {
				throw error;
			}

			if (error instanceof Error && error.name === "AbortError") {
				logger.warn({ url: redactedUrl, attempt }, "Discord webhook timeout");
				if (attempt === MAX_RETRIES) {
					throw new RetryableError("Discord webhook timeout", "TIMEOUT");
				}
				continue;
			}

			logger.error({ url: redactedUrl, error, attempt }, "Discord webhook error");
			if (attempt === MAX_RETRIES) {
				throw new RetryableError(
					`Network error: ${error instanceof Error ? error.message : "Unknown"}`,
					"NETWORK_ERROR",
				);
			}
		}
	}
}
