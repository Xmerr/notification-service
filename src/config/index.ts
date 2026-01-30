import type pino from "pino";

export interface Config {
	rabbitmq: {
		url: string;
	};
	discord: {
		channels: Record<string, string>;
		routes: Record<string, string>;
		errorRoutes: string[];
		defaultChannel: string;
	};
	loki: {
		host: string | undefined;
	};
	logLevel: pino.Level;
}

function getChannelsFromEnv(): Record<string, string> {
	const channels: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (key.startsWith("DISCORD_CHANNEL_") && value) {
			const name = key.replace("DISCORD_CHANNEL_", "").toLowerCase();
			channels[name] = value;
		}
	}
	return channels;
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

	const defaultChannel = process.env["DISCORD_CHANNEL_DEFAULT"];
	if (!defaultChannel) {
		throw new Error("DISCORD_CHANNEL_DEFAULT environment variable is required");
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
			channels: getChannelsFromEnv(),
			routes: getRoutesFromEnv(),
			errorRoutes,
			defaultChannel,
		},
		loki: {
			host: process.env["LOKI_HOST"],
		},
		logLevel,
	};
}
