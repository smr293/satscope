import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  model: text('model').notNull().default('gpt-4o'),
  tools: text('tools', { mode: 'json' }).$type<string[]>().notNull().default([]),
  schedules: text('schedules', { mode: 'json' }).$type<any[]>().notNull().default([]),
  integrations: text('integrations', { mode: 'json' }).$type<string[]>().notNull().default([]),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const agentMessages = sqliteTable('agent_messages', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  tokens: integer('tokens').default(0),
  cost: real('cost').default(0),
  createdAt: text('created_at').notNull(),
})

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  service: text('service').notNull().unique(),
  key: text('key').notNull(),
  encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
})

export const systemLogs = sqliteTable('system_logs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'system' | 'agent' | 'integration'
  level: text('level').notNull(), // 'info' | 'warn' | 'error'
  message: text('message').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
})
