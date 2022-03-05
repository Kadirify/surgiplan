BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Branch] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [name] NVARCHAR(80) NOT NULL,
    CONSTRAINT [Branch_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Branch_name_key] UNIQUE NONCLUSTERED ([name])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [email] NVARCHAR(256) NOT NULL,
    [fullName] NVARCHAR(120) NOT NULL,
    [title] NVARCHAR(40),
    [phone] VARCHAR(20),
    [role] VARCHAR(24) NOT NULL,
    [branchId] UNIQUEIDENTIFIER,
    [supervisorId] UNIQUEIDENTIFIER,
    [passwordHash] VARCHAR(100),
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [mustChangePassword] BIT NOT NULL CONSTRAINT [User_mustChangePassword_df] DEFAULT 0,
    [failedLoginCount] INT NOT NULL CONSTRAINT [User_failedLoginCount_df] DEFAULT 0,
    [lockedUntil] DATETIME2,
    [lastLoginAt] DATETIME2,
    [theme] VARCHAR(10) NOT NULL CONSTRAINT [User_theme_df] DEFAULT 'light',
    [emailNotifications] BIT NOT NULL CONSTRAINT [User_emailNotifications_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshToken] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [familyId] UNIQUEIDENTIFIER NOT NULL,
    [tokenHash] VARCHAR(64) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [userAgent] NVARCHAR(200),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RefreshToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[ActionToken] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [purpose] VARCHAR(16) NOT NULL,
    [tokenHash] VARCHAR(64) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [usedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ActionToken_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ActionToken_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ActionToken_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Room] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(10) NOT NULL,
    [name] NVARCHAR(80) NOT NULL,
    [floor] NVARCHAR(20),
    [turnoverMinutes] INT NOT NULL CONSTRAINT [Room_turnoverMinutes_df] DEFAULT 30,
    [isActive] BIT NOT NULL CONSTRAINT [Room_isActive_df] DEFAULT 1,
    [sortOrder] INT NOT NULL CONSTRAINT [Room_sortOrder_df] DEFAULT 0,
    [notes] NVARCHAR(400),
    CONSTRAINT [Room_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Room_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Equipment] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(20) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [quantity] INT NOT NULL CONSTRAINT [Equipment_quantity_df] DEFAULT 1,
    [isActive] BIT NOT NULL CONSTRAINT [Equipment_isActive_df] DEFAULT 1,
    CONSTRAINT [Equipment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Equipment_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Procedure] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(20) NOT NULL,
    [name] NVARCHAR(160) NOT NULL,
    [branchId] UNIQUEIDENTIFIER NOT NULL,
    [defaultDurationMinutes] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [Procedure_isActive_df] DEFAULT 1,
    CONSTRAINT [Procedure_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Procedure_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Patient] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [mrn] VARCHAR(20) NOT NULL,
    [firstName] NVARCHAR(60) NOT NULL,
    [lastName] NVARCHAR(60) NOT NULL,
    [birthDate] DATE NOT NULL,
    [gender] VARCHAR(1) NOT NULL,
    [phone] VARCHAR(20),
    [allergies] NVARCHAR(400),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Patient_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Patient_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Patient_mrn_key] UNIQUE NONCLUSTERED ([mrn])
);

-- CreateTable
CREATE TABLE [dbo].[Surgery] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [number] INT NOT NULL IDENTITY(1,1),
    [patientId] UNIQUEIDENTIFIER NOT NULL,
    [procedureId] UNIQUEIDENTIFIER NOT NULL,
    [roomId] UNIQUEIDENTIFIER,
    [surgeonId] UNIQUEIDENTIFIER NOT NULL,
    [anesthetistId] UNIQUEIDENTIFIER,
    [createdById] UNIQUEIDENTIFIER NOT NULL,
    [status] VARCHAR(20) NOT NULL CONSTRAINT [Surgery_status_df] DEFAULT 'DRAFT',
    [priority] VARCHAR(12) NOT NULL CONSTRAINT [Surgery_priority_df] DEFAULT 'ELECTIVE',
    [anesthesiaType] VARCHAR(12),
    [laterality] VARCHAR(10) NOT NULL CONSTRAINT [Surgery_laterality_df] DEFAULT 'NONE',
    [estimatedMinutes] INT NOT NULL,
    [requestedDate] DATE,
    [plannedStart] DATETIME2,
    [plannedEnd] DATETIME2,
    [actualStart] DATETIME2,
    [actualEnd] DATETIME2,
    [diagnosis] NVARCHAR(300),
    [notes] NVARCHAR(1000),
    [statusReason] NVARCHAR(300),
    [version] INT NOT NULL CONSTRAINT [Surgery_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Surgery_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Surgery_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Surgery_number_key] UNIQUE NONCLUSTERED ([number])
);

-- CreateTable
CREATE TABLE [dbo].[SurgeryTeamMember] (
    [surgeryId] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    CONSTRAINT [SurgeryTeamMember_pkey] PRIMARY KEY CLUSTERED ([surgeryId],[userId])
);

-- CreateTable
CREATE TABLE [dbo].[SurgeryEquipment] (
    [surgeryId] UNIQUEIDENTIFIER NOT NULL,
    [equipmentId] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [SurgeryEquipment_pkey] PRIMARY KEY CLUSTERED ([surgeryId],[equipmentId])
);

-- CreateTable
CREATE TABLE [dbo].[ChecklistItem] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [surgeryId] UNIQUEIDENTIFIER NOT NULL,
    [key] VARCHAR(40) NOT NULL,
    [checked] BIT NOT NULL CONSTRAINT [ChecklistItem_checked_df] DEFAULT 0,
    [checkedById] UNIQUEIDENTIFIER,
    [checkedAt] DATETIME2,
    CONSTRAINT [ChecklistItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ChecklistItem_surgeryId_key_key] UNIQUE NONCLUSTERED ([surgeryId],[key])
);

