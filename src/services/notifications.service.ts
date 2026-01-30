import type { Channel } from "amqplib";
import type { Logger } from "pino";
import type { Config } from "../config/index.js";
import { getChannelId } from "../discord/channel-router.js";
import { formatEmbed } from "../discord/formatter.js";
import { publishToDiscord } from "../publishers/discord.publisher.js";
import type { NotificationMessage, SendPostMessage } from "../types/index.js";

function generateCorrelationId(): string {
	return `notification-${crypto.randomUUID()}`;
}

export function processNotification(
	routingKey: string,
	payload: NotificationMessage,
	config: Config,
	channel: Channel,
	logger: Logger,
): void {
	const embed = formatEmbed(routingKey, payload);
	const channelId = getChannelId(routingKey, config);

	logger.debug({ routingKey, channelId }, "Processing notification");

	const message: SendPostMessage = {
		id: generateCorrelationId(),
		channel_id: channelId,
		embed,
	};
	publishToDiscord(channel, message, logger);
}
