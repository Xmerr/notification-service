import type pino from "pino";

export interface Config {
	rabbitmq: {
		url: string;
	};
	discord: {
		webhooks: Record<string, string>;
		routes: Record<string, string>;
		errorRoutes: string[];
		defaultWebhook: string;
	};
	loki: {
		host: string | undefined;
	};
	logLevel: pino.Level;
}

function getWebhooksFromEnv(): Record<string, string> {
	const webhooks: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith("DISCORD_WEBHOOK_") && value) {
			const name = key.replace("DISCORD_WEBHOOK_", "").toLowerCase();
			webhooks[name] = value;
		}
	}
	return webhooks;
}

function getRoutesFromEnv(): Record<string, string> {
	const routes: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith("DISCORD_ROUTE_") && value) {
			const category = key.replace("DISCORD_ROUTE_", "").toLowerCase();
			routes[category] = value.toLowerCase();
		}
	}
	return routes;
}

export function loadConfig(): Config {
	const rabbitmqUrl = process.env["RABBITMQ_URL"];
	if (!rabbitmqUrl) {
		throw new Error("RABBITMQ_URL environment variable is required");
	}

	const defaultWebhook = process.env["DISCORD_WEBHOOK_DEFAULT"];
	if (!defaultWebhook) {
		throw new Error("DISCORD_WEBHOOK_DEFAULT environment variable is required");
	}

	const errorRoutesRaw =
		process.env["DISCORD_ERROR_ROUTES"] ?? "ci.failure,deploy.failure,dlq,polling.failure";
	const errorRoutes = errorRoutesRaw.split(",").map((r) => r.trim());

	const logLevel = (process.env["LOG_LEVEL"] ?? "info") as pino.Level;

	return {
		rabbitmq: {
			url: rabbitmqUrl,
		},
		discord: {
			webhooks: getWebhooksFromEnv(),
			routes: getRoutesFromEnv(),
			errorRoutes,
			defaultWebhook,
		},
		loki: {
			host: process.env["LOKI_HOST"],
		},
		logLevel,
	};
}
