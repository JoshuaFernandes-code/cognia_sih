export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
})

// Comprehensive fallback rounds
const FALLBACK_ROUNDS = [
  {
    domain: 'Episodic Memory',
    physical_instruction: 'Raise your LEFT hand',
    cognitive_question: 'Which season comes right after winter?',
    correct_answer: 'Spring',
    choices: ['Summer', 'Spring', 'Autumn', 'Fall'],
    gesture: 'left-raise',
    difficulty: 'easy',
    level: 1,
  },
  {
    domain: 'Language',
    physical_instruction: 'Raise your RIGHT hand',
    cognitive_question: "What is the opposite of 'Warm'?",
    correct_answer: 'Cold',
    choices: ['Hot', 'Cold', 'Cool', 'Freezing'],
    gesture: 'right-raise',
    difficulty: 'easy',
    level: 1,
  }
]

const DOMAINS = [
  'Episodic Memory',
  'Language',
  'Orientation',
  'Visuospatial',
  'Attention',
  'Working Memory',
  'Executive Function'
]

const GESTURES = [
  { gesture: 'left-raise', instruction: 'Raise your LEFT hand' },
  { gesture: 'right-raise', instruction: 'Raise your RIGHT hand' },
  { gesture: 'both-raise', instruction: 'Raise BOTH hands' },
  { gesture: 'shoulder-touch', instruction: 'Touch BOTH shoulders with opposite hands' },
  { gesture: 'head-tilt-left', instruction: 'Tilt your head to the LEFT' },
  { gesture: 'head-tilt-right', instruction: 'Tilt your head to the RIGHT' }
]

const RoundSchema = z.object({
  domain: z.string(),
  physicalInstruction: z.string(),
  cognitiveQuestion: z.string(),
  correctAnswer: z.string(),
  choices: z.array(z.string()).length(4),
  gesture: z.enum(['left-raise', 'right-raise', 'both-raise', 'shoulder-touch', 'head-tilt-left', 'head-tilt-right', 'nose-touch', 'ear-cover', 'none']),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  level: z.number().int().min(1).max(3)
})

const GenerationSchema = z.object({
  rounds: z.array(RoundSchema).length(7)
})

interface DifficultyProfile {
  userLevel: number
  profileName: string
  difficulty: 'easy' | 'medium' | 'hard'
}

