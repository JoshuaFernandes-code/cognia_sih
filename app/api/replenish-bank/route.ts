import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
})
import { z } from 'zod'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

const RoundSchema = z.object({
  domain: z.string(),
  physicalInstruction: z.string(),
  cognitiveQuestion: z.string(),
  correctAnswer: z.string(),
  choices: z.array(z.string()),
  gesture: z.enum(['left-raise', 'right-raise', 'both-raise', 'shoulder-touch', 'head-tilt-left', 'head-tilt-right', 'none']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})

const GenerationSchema = z.object({
  levels: z.array(RoundSchema)
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const targetDifficulty: 'easy' | 'medium' | 'hard' = body.difficulty || 'easy'
    const targetLevelNumber = targetDifficulty === 'hard' ? 3 : targetDifficulty === 'medium' ? 2 : 1
    const batchSize = Math.min(body.count || 6, 8)

    const prompt = `
You are an expert clinical neurologist and game designer for dementia cognitive dual-task therapy.
Your task is to generate ${batchSize} distinct, high-quality dual-task exercise questions for a cognitive exergame.
Target Difficulty: '${targetDifficulty}' (Level ${targetLevelNumber})

Difficulty Guidelines:
- Level 1 (Easy): High familiarity, straightforward associations, simple everyday orientation (e.g. days of week, basic colors, primary food meals, opposite words).
- Level 2 (Medium): Moderate working memory, sequencing 3 items, basic single-digit mental arithmetic, pattern completion.
- Level 3 (Hard): Higher cognitive load, multi-step deduction, subtle semantic distinctions, alternating attention puzzles.

Rules:
1. "gesture" must be one of: 'left-raise', 'right-raise', 'both-raise', 'shoulder-touch', 'head-tilt-left', 'head-tilt-right', 'none'.
2. "physicalInstruction" must clearly match the gesture (e.g. 'Raise your LEFT hand', 'Tilt your head to the RIGHT').
3. "cognitiveQuestion" must be accessible, engaging, and specifically calibrated to '${targetDifficulty}' (Level ${targetLevelNumber}) cognitive load.
4. "correctAnswer" must match exactly one of the 4 strings in "choices".
5. "choices" must contain exactly 4 distinct answer choices.
6. "difficulty" must be '${targetDifficulty}'.
7. "domain" should cover key neurological cognitive domains (e.g., 'Episodic Memory', 'Working Memory', 'Attention', 'Executive Function', 'Language', 'Visuospatial', 'Orientation').
`

    const { object } = await generateObject({
      model: groq('llama-3.1-8b-instant'),
      schema: GenerationSchema,
      prompt: prompt,
    })

    if (object.levels && object.levels.length > 0) {
      const inserts = object.levels.map((q) => ({
        domain: q.domain,
        physical_instruction: q.physicalInstruction,
        cognitive_question: q.cognitiveQuestion,
        correct_answer: q.correctAnswer,
        choices: q.choices,
        gesture: q.gesture,
        difficulty: targetDifficulty,
        level: targetLevelNumber,
      }))

      const { error: insertError } = await supabase
        .from('question_bank')
        .upsert(inserts, { onConflict: 'cognitive_question', ignoreDuplicates: true })

      if (insertError) {
        console.error('[replenish-bank] Error inserting into DB:', insertError)
      } else {
        console.log(`[replenish-bank] Saved ${inserts.length} questions for Level ${targetLevelNumber} (${targetDifficulty}).`)
      }
    }

    return NextResponse.json({ success: true, count: object.levels.length, level: targetLevelNumber })
  } catch (error: any) {
    console.error('[replenish-bank] Background generation failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
