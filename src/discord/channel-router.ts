import type { Config } from "../config/index.js";

export function getChannelIds(routingKey: string, config: Config): string[] {
	const channelIds: string[] = [];
	const category = routingKey.split(".")[0]?.toLowerCase() ?? "";

	const mappedChannelName = config.discord.routes[category];
	if (mappedChannelName && config.discord.channels[mappedChannelName]) {
		channelIds.push(config.discord.channels[mappedChannelName]!);
	} else {
		channelIds.push(config.discord.defaultChannel);
	}

	const errorsChannel = config.discord.channels["errors"];
	if (errorsChannel) {
		const isErrorRoute = config.discord.errorRoutes.some((prefix) => routingKey.startsWith(prefix));
		if (isErrorRoute && !channelIds.includes(errorsChannel)) {
			channelIds.push(errorsChannel);
		}
	}

	return channelIds;
}