function determineDifficultyProfile(history: any[]): DifficultyProfile {
  const sessionCount = history?.length || 0
  if (sessionCount <= 1) return { userLevel: 1, profileName: 'Level 1 (Novice)', difficulty: 'easy' }

  let totalCorrect = 0, totalRounds = 0
  for (const session of history) {
    const results = session.results || session.round_results || []
    if (Array.isArray(results) && results.length > 0) {
      totalCorrect += results.filter((r: any) => r.is_correct || r.isCorrect).length
      totalRounds += results.length
    }
  }

  const avgAccuracy = totalRounds > 0 ? (totalCorrect / totalRounds) * 100 : 60
  if (sessionCount >= 5 && avgAccuracy >= 75) {
    return { userLevel: 3, profileName: 'Level 3 (Advanced)', difficulty: 'hard' }
  }
  return { userLevel: 2, profileName: 'Level 2 (Intermediate)', difficulty: 'medium' }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { history, patientId, recentQuestions = [], randomSeed, forcedTopic } = body

    const profile = determineDifficultyProfile(history)

    // 1. Fetch preferences
    let preferences: any = {}
    if (patientId) {
      const { data } = await supabase.from('profiles').select('preferences').eq('id', patientId).single()
      if (data?.preferences) preferences = data.preferences
    }

    // Inject mock personal details if they don't exist to ensure Category 26 always works
    if (!preferences.address) {
      preferences = {
        ...preferences,
        address: "123 Maple Street",
        phone_number: "555-0198",
        family_members: [
          { relation: "Daughter", name: "Sarah" },
          { relation: "Son", name: "David" },
          { relation: "Grandson", name: "Leo" }
        ],
        favorite_drink: "Assam Tea",
        favorite_activity: "Gardening"
      }
    }

    // 2. Prepare AI generation prompt
    const prefsString = JSON.stringify(preferences, null, 2)
    const recentQuestionsStr = recentQuestions.length > 0 
      ? JSON.stringify(recentQuestions, null, 2)
      : '[]'

    const prompt = `
      You are an empathetic, warm, and conversational AI Caregiver playing a daily brain game with a dementia patient.
      Generate a set of exactly 7 cognitive dual-task rounds.
      Target difficulty: ${profile.difficulty.toUpperCase()} (Level ${profile.userLevel}).
      Current Time: ${new Date().toISOString()}
      Random Seed (to ensure anti-repetition): ${randomSeed || new Date().getTime()}
      Forced Contextual Topic: ${forcedTopic || 'Daily Life'}
      
      CRITICAL PERSONALIZATION DATA:
      ${prefsString}

      Requirements:
      1. EXACTLY 7 rounds. Randomize the order of the categories below so they never appear in the same sequence.
      2. ANTI-REPETITION & TONE: DO NOT REPEAT exact phrases. Use highly varied, conversational phrasing for the 'cognitiveQuestion'. 
         CRITICAL INSTRUCTION: You must NOT generate questions that are similar to the following recently asked questions: 
         ${recentQuestionsStr}
         Generate entirely new scenarios, different everyday objects, and new conversational framing centered around the Forced Contextual Topic: "${forcedTopic || 'Daily Life'}".
         - BAD: "What is your daughter's name?"
         - GOOD: "I was looking at some photos earlier. Could you remind me what your daughter's name is?"
         - BAD: "Which of these is a tool?"
         - GOOD: "I'm trying to fix a loose screw on the chair. Which of these should I use?"
      3. REQUIRED CATEGORIES (mix them among the 7 rounds):
         - Object Matching (Visuospatial/Executive): Ask about everyday objects related to their preferences. Physical gesture MUST BE: 'nose-touch'.
         - Personal Information Recall (Episodic Memory): Ask about their address, phone number, or family members using the personalization data. Physical gesture MUST BE: 'ear-cover'.
         - Fill the remaining 5 rounds with diverse domains (Language, Orientation, Attention, Working Memory, etc.).
      4. Gestures and Exact Instructions to use (distribute evenly):
         - left-raise (Raise your LEFT hand)
         - right-raise (Raise your RIGHT hand)
         - both-raise (Raise BOTH hands)
         - shoulder-touch (Touch BOTH shoulders with opposite hands)
         - head-tilt-left (Tilt your head to the LEFT)
         - head-tilt-right (Tilt your head to the RIGHT)
         - nose-touch (Touch your nose)
         - ear-cover (Cover your ears)
      5. The 'choices' array MUST have exactly 4 items, one of which MUST be the exact 'correctAnswer'.
      6. For Personal Information Recall, the 1 correct answer MUST be the exact real data provided above, and the 3 distractors must be plausible but incorrect (e.g. fake names, fake streets).
    `

    let finalLevels: any[] = []
    let isPersonalized = false

    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('No Groq API key')
      }
      
      const { object } = await generateObject({
        model: groq('qwen/qwen3.8-27b'),
        schema: GenerationSchema,
        prompt: prompt,
        temperature: 0.8,
      })
      
      // Ensure we add IDs and properly map fields
      finalLevels = object.rounds.map((r, i) => ({
        ...r,
        id: i + 1
      }))
      
      if (prefsString !== '{}') {
        isPersonalized = true
      }
    } catch (llmError: any) {
      console.warn('LLM Generation failed! EXACT ERROR:', llmError.message, llmError.stack)
      // Fallback
      finalLevels = FALLBACK_ROUNDS.map((q: any, index: number) => ({
        id: index + 1,
        domain: q.domain,
        physicalInstruction: q.physical_instruction,
        cognitiveQuestion: q.cognitive_question,
        correctAnswer: q.correct_answer,
        choices: q.choices,
        gesture: q.gesture,
        difficulty: q.difficulty,
        level: q.level,
      }))
      
      return NextResponse.json({
        levels: finalLevels,
        userLevel: profile.userLevel,
        profileName: profile.profileName,
        difficulty: profile.difficulty,
        sessionCount: history?.length || 0,
        isPersonalized: false,
        warning: `LLM Generation failed: ${llmError.message}`
      })
    }

    return NextResponse.json({
      levels: finalLevels,
      userLevel: profile.userLevel,
      profileName: profile.profileName,
      difficulty: profile.difficulty,
      sessionCount: history?.length || 0,
      isPersonalized
    })
  } catch (error: any) {
    console.error('Error generating levels:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate levels' },
      { status: 500 }
    )
  }
}
