import type { Config } from "../config/index.js";

export function getWebhookUrls(routingKey: string, config: Config): string[] {
	const urls: string[] = [];
	const category = routingKey.split(".")[0]?.toLowerCase() ?? "";

	const mappedWebhookName = config.discord.routes[category];
	if (mappedWebhookName && config.discord.webhooks[mappedWebhookName]) {
		urls.push(config.discord.webhooks[mappedWebhookName]!);
	} else {
		urls.push(config.discord.defaultWebhook);
	}

	const errorsWebhook = config.discord.webhooks["errors"];
	if (errorsWebhook) {
		const isErrorRoute = config.discord.errorRoutes.some((prefix) => routingKey.startsWith(prefix));
		if (isErrorRoute && !urls.includes(errorsWebhook)) {
			urls.push(errorsWebhook);
		}
	}

	return urls;
}
