/**
 * Simple email utility for scrape-pipeline
 * Uses nodemailer with AWS SES SMTP
 */

import nodemailer from 'nodemailer'

function getTransporter() {
  const region = process.env.AWS_REGION
  const user = process.env.AWS_SES_SMTP_USER
  const pass = process.env.AWS_SES_SMTP_PASS

  if (!region || !user || !pass) {
    throw new Error(
      'AWS SES email not configured (missing AWS_REGION, AWS_SES_SMTP_USER, or AWS_SES_SMTP_PASS)',
    )
  }

  return nodemailer.createTransport({
    auth: { pass, user },
    host: `email-smtp.${region}.amazonaws.com`,
    port: 587,
    secure: false,
  })
}

export async function sendEmail(subject: string, body: string): Promise<void> {
  const fromEmail = process.env.SES_FROM_EMAIL
  if (!fromEmail) {
    throw new Error('SES_FROM_EMAIL not configured')
  }

  const transporter = getTransporter()
  await transporter.sendMail({
    from: `Recovery Jobs Pipeline <${fromEmail}>`,
    subject,
    text: body,
    to: 'andrew@recovery-jobs.com',
  })
}
