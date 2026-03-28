import { chatWithModel, countTokens, calculateCost } from './client'

export interface ToolCall {
  name: string
  arguments: Record<string, any>
}

export async function executeTool(toolName: string, args: Record<string, any>): Promise<any> {
  switch (toolName) {
    case 'tiktok_post':
      return await postToTikTok(args)
    case 'tiktok_scrape':
      return await scrapeTikTok(args)
    case 'whatsapp_send':
      return await sendWhatsApp(args)
    case 'email_send':
      return await sendEmail(args)
    case 'system_command':
      return await executeSystemCommand(args)
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

export async function runAgentLoop({
  agentId,
  systemPrompt,
  model,
  userMessage,
}: {
  agentId: string
  systemPrompt: string
  model: string
  userMessage: string
}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  let totalTokens = 0
  let totalCost = 0

  for (let i = 0; i < 10; i++) { // Max 10 iterations
    const response = await chatWithModel({
      model,
      messages,
      tools: getToolsDefinition(),
    })

    const tokens = countTokens(JSON.stringify(response))
    const cost = calculateCost(tokens, model)
    totalTokens += tokens
    totalCost += cost

    if (!response.tool_calls || response.tool_calls.length === 0) {
      // No more tool calls, return final response
      return {
        response: response.content,
        tokens: totalTokens,
        cost: totalCost,
      }
    }

    // Execute tool calls
    for (const toolCall of response.tool_calls) {
      const toolName = toolCall.function.name
      const args = JSON.parse(toolCall.function.arguments)
      
      try {
        const result = await executeTool(toolName, args)
        
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [toolCall],
        })
        
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        })
      } catch (error) {
        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: error.message }),
          tool_call_id: toolCall.id,
        })
      }
    }
  }

  return {
    response: 'Max iterations reached',
    tokens: totalTokens,
    cost: totalCost,
  }
}

function getToolsDefinition() {
  return [
    {
      type: 'function',
      function: {
        name: 'tiktok_post',
        description: 'Post content to TikTok',
        parameters: {
          type: 'object',
          properties: {
            video_path: { type: 'string', description: 'Path to video file' },
            description: { type: 'string', description: 'Video description/caption' },
            privacy_level: { type: 'string', enum: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'] },
          },
          required: ['video_path', 'description'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'tiktok_scrape',
        description: 'Scrape TikTok trends and creators',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query or hashtag' },
            type: { type: 'string', enum: ['trends', 'creators', 'videos'] },
          },
          required: ['type'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'whatsapp_send',
        description: 'Send WhatsApp message',
        parameters: {
          type: 'object',
          properties: {
            phone_number: { type: 'string', description: 'Recipient phone number' },
            message: { type: 'string', description: 'Message content' },
          },
          required: ['phone_number', 'message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'email_send',
        description: 'Send email via SMTP',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email' },
            subject: { type: 'string', description: 'Email subject' },
            body: { type: 'string', description: 'Email body' },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'system_command',
        description: 'Execute PowerShell command on Windows',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'PowerShell command to execute' },
          },
          required: ['command'],
        },
      },
    },
  ]
}

// Tool implementations (imported from integrations)
async function postToTikTok(args: any) {
  const { tiktokUpload } = await import('../integrations/tiktok')
  return await tiktokUpload(args.video_path, args.description, args.privacy_level)
}

async function scrapeTikTok(args: any) {
  const { scrapeTrends, scrapeCreators } = await import('../integrations/tiktok')
  if (args.type === 'trends') return await scrapeTrends(args.query)
  if (args.type === 'creators') return await scrapeCreators(args.query)
  return await scrapeTrends(args.query)
}

async function sendWhatsApp(args: any) {
  const { sendMessage } = await import('../integrations/whatsapp')
  return await sendMessage(args.phone_number, args.message)
}

async function sendEmail(args: any) {
  const { sendEmail: send } = await import('../integrations/email')
  return await send(args.to, args.subject, args.body)
}

async function executeSystemCommand(args: any) {
  const { executePowerShell } = await import('../system/powershell')
  return await executePowerShell(args.command)
}
