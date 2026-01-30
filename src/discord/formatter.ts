import type { DiscordEmbed, NotificationMessage } from "../types/index.js";

const COLORS = {
	green: 0x57f287,
	red: 0xed4245,
	yellow: 0xfee75c,
	purple: 0x9b59b6,
	orange: 0xe67e22,
	blue: 0x3498db,
} as const;

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function truncate(str: string, maxLength: number): string {
	return str.length > maxLength ? `${str.slice(0, maxLength - 3)}...` : str;
}

export function formatEmbed(routingKey: string, payload: NotificationMessage): DiscordEmbed {
	if (routingKey === "ci.success") {
		const msg = payload as { repository?: string; status?: string; run_url?: string };
		return {
			title: "CI Build Succeeded",
			color: COLORS.green,
			url: msg.run_url,
			fields: [
				{ name: "Repository", value: msg.repository ?? "unknown", inline: true },
				{ name: "Status", value: msg.status ?? "complete", inline: true },
				{ name: "Result", value: "success", inline: true },
			],
		};
	}

	if (routingKey === "ci.failure") {
		const msg = payload as { repository?: string; status?: string; run_url?: string };
		return {
			title: "CI Build Failed",
			color: COLORS.red,
			url: msg.run_url,
			fields: [
				{ name: "Repository", value: msg.repository ?? "unknown", inline: true },
				{ name: "Status", value: msg.status ?? "complete", inline: true },
				{ name: "Result", value: "failure", inline: true },
			],
		};
	}

	if (routingKey === "pr.opened") {
		const msg = payload as {
			pr_number?: number;
			pr_title?: string;
			author?: string;
			pr_url?: string;
		};
		return {
			title: "Pull Request Opened",
			color: COLORS.yellow,
			url: msg.pr_url,
			fields: [
				{ name: "PR", value: `#${msg.pr_number ?? "?"}`, inline: true },
				{ name: "Title", value: truncate(msg.pr_title ?? "untitled", 100), inline: true },
				{ name: "Author", value: msg.author ?? "unknown", inline: true },
			],
		};
	}

	if (routingKey === "pr.merged") {
		const msg = payload as {
			pr_number?: number;
			pr_title?: string;
			author?: string;
			pr_url?: string;
		};
		return {
			title: "Pull Request Merged",
			color: COLORS.purple,
			url: msg.pr_url,
			fields: [
				{ name: "PR", value: `#${msg.pr_number ?? "?"}`, inline: true },
				{ name: "Title", value: truncate(msg.pr_title ?? "untitled", 100), inline: true },
				{ name: "Author", value: msg.author ?? "unknown", inline: true },
			],
		};
	}

	if (routingKey === "pr.closed") {
		const msg = payload as {
			pr_number?: number;
			pr_title?: string;
			author?: string;
			pr_url?: string;
		};
		return {
			title: "Pull Request Closed",
			color: COLORS.red,
			url: msg.pr_url,
			fields: [
				{ name: "PR", value: `#${msg.pr_number ?? "?"}`, inline: true },
				{ name: "Title", value: truncate(msg.pr_title ?? "untitled", 100), inline: true },
				{ name: "Author", value: msg.author ?? "unknown", inline: true },
			],
		};
	}

	if (routingKey === "downloads.complete") {
		const msg = payload as { name?: string; size?: number; category?: string; savePath?: string };
		return {
			title: "Download Complete",
			color: COLORS.green,
			fields: [
				{ name: "Name", value: truncate(msg.name ?? "unknown", 100), inline: false },
				{ name: "Size", value: formatBytes(msg.size ?? 0), inline: true },
				{ name: "Category", value: msg.category ?? "unknown", inline: true },
			],
		};
	}

	if (routingKey === "downloads.removed") {
		const msg = payload as { name?: string; size?: number; category?: string; savePath?: string };
		return {
			title: "Download Removed",
			color: COLORS.orange,
			fields: [
				{ name: "Name", value: truncate(msg.name ?? "unknown", 100), inline: false },
				{ name: "Size", value: formatBytes(msg.size ?? 0), inline: true },
				{ name: "Category", value: msg.category ?? "unknown", inline: true },
			],
		};
	}

	if (routingKey === "deploy.success") {
		const msg = payload as { repository?: string; status?: string; duration?: number };
		return {
			title: "Deployment Succeeded",
			color: COLORS.green,
			fields: [
				{ name: "Repository", value: msg.repository ?? "unknown", inline: true },
				{ name: "Status", value: msg.status ?? "complete", inline: true },
				...(msg.duration ? [{ name: "Duration", value: `${msg.duration}s`, inline: true }] : []),
			],
		};
	}

	if (routingKey === "deploy.failure") {
		const msg = payload as { repository?: string; status?: string; duration?: number };
		return {
			title: "Deployment Failed",
			color: COLORS.red,
			fields: [
				{ name: "Repository", value: msg.repository ?? "unknown", inline: true },
				{ name: "Status", value: msg.status ?? "failed", inline: true },
				...(msg.duration ? [{ name: "Duration", value: `${msg.duration}s`, inline: true }] : []),
			],
		};
	}

	if (routingKey === "polling.failure") {
		const msg = payload as { service?: string; error?: string };
		return {
			title: "Service Polling Failed",
			color: COLORS.red,
			fields: [
				{ name: "Service", value: msg.service ?? "unknown", inline: true },
				{ name: "Error", value: truncate(msg.error ?? "unknown error", 200), inline: false },
			],
		};
	}

	if (routingKey.startsWith("dlq.") || routingKey.startsWith("notifications.dlq.")) {
		const msg = payload as {
			service?: string;
			queue?: string;
			error?: string;
			retryCount?: number;
			originalMessage?: string;
		};
		return {
			title: "Dead Letter Queue Alert",
			color: COLORS.red,
			fields: [
				{ name: "Service", value: msg.service ?? "unknown", inline: true },
				{ name: "Queue", value: msg.queue ?? "unknown", inline: true },
				{ name: "Retry Count", value: String(msg.retryCount ?? 0), inline: true },
				{ name: "Error", value: truncate(msg.error ?? "unknown error", 200), inline: false },
			],
		};
	}

	if (routingKey === "warn.diskspace") {
		const msg = payload as {
			volume?: string;
			mount_point?: string;
			used_percent?: number;
			threshold?: string;
			total_bytes?: number;
			used_bytes?: number;
			free_bytes?: number;
		};
		return {
			title: "Disk Space Warning",
			color: COLORS.yellow,
			fields: [
				{ name: "Volume", value: msg.volume ?? "unknown", inline: true },
				{ name: "Usage", value: `${msg.used_percent ?? 0}%`, inline: true },
				{ name: "Free", value: formatBytes(msg.free_bytes ?? 0), inline: true },
			],
		};
	}

	if (routingKey === "error.diskspace") {
		const msg = payload as {
			volume?: string;
			mount_point?: string;
			used_percent?: number;
			threshold?: string;
			total_bytes?: number;
			used_bytes?: number;
			free_bytes?: number;
		};
		return {
			title: "Disk Space Critical",
			color: COLORS.orange,
			fields: [
				{ name: "Volume", value: msg.volume ?? "unknown", inline: true },
				{ name: "Usage", value: `${msg.used_percent ?? 0}%`, inline: true },
				{ name: "Free", value: formatBytes(msg.free_bytes ?? 0), inline: true },
			],
		};
	}

	if (routingKey === "critical.diskspace") {
		const msg = payload as {
			volume?: string;
			mount_point?: string;
			used_percent?: number;
			threshold?: string;
			total_bytes?: number;
			used_bytes?: number;
			free_bytes?: number;
		};
		return {
			title: "Disk Space Emergency",
			color: COLORS.red,
			fields: [
				{ name: "Volume", value: msg.volume ?? "unknown", inline: true },
				{ name: "Usage", value: `${msg.used_percent ?? 0}%`, inline: true },
				{ name: "Free", value: formatBytes(msg.free_bytes ?? 0), inline: true },
			],
		};
	}

	if (routingKey === "info.diskspace") {
		const msg = payload as {
			volume?: string;
			mount_point?: string;
			used_percent?: number;
			previous_threshold?: string;
			volumes?: Array<{
				volume: string;
				mount_point: string;
				used_percent: number;
				status: string;
			}>;
		};

		if (msg.previous_threshold) {
			return {
				title: "Disk Space Recovery",
				color: COLORS.green,
				fields: [
					{ name: "Volume", value: msg.volume ?? "unknown", inline: true },
					{ name: "Usage", value: `${msg.used_percent ?? 0}%`, inline: true },
					{ name: "Recovered From", value: msg.previous_threshold, inline: true },
				],
			};
		}

		if (msg.volumes && msg.volumes.length > 0) {
			const volumeList = msg.volumes
				.map((v) => `${v.volume}: ${v.used_percent}% (${v.status})`)
				.join("\n");
			return {
				title: "Disk Space Status",
				color: COLORS.blue,
				description: truncate(volumeList, 1000),
			};
		}

		return {
			title: "Disk Space Status",
			color: COLORS.blue,
			fields: [
				{ name: "Volume", value: msg.volume ?? "unknown", inline: true },
				{ name: "Usage", value: `${msg.used_percent ?? 0}%`, inline: true },
			],
		};
	}

	return {
		title: `Notification: ${routingKey}`,
		description: truncate(JSON.stringify(payload, null, 2), 1000),
		color: COLORS.blue,
	};
}
