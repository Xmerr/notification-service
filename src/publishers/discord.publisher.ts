import type { Channel } from "amqplib";
import type { Logger } from "pino";
import { EXCHANGE_DISCORD } from "../config/rabbitmq.js";
import type { SendPostMessage } from "../types/index.js";

const ROUTING_KEY = "post.send";

export function publishToDiscord(channel: Channel, message: SendPostMessage, logger: Logger): void {
	logger.debug({ id: message.id, channelId: message.channel_id }, "Publishing to discord exchange");

	channel.publish(EXCHANGE_DISCORD, ROUTING_KEY, Buffer.from(JSON.stringify(message)), {
		persistent: true,
	});
}
