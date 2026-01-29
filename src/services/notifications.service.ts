import type { Logger } from "pino";
import type { Config } from "../config/index.js";
import { sendEmbed } from "../discord/client.js";
import { formatEmbed } from "../discord/formatter.js";
import { getWebhookUrls } from "../discord/router.js";
import type { NotificationMessage } from "../types/index.js";

export async function processNotification(
	routingKey: string,
	payload: NotificationMessage,
	config: Config,
	logger: Logger,
): Promise<void> {
	const embed = formatEmbed(routingKey, payload);
	const webhookUrls = getWebhookUrls(routingKey, config);

	logger.debug({ routingKey, webhookCount: webhookUrls.length }, "Processing notification");

	const results = await Promise.allSettled(webhookUrls.map((url) => sendEmbed(url, embed, logger)));

	const failed = results.filter((r) => r.status === "rejected");
	if (failed.length > 0) {
		const firstError = (failed[0] as PromiseRejectedResult).reason;
		throw firstError;
	}
}
