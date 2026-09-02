import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
})

const InsightSchema = z.object({
  type: z.enum(['positive', 'warning', 'info']),
  text: z.string(),
})

const GenerationSchema = z.object({
  insights: z.array(InsightSchema).length(4),
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { metrics, sessionCount } = body

    const prompt = `
      You are an expert clinical AI assisting a caregiver of a dementia patient.
      Based on the following patient performance metrics over the last few sessions, generate 4 concise clinical insights.
      
      Patient Metrics:
      - Overall Accuracy: ${metrics?.accuracy}%
      - Average Response Time: ${metrics?.avgRTSec}s
      - Consistency (30-day): ${metrics?.consistencyPct}%
      - Total Sessions Recorded: ${sessionCount}
      
      Guidelines:
      1. Provide exactly 4 insights.
      2. Each insight should have a 'type': 'positive' (for good trends), 'warning' (for concerning declines or poor engagement), or 'info' (for general observations or next steps).
      3. The 'text' should be a concise, professional, and empathetic 1-2 sentence observation or recommendation for the caregiver.
      4. DO NOT use generic placeholders; reference the provided metrics directly if helpful.
    `

    if (!process.env.GROQ_API_KEY) {
      throw new Error('No Groq API key')
    }
    
    const { object } = await generateObject({
      model: groq('llama-3.1-8b-instant'),
      schema: GenerationSchema,
      prompt: prompt,
    })

    return NextResponse.json({
      insights: object.insights
    })
  } catch (error: any) {
    console.error('Error generating insights:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
