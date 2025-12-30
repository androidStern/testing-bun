import { v } from 'convex/values'
import { NoOp } from 'convex-helpers/server/customFunctions'
import { zCustomMutation } from 'convex-helpers/server/zod4'

import {
  educationFromDictationSchema,
  resumeExtractionSchema,
  resumeMutationSchema,
  summaryFromDictationSchema,
  workExperienceFromDictationSchema,
} from '../src/lib/schemas/resume'

import { action, internalQuery, mutation, query } from './_generated/server'

const zodMutation = zCustomMutation(mutation, NoOp)

export const getByWorkosUserId = query({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('resumes')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .first()
  },
})

// Internal query for agent tools - returns same shape as public version
export const getByWorkosUserIdInternal = internalQuery({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('resumes')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .first()
  },
  returns: v.any(),
})

export const upsert = zodMutation({
  args: resumeMutationSchema,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('resumes')
      .withIndex('by_workos_user_id', q => q.eq('workosUserId', args.workosUserId))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      })
      return existing._id
    } else {
      return await ctx.db.insert('resumes', {
        ...args,
        createdAt: now,
        updatedAt: now,
      })
    }
  },
})

// AI polishing action using Groq
export const polishWithAI = action({
  args: {
    context: v.optional(
      v.object({
        achievements: v.optional(v.string()),
        // For workExperience context
        company: v.optional(v.string()),
        degree: v.optional(v.string()),
        field: v.optional(v.string()),
        // For education context
        institution: v.optional(v.string()),
        // For summary context
        personalInfo: v.optional(
          v.object({
            location: v.optional(v.string()),
            name: v.optional(v.string()),
          }),
        ),
        position: v.optional(v.string()),
        skills: v.optional(v.string()),
        workExperience: v.optional(
          v.array(
            v.object({
              achievements: v.optional(v.string()),
              company: v.optional(v.string()),
              description: v.optional(v.string()),
              endDate: v.optional(v.string()),
              position: v.optional(v.string()),
              startDate: v.optional(v.string()),
            }),
          ),
        ),
      }),
    ),
    currentText: v.optional(v.string()),
    type: v.union(v.literal('summary'), v.literal('workExperience'), v.literal('education')),
  },
  handler: async (_ctx, args) => {
    const { generateText } = await import('ai')
    const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    })

    let prompt = ''

    if (args.type === 'workExperience') {
      prompt = `You are an expert resume writer. Polish the following job description to be more professional, concise, and ATS-friendly.

Current Job Description:
${args.currentText || 'No description provided'}

Context:
- Company: ${args.context?.company || 'N/A'}
- Position: ${args.context?.position || 'N/A'}
- Key Achievements: ${args.context?.achievements || 'N/A'}

Instructions:
- Keep it concise (2-4 sentences)
- Use strong action verbs
- Focus on responsibilities and impact
- Make it ATS-friendly with relevant keywords
- If the input is empty or very short, create a professional description based on the position and company
- Return ONLY the polished description, no additional commentary

Polished Job Description:`
    } else if (args.type === 'education') {
      prompt = `You are an expert resume writer. Polish the following education additional information to be more professional, concise, and relevant.

Current Additional Information:
${args.currentText || 'No information provided'}

Context:
- Institution: ${args.context?.institution || 'N/A'}
- Degree: ${args.context?.degree || 'N/A'}
- Field: ${args.context?.field || 'N/A'}

Instructions:
- Keep it concise (2-3 sentences)
- Focus on relevant coursework, honors, activities, or achievements
- Make it relevant to potential employers
- If the input is empty, provide a brief, professional statement or leave it minimal
- Return ONLY the polished description, no additional commentary

Polished Additional Information:`
    } else {
      // Professional Summary polishing
      const resumeContext = `
Personal Information:
- Name: ${args.context?.personalInfo?.name || 'Not provided'}
- Location: ${args.context?.personalInfo?.location || 'Not provided'}

Work Experience:
${
  args.context?.workExperience
    ?.map(
      exp => `
- ${exp.position || 'Position'} at ${exp.company || 'Company'} (${exp.startDate || 'Start'} - ${exp.endDate || 'End'})
  ${exp.description || ''}
  ${exp.achievements || ''}
`,
    )
    .join('\n') || 'Not provided'
}

Skills: ${args.context?.skills || 'Not provided'}

Current Summary: ${args.currentText || 'No summary provided yet'}
      `.trim()

      prompt = `You are an expert resume writer specializing in creating ATS-friendly professional summaries.

Based on the following resume information, ${args.currentText ? 'improve and polish the existing professional summary' : 'create a compelling professional summary'} that:
- Is 3-5 sentences long
- Highlights key achievements and expertise
- Uses action-oriented language
- Includes relevant keywords for ATS optimization
- Is professional and concise
- Focuses on value and impact

${resumeContext}

Generate ONLY the professional summary text, without any additional commentary or formatting. Make it compelling and ATS-optimized.`
    }

    const { text } = await generateText({
      maxOutputTokens: 300,
      model: openrouter('meta-llama/llama-3.3-70b-instruct', {
        extraBody: {
          provider: {
            allow_fallbacks: false,
            order: ['Groq'],
          },
        },
      }),
      prompt,
    })

    return { polishedText: text.trim() }
  },
})

