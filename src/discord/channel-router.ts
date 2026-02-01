import type { Config } from "../config/index.js";

export function getChannelId(routingKey: string, config: Config): string {
	const segments = routingKey.split(".");
	const severity = segments[0]?.toLowerCase() ?? "";

	// DLQ alerts use routing key: notifications.dlq.{service-name}
	if (segments[1] === "dlq") {
		return config.discord.errorChannel;
	}

	switch (severity) {
		case "info":
			return config.discord.infoChannel;
		case "warn":
			return config.discord.warnChannel;
		case "error":
			return config.discord.errorChannel;
		case "critical":
			return config.discord.criticalChannel;
		default:
			return config.discord.infoChannel;
	}
}
