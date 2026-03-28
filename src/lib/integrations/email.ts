import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  html?: boolean
) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    throw new Error('Email credentials not configured')
  }

  const info = await transporter.sendMail({
    from: `"AGNT Station" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: body,
    html: html ? body : undefined,
  })

  return {
    success: true,
    messageId: info.messageId,
  }
}

export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  body: string,
  html?: boolean
) {
  const results = []

  for (const recipient of recipients) {
    try {
      const result = await sendEmail(recipient, subject, body, html)
      results.push({ email: recipient, success: true, ...result })
    } catch (error) {
      results.push({ email: recipient, success: false, error: error.message })
    }
  }

  return results
}

// Verify connection
export async function verifyConnection() {
  try {
    await transporter.verify()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
