import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const paths = sqliteTable('paths', { id: integer('id').primaryKey(), name: text('name').notNull() });
export const programs = sqliteTable('programs', { id: integer('id').primaryKey(), pathId: integer('path_id').notNull().references(() => paths.id), name: text('name').notNull() });
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(),
  role: text('role').notNull(), active: integer('active').notNull().default(1),
  passwordHash: text('password_hash').notNull(), credentialVersion: integer('credential_version').notNull().default(1),
  createdAt: text('created_at').notNull(), platformUserId: text('platform_user_id'),
});
export const events = sqliteTable('events', {
  id: text('id').primaryKey(), name: text('name').notNull(), programId: integer('program_id').notNull().references(() => programs.id),
  start: text('start').notNull(), end: text('end').notNull(), schedule: text('schedule').notNull(),
  days: text('days').notNull(), customDates: text('custom_dates').notNull(), timeStart: text('time_start').notNull(), timeEnd: text('time_end').notNull(),
  owner: text('owner').notNull().default(''), status: text('status').notNull(), createdAt: text('created_at').notNull(),
});
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(), title: text('title').notNull(), owner: text('owner').notNull().default(''), due: text('due').notNull(),
  priority: text('priority').notNull(), status: text('status').notNull(), eventId: text('event_id').references(() => events.id, { onDelete: 'set null' }),
  notes: text('notes').notNull().default(''), assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
});
export const documents = sqliteTable('documents', {
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }), kind: text('kind').notNull(),
  present: integer('present').notNull().default(0), approved: integer('approved').notNull().default(0), url: text('url').notNull().default(''),
}, t => [primaryKey({ columns: [t.eventId, t.kind] })]);
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }), action: text('action').notNull(), entity: text('entity').notNull(), entityId: text('entity_id').notNull(),
  createdAt: text('created_at').notNull(), actorId: text('actor_id').notNull(), actorName: text('actor_name').notNull(),
});
export const sessions = sqliteTable('auth_sessions', {
  tokenHash: text('token_hash').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  csrfToken: text('csrf_token').notNull(), expiresAt: integer('expires_at').notNull(), lastSeen: integer('last_seen').notNull(), credentialVersion: integer('credential_version').notNull(),
}, t => [index('sessions_user').on(t.userId)]);
export const attempts = sqliteTable('auth_attempts', { bucket: text('bucket').primaryKey(), windowStart: integer('window_start').notNull(), attempts: integer('attempts').notNull() });
export const settings = sqliteTable('app_settings', { key: text('key').primaryKey(), value: text('value').notNull() });
