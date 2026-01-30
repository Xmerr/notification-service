import type { Config } from "../config/index.js";

export function getChannelId(routingKey: string, config: Config): string {
	const severity = routingKey.split(".")[0]?.toLowerCase() ?? "";

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
