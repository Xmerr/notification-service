import type pino from "pino";

export interface Config {
	rabbitmq: {
		url: string;
	};
	discord: {
		infoChannel: string;
		warnChannel: string;
		errorChannel: string;
		criticalChannel: string;
	};
	loki: {
		host: string | undefined;
	};
	logLevel: pino.Level;
}

function requireEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`${key} environment variable is required`);
	}
	return value;
}

export function loadConfig(): Config {
	const rabbitmqUrl = requireEnv("RABBITMQ_URL");
	const infoChannel = requireEnv("DISCORD_CHANNEL_INFO");
	const warnChannel = requireEnv("DISCORD_CHANNEL_WARN");
	const errorChannel = requireEnv("DISCORD_CHANNEL_ERROR");
	const criticalChannel = requireEnv("DISCORD_CHANNEL_CRITICAL");

	const logLevel = (process.env["LOG_LEVEL"] ?? "info") as pino.Level;

	return {
		rabbitmq: {
			url: rabbitmqUrl,
		},
		discord: {
			infoChannel,
			warnChannel,
			errorChannel,
			criticalChannel,
		},
		loki: {
			host: process.env["LOKI_HOST"],
		},
		logLevel,
	};
}
