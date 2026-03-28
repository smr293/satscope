import axios from 'axios'

const BASE_URL = 'https://graph.facebook.com/v18.0'

export async function sendMessage(phoneNumber: string, message: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp credentials not configured')
  }

  const response = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phoneNumber.replace(/[^0-9]/g, ''), // Remove non-numeric characters
      type: 'text',
      text: {
        body: message,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return {
    success: true,
    messageId: response.data.messages?.[0]?.id,
  }
}

export async function sendTemplateMessage(
  phoneNumber: string,
  templateName: string,
  language: string = 'en_US',
  components: any[] = []
) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp credentials not configured')
  }

  const response = await axios.post(
    `${BASE_URL}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: phoneNumber.replace(/[^0-9]/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language,
        },
        components,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return {
    success: true,
    messageId: response.data.messages?.[0]?.id,
  }
}

export async function parseWebhookMessage(body: any) {
  // Parse incoming WhatsApp webhook
  const entry = body.entry?.[0]
  const changes = entry?.changes?.[0]
  
  if (changes?.field !== 'messages') {
    return null
  }

  const value = changes.value
  const messages = value.messages
  const contacts = value.contacts

  if (!messages || messages.length === 0) {
    return null
  }

  const message = messages[0]
  const contact = contacts?.[0]

  return {
    from: message.from,
    name: contact?.profile?.name,
    type: message.type,
    text: message.text?.body,
    image: message.image,
    document: message.document,
    timestamp: message.timestamp,
  }
}