-- CreateTable
CREATE TABLE [dbo].[SurgeryEvent] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [surgeryId] UNIQUEIDENTIFIER NOT NULL,
    [actorId] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(20) NOT NULL,
    [fromStatus] VARCHAR(20),
    [toStatus] VARCHAR(20),
    [note] NVARCHAR(300),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SurgeryEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SurgeryEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Unavailability] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [startsAt] DATETIME2 NOT NULL,
    [endsAt] DATETIME2 NOT NULL,
    [kind] VARCHAR(12) NOT NULL,
    [note] NVARCHAR(200),
    CONSTRAINT [Unavailability_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Notification] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [userId] UNIQUEIDENTIFIER NOT NULL,
    [type] VARCHAR(40) NOT NULL,
    [title] NVARCHAR(160) NOT NULL,
    [body] NVARCHAR(500),
    [link] VARCHAR(200),
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OutboxMessage] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [kind] VARCHAR(40) NOT NULL,
    [payload] NVARCHAR(max) NOT NULL,
    [status] VARCHAR(12) NOT NULL CONSTRAINT [OutboxMessage_status_df] DEFAULT 'PENDING',
    [attempts] INT NOT NULL CONSTRAINT [OutboxMessage_attempts_df] DEFAULT 0,
    [nextAttemptAt] DATETIME2 NOT NULL CONSTRAINT [OutboxMessage_nextAttemptAt_df] DEFAULT CURRENT_TIMESTAMP,
    [lockedUntil] DATETIME2,
    [lastError] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OutboxMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    CONSTRAINT [OutboxMessage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] UNIQUEIDENTIFIER NOT NULL,
    [actorId] UNIQUEIDENTIFIER,
    [action] VARCHAR(40) NOT NULL,
    [entity] VARCHAR(30) NOT NULL,
    [entityId] VARCHAR(40),
    [changes] NVARCHAR(max),
    [ip] VARCHAR(45),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_role_idx] ON [dbo].[User]([role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_userId_idx] ON [dbo].[RefreshToken]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshToken_familyId_idx] ON [dbo].[RefreshToken]([familyId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Patient_lastName_firstName_idx] ON [dbo].[Patient]([lastName], [firstName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Surgery_roomId_plannedStart_idx] ON [dbo].[Surgery]([roomId], [plannedStart]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Surgery_surgeonId_plannedStart_idx] ON [dbo].[Surgery]([surgeonId], [plannedStart]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Surgery_status_idx] ON [dbo].[Surgery]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SurgeryTeamMember_userId_idx] ON [dbo].[SurgeryTeamMember]([userId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SurgeryEvent_surgeryId_createdAt_idx] ON [dbo].[SurgeryEvent]([surgeryId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Unavailability_userId_startsAt_idx] ON [dbo].[Unavailability]([userId], [startsAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Notification_userId_readAt_idx] ON [dbo].[Notification]([userId], [readAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OutboxMessage_status_nextAttemptAt_idx] ON [dbo].[OutboxMessage]([status], [nextAttemptAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_entity_entityId_idx] ON [dbo].[AuditLog]([entity], [entityId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditLog_createdAt_idx] ON [dbo].[AuditLog]([createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[Branch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_supervisorId_fkey] FOREIGN KEY ([supervisorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshToken] ADD CONSTRAINT [RefreshToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ActionToken] ADD CONSTRAINT [ActionToken_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Procedure] ADD CONSTRAINT [Procedure_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[Branch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Surgery] ADD CONSTRAINT [Surgery_patientId_fkey] FOREIGN KEY ([patientId]) REFERENCES [dbo].[Patient]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Surgery] ADD CONSTRAINT [Surgery_procedureId_fkey] FOREIGN KEY ([procedureId]) REFERENCES [dbo].[Procedure]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Surgery] ADD CONSTRAINT [Surgery_roomId_fkey] FOREIGN KEY ([roomId]) REFERENCES [dbo].[Room]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Surgery] ADD CONSTRAINT [Surgery_surgeonId_fkey] FOREIGN KEY ([surgeonId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Surgery] ADD CONSTRAINT [Surgery_anesthetistId_fkey] FOREIGN KEY ([anesthetistId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Surgery] ADD CONSTRAINT [Surgery_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SurgeryTeamMember] ADD CONSTRAINT [SurgeryTeamMember_surgeryId_fkey] FOREIGN KEY ([surgeryId]) REFERENCES [dbo].[Surgery]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SurgeryTeamMember] ADD CONSTRAINT [SurgeryTeamMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SurgeryEquipment] ADD CONSTRAINT [SurgeryEquipment_surgeryId_fkey] FOREIGN KEY ([surgeryId]) REFERENCES [dbo].[Surgery]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SurgeryEquipment] ADD CONSTRAINT [SurgeryEquipment_equipmentId_fkey] FOREIGN KEY ([equipmentId]) REFERENCES [dbo].[Equipment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ChecklistItem] ADD CONSTRAINT [ChecklistItem_surgeryId_fkey] FOREIGN KEY ([surgeryId]) REFERENCES [dbo].[Surgery]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ChecklistItem] ADD CONSTRAINT [ChecklistItem_checkedById_fkey] FOREIGN KEY ([checkedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SurgeryEvent] ADD CONSTRAINT [SurgeryEvent_surgeryId_fkey] FOREIGN KEY ([surgeryId]) REFERENCES [dbo].[Surgery]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[SurgeryEvent] ADD CONSTRAINT [SurgeryEvent_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Unavailability] ADD CONSTRAINT [Unavailability_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_actorId_fkey] FOREIGN KEY ([actorId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