// Generate upload URL for resume file
export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    return await ctx.storage.generateUploadUrl()
  },
})

// Parse resume from Convex storage
export const parseResumeFromStorage = action({
  args: {
    filename: v.string(),
    mimeType: v.string(),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, { filename, mimeType, storageId }) => {
    const url = await ctx.storage.getUrl(storageId)
    if (!url) throw new Error('File URL not found')

    const { generateObject } = await import('ai')
    const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')

    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    })
    const model = openrouter('qwen/qwen-2.5-7b-instruct')

    const isDocx =
      mimeType.includes('wordprocessingml.document') || filename.toLowerCase().endsWith('.docx')

    if (isDocx) {
      // DOCX: fetch and extract text with mammoth
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to download DOCX')
      const buffer = Buffer.from(await response.arrayBuffer())
      const mammoth = await import('mammoth')
      const { value: text } = await mammoth.extractRawText({ buffer })

      const { object } = await generateObject({
        model,
        prompt: `Resume content:\n\n${text}`,
        schema: resumeExtractionSchema,
        system:
          'You are a strict resume parser. Extract structured data from the resume. Use null for unknown fields.',
      })
      return object
    }

    // PDF: pass file URL directly to the model
    const { object } = await generateObject({
      messages: [
        {
          content: [
            { text: 'Parse this resume into the schema.', type: 'text' },
            {
              data: url,
              mediaType: (mimeType || 'application/pdf') as 'application/pdf',
              type: 'file',
            },
          ],
          role: 'user',
        },
      ],
      model,
      schema: resumeExtractionSchema,
      system:
        'You are a strict resume parser. Extract structured data from the resume. Use null for unknown fields.',
    })
    return object
  },
})

// Transcribe audio and extract structured section data
export const transcribeSectionFromStorage = action({
  args: {
    mimeType: v.string(),
    section: v.union(v.literal('summary'), v.literal('workExperience'), v.literal('education')),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId)
    if (!url) throw new Error('File URL not found')

    const { default: OpenAI, toFile } = await import('openai')
    const { generateObject } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Download audio from Convex storage
    const response = await fetch(url)
    if (!response.ok) throw new Error('Failed to download audio')
    const arrayBuffer = await response.arrayBuffer()

    // Convert ArrayBuffer → File for Whisper API
    const file = await toFile(new Uint8Array(arrayBuffer), 'dictation.webm', {
      type: args.mimeType,
    })

    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    })

    const transcript = transcription.text
    if (!transcript) throw new Error('Empty transcript from Whisper')

    if (args.section === 'summary') {
      const { object } = await generateObject({
        model: openai('gpt-4.1'),
        prompt: transcript,
        schema: summaryFromDictationSchema,
        system:
          'You are an expert resume writer. Turn the transcript into a concise, ATS-friendly professional summary. Return only the summary field.',
      })

      return {
        section: 'summary' as const,
        summary: object.summary,
        transcript,
      }
    }

    if (args.section === 'workExperience') {
      const { object } = await generateObject({
        model: openai('gpt-4.1'),
        prompt: transcript,
        schema: workExperienceFromDictationSchema,
        system:
          'You are a strict resume parser. Extract exactly one work experience entry from the transcript. Use null for unknown fields.',
      })

      const entry = object.workExperience[0]

      return {
        section: 'workExperience' as const,
        transcript,
        workExperience: entry,
      }
    }

    const { object } = await generateObject({
      model: openai('gpt-4.1'),
      prompt: transcript,
      schema: educationFromDictationSchema,
      system:
        'You are a strict resume parser. Extract exactly one education entry from the transcript. Use null for unknown fields.',
    })

    const edu = object.education[0]

    return {
      education: edu,
      section: 'education' as const,
      transcript,
    }
  },
})
