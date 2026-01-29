Mox.defmock(NotificationService.Discord.MockClient,
  for: NotificationService.Discord.ClientBehaviour
)

Mox.defmock(NotificationService.Discord.MockRouter,
  for: NotificationService.Discord.RouterBehaviour
)

Mox.defmock(NotificationService.Discord.MockFormatter,
  for: NotificationService.Discord.FormatterBehaviour
)

Mox.defmock(NotificationService.Services.MockNotificationService,
  for: NotificationService.Services.NotificationServiceBehaviour
)

Mox.defmock(NotificationService.RabbitMQ.MockAMQP,
  for: NotificationService.RabbitMQ.AMQPBehaviour
)
