import { generateWithCodex } from './client'
import { db } from '../db'
import { agents } from '../db/schema'
import { eq } from 'drizzle-orm'

export interface AgentConfig {
  name: string
  description: string
  systemPrompt: string
  model: string
  tools: string[]
  schedules: ScheduleConfig[]
  integrations: string[]
}

export interface ScheduleConfig {
  task: string
  cron: string
  enabled: boolean
}

export async function buildAgentFromPrompt(prompt: string): Promise<AgentConfig> {
  const config = await generateWithCodex(`
You are an AI Agent Builder. Convert this natural language request into a complete agent configuration.

USER REQUEST: "${prompt}"

Generate a JSON object with this exact structure:
{
  "name": "short descriptive name",
  "description": "one sentence description",
  "systemPrompt": "detailed system prompt for the agent",
  "model": "gpt-4o or claude-sonnet-4-20250514 or groq-llama-3.3-70b",
  "tools": ["list of tool names needed"],
  "schedules": [{"task": "what to do", "cron": "cron expression", "enabled": true}],
  "integrations": ["tiktok", "whatsapp", "email", "system"]
}

Available tools:
- tiktok_post: Post content to TikTok
- tiktok_scrape: Scrape trends/creators
- whatsapp_send: Send WhatsApp messages
- email_send: Send emails
- system_command: Execute PowerShell commands
- web_search: Search the web
- file_read: Read files
- file_write: Write files

Example input: "Create a TikTok agent that posts daily at 6pm, scrapes trends every morning, and sends me a WhatsApp report each evening"

Example output:
{
  "name": "TikTok Growth Agent",
  "description": "Automated TikTok content posting and trend analysis",
  "systemPrompt": "You are a TikTok growth specialist. Your job is to create engaging content, post at optimal times, analyze trending topics, and report performance metrics...",
  "model": "gpt-4o",
  "tools": ["tiktok_post", "tiktok_scrape", "whatsapp_send"],
  "schedules": [
    {"task": "post_content", "cron": "0 18 * * *", "enabled": true},
    {"task": "scrape_trends", "cron": "0 8 * * *", "enabled": true},
    {"task": "send_report", "cron": "0 20 * * *", "enabled": true}
  ],
  "integrations": ["tiktok", "whatsapp"]
}

Now generate the config for the user's request. Return ONLY valid JSON.
`)

  return config as AgentConfig
}

export async function saveAgent(config: AgentConfig): Promise<string> {
  const id = `agent_${Date.now()}`
  const now = new Date().toISOString()

  await db.insert(agents).values({
    id,
    name: config.name,
    description: config.description,
    systemPrompt: config.systemPrompt,
    model: config.model,
    tools: config.tools,
    schedules: config.schedules,
    integrations: config.integrations,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  return id
}

export async function getAgents() {
  return await db.select().from(agents)
}

export async function getAgent(id: string) {
  const result = await db.select().from(agents).where(eq(agents.id, id))
  return result[0] || null
}

export async function deleteAgent(id: string) {
  await db.delete(agents).where(eq(agents.id, id))
}

export async function toggleAgent(id: string, isActive: boolean) {
  await db.update(agents)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(agents.id, id))
}
