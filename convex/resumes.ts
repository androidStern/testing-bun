import { v } from 'convex/values'
import { NoOp } from 'convex-helpers/server/customFunctions'
import { zCustomMutation } from 'convex-helpers/server/zod4'

import { resumeMutationSchema } from '../src/lib/schemas/resume'

import { action, mutation, query } from './_generated/server'

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
