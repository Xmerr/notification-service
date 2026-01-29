import { describe, expect, it } from "bun:test";
import { formatEmbed } from "../../src/discord/formatter.js";

describe("formatEmbed", () => {
	describe("CI messages", () => {
		it("should format ci.success message", () => {
			// Arrange
			const payload = {
				repository: "owner/repo",
				status: "complete",
				run_url: "https://github.com/owner/repo/actions/runs/123",
			};

			// Act
			const embed = formatEmbed("ci.success", payload);

			// Assert
			expect(embed.title).toBe("CI Build Succeeded");
			expect(embed.color).toBe(0x57f287);
			expect(embed.url).toBe(payload.run_url);
			expect(embed.fields).toContainEqual({
				name: "Repository",
				value: "owner/repo",
				inline: true,
			});
			expect(embed.fields).toContainEqual({ name: "Result", value: "success", inline: true });
		});

		it("should format ci.failure message", () => {
			// Arrange
			const payload = {
				repository: "owner/repo",
				status: "complete",
				run_url: "https://github.com/owner/repo/actions/runs/123",
			};

			// Act
			const embed = formatEmbed("ci.failure", payload);

			// Assert
			expect(embed.title).toBe("CI Build Failed");
			expect(embed.color).toBe(0xed4245);
			expect(embed.fields).toContainEqual({ name: "Result", value: "failure", inline: true });
		});
	});

	describe("PR messages", () => {
		it("should format pr.opened message", () => {
			// Arrange
			const payload = {
				pr_number: 42,
				pr_title: "Add new feature",
				author: "contributor",
				pr_url: "https://github.com/owner/repo/pull/42",
			};

			// Act
			const embed = formatEmbed("pr.opened", payload);

			// Assert
			expect(embed.title).toBe("Pull Request Opened");
			expect(embed.color).toBe(0xfee75c);
			expect(embed.url).toBe(payload.pr_url);
			expect(embed.fields).toContainEqual({ name: "PR", value: "#42", inline: true });
			expect(embed.fields).toContainEqual({ name: "Author", value: "contributor", inline: true });
		});

		it("should format pr.merged message", () => {
			// Arrange
			const payload = {
				pr_number: 42,
				pr_title: "Add new feature",
				author: "contributor",
			};

			// Act
			const embed = formatEmbed("pr.merged", payload);

			// Assert
			expect(embed.title).toBe("Pull Request Merged");
			expect(embed.color).toBe(0x9b59b6);
		});

		it("should format pr.closed message", () => {
			// Arrange
			const payload = {
				pr_number: 42,
				pr_title: "Add new feature",
				author: "contributor",
			};

			// Act
			const embed = formatEmbed("pr.closed", payload);

			// Assert
			expect(embed.title).toBe("Pull Request Closed");
			expect(embed.color).toBe(0xed4245);
		});

		it("should truncate long PR titles", () => {
			// Arrange
			const longTitle = "A".repeat(150);
			const payload = { pr_number: 1, pr_title: longTitle, author: "user" };

			// Act
			const embed = formatEmbed("pr.opened", payload);

			// Assert
			const titleField = embed.fields?.find((f) => f.name === "Title");
			expect(titleField?.value.length).toBeLessThanOrEqual(100);
			expect(titleField?.value).toEndWith("...");
		});
	});

	describe("Download messages", () => {
		it("should format downloads.complete message", () => {
			// Arrange
			const payload = {
				name: "Media File",
				size: 5368709120,
				category: "TV",
				savePath: "/downloads/tv",
			};

			// Act
			const embed = formatEmbed("downloads.complete", payload);

			// Assert
			expect(embed.title).toBe("Download Complete");
			expect(embed.color).toBe(0x57f287);
			expect(embed.fields).toContainEqual({ name: "Name", value: "Media File", inline: false });
			expect(embed.fields).toContainEqual({ name: "Size", value: "5 GB", inline: true });
			expect(embed.fields).toContainEqual({ name: "Category", value: "TV", inline: true });
		});

		it("should format downloads.removed message", () => {
			// Arrange
			const payload = { name: "Old File", size: 1024, category: "Movies" };

			// Act
			const embed = formatEmbed("downloads.removed", payload);

			// Assert
			expect(embed.title).toBe("Download Removed");
			expect(embed.color).toBe(0xe67e22);
		});
	});

	describe("Deploy messages", () => {
		it("should format deploy.success message", () => {
			// Arrange
			const payload = { repository: "owner/repo", status: "complete", duration: 45 };

			// Act
			const embed = formatEmbed("deploy.success", payload);

			// Assert
			expect(embed.title).toBe("Deployment Succeeded");
			expect(embed.color).toBe(0x57f287);
			expect(embed.fields).toContainEqual({ name: "Duration", value: "45s", inline: true });
		});

		it("should format deploy.failure message", () => {
			// Arrange
			const payload = { repository: "owner/repo", status: "failed" };

			// Act
			const embed = formatEmbed("deploy.failure", payload);

			// Assert
			expect(embed.title).toBe("Deployment Failed");
			expect(embed.color).toBe(0xed4245);
		});
	});

	describe("Polling messages", () => {
		it("should format polling.failure message", () => {
			// Arrange
			const payload = { service: "api-service", error: "Connection timeout" };

			// Act
			const embed = formatEmbed("polling.failure", payload);

			// Assert
			expect(embed.title).toBe("Service Polling Failed");
			expect(embed.color).toBe(0xed4245);
			expect(embed.fields).toContainEqual({ name: "Service", value: "api-service", inline: true });
		});
	});

	describe("DLQ messages", () => {
		it("should format dlq.* message", () => {
			// Arrange
			const payload = {
				service: "my-service",
				queue: "my-queue",
				error: "Processing failed",
				retryCount: 20,
			};

			// Act
			const embed = formatEmbed("dlq.my-service", payload);

			// Assert
			expect(embed.title).toBe("Dead Letter Queue Alert");
			expect(embed.color).toBe(0xed4245);
			expect(embed.fields).toContainEqual({ name: "Service", value: "my-service", inline: true });
			expect(embed.fields).toContainEqual({ name: "Retry Count", value: "20", inline: true });
		});

		it("should format notifications.dlq.* message", () => {
			// Arrange
			const payload = {
				service: "notification-service",
				queue: "notifications",
				error: "Discord error",
				retryCount: 5,
			};

			// Act
			const embed = formatEmbed("notifications.dlq.notification-service", payload);

			// Assert
			expect(embed.title).toBe("Dead Letter Queue Alert");
		});
	});

	describe("Unknown messages", () => {
		it("should format unknown message type with JSON", () => {
			// Arrange
			const payload = { customField: "value", count: 42 };

			// Act
			const embed = formatEmbed("custom.event", payload);

			// Assert
			expect(embed.title).toBe("Notification: custom.event");
			expect(embed.color).toBe(0x3498db);
			expect(embed.description).toContain("customField");
		});
	});

	describe("Missing fields", () => {
		it("should handle missing fields gracefully", () => {
			// Arrange
			const payload = {};

			// Act
			const embed = formatEmbed("ci.success", payload);

			// Assert
			expect(embed.fields).toContainEqual({ name: "Repository", value: "unknown", inline: true });
		});
	});
});
