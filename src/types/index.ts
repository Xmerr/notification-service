export interface DiscordEmbed {
	title: string;
	description?: string;
	color: number;
	fields?: DiscordEmbedField[];
	url?: string;
	timestamp?: string;
}

export interface DiscordEmbedField {
	name: string;
	value: string;
	inline?: boolean;
}

export interface SendPostMessage {
	id: string;
	channel_id: string;
	content?: string;
	embed?: DiscordEmbed;
}

export interface CIMessage {
	repository: string;
	source: string;
	workflow: string;
	status: string;
	conclusion: string;
	run_url: string;
}

export interface PRMessage {
	action: string;
	repository: string;
	source: string;
	pr_number: number;
	pr_title: string;
	pr_url: string;
	author: string;
}

export interface DownloadMessage {
	name: string;
	size: number;
	category: string;
	savePath: string;
}

export interface DeployMessage {
	repository: string;
	status: string;
	duration?: number;
}

export interface PollingMessage {
	service: string;
	error: string;
}

export interface DLQMessage {
	service: string;
	queue: string;
	error: string;
	retryCount: number;
	originalMessage: string;
	timestamp: string;
	routingKey: string;
}

export type NotificationMessage =
	| CIMessage
	| PRMessage
	| DownloadMessage
	| DeployMessage
	| PollingMessage
	| DLQMessage
	| Record<string, unknown>;

export interface RetryHeaders {
	"x-retry-count": number;
	"x-first-failure-timestamp": string;
	"x-last-error": string;
	"x-delay"?: number;
}
