'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, ArrowLeft, ArrowRight, Handshake, CornerUpLeft, CornerUpRight, Lightbulb, Volume2, Mic, Camera, PartyPopper, Check, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Phase = 
  | 'idle'
  | 'fetching-levels'
  | 'speaking-physical'
  | 'waiting-physical'
  | 'speaking-cognitive'
  | 'answering'
  | 'feedback'
  | 'complete'

/** Which upper-body gesture this round expects the patient to perform */
type GestureType = 'left-raise' | 'right-raise' | 'both-raise' | 'shoulder-touch' | 'head-tilt-left' | 'head-tilt-right' | 'nose-touch' | 'ear-cover' | 'none'

type CameraStatus = 'idle' | 'pending' | 'active' | 'denied'

interface Round {
  id: number
  domain: string
  physicalInstruction: string
  cognitiveQuestion: string
  correctAnswer: string
  choices: string[]
  /** Which upper-body gesture the webcam tracker watches for */
  gesture: GestureType
  /** Difficulty of the question */
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface SessionResult {
  roundId: number
  domain: string
  chosenAnswer: string
  correctAnswer: string
  isCorrect: boolean
  /** Domain 8 (Behaviour & Engagement) is implicitly logged via this hesitation time */
  reactionTimeMs: number
  /** Whether the webcam confirmed the physical gesture was held for ≥500 ms */
  physicalGestureConfirmed: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Static game data — 7 dual-task rounds mapping to Cognitive Domains
// Domain 8 (Behaviour & Engagement) is implicitly logged via reactionTimeMs
// ─────────────────────────────────────────────────────────────────────────────

const ROUNDS: Round[] = [
  {
    id: 1,
    domain: 'Episodic Memory',
    physicalInstruction: 'Raise your LEFT hand',
    cognitiveQuestion: 'Which season comes right after winter?',
    correctAnswer: 'Spring',
    choices: ['Summer', 'Spring', 'Autumn', 'Fall'],
    gesture: 'left-raise',
    difficulty: 'easy',
  },
  {
    id: 2,
    domain: 'Working Memory',
    physicalInstruction: 'Raise your RIGHT hand',
    cognitiveQuestion: 'Remember: Tea, Silk, Apple. Which item was second?',
    correctAnswer: 'Silk',
    choices: ['Apple', 'Silk', 'Tea', 'Water'],
    gesture: 'right-raise',
    difficulty: 'easy',
  },
  {
    id: 3,
    domain: 'Attention',
    physicalInstruction: 'Raise BOTH hands',
    cognitiveQuestion: 'Find the odd number out: 4, 8, 7, 2',
    correctAnswer: '7',
    choices: ['4', '8', '7', '2'],
    gesture: 'both-raise',
    difficulty: 'easy',
  },
  {
    id: 4,
    domain: 'Executive Function',
    physicalInstruction: 'Touch BOTH shoulders',
    cognitiveQuestion: 'Put steps in order: Boil water -> Add tea leaves -> Pour milk. What is step 2?',
    correctAnswer: 'Add tea leaves',
    choices: ['Boil water', 'Pour milk', 'Add tea leaves', 'Drink'],
    gesture: 'shoulder-touch',
    difficulty: 'easy',
  },
  {
    id: 5,
    domain: 'Language',
    physicalInstruction: 'Raise your LEFT hand',
    cognitiveQuestion: "What is the opposite of 'Warm'?",
    correctAnswer: 'Cold',
    choices: ['Hot', 'Cold', 'Cool', 'Freezing'],
    gesture: 'left-raise',
    difficulty: 'easy',
  },
  {
    id: 6,
    domain: 'Visuospatial',
    physicalInstruction: 'Tilt your head LEFT',
    cognitiveQuestion: 'Which object is shaped like a triangle?',
    correctAnswer: 'Pizza slice',
    choices: ['Coin', 'Pizza slice', 'Box', 'Ball'],
    gesture: 'head-tilt-left',
  },
  {
    id: 7,
    domain: 'Orientation',
    physicalInstruction: 'Tilt your head RIGHT',
    cognitiveQuestion: 'What meal do we eat in the morning?',
    correctAnswer: 'Breakfast',
    choices: ['Lunch', 'Dinner', 'Breakfast', 'Snack'],
    gesture: 'head-tilt-right',
  },
]

// MediaPipe landmark indices used for upper-body gesture detection
const LM = {
  NOSE:           0,
  LEFT_EYE:       2,
  RIGHT_EYE:      5,
  LEFT_EAR:       7,
  RIGHT_EAR:      8,
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13,
  RIGHT_ELBOW:    14,
  LEFT_WRIST:     15,
  RIGHT_WRIST:    16,
} as const

/** How long (ms) the gesture must be held before it counts as confirmed */
const HOLD_MS = 400

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let activeAudio: HTMLAudioElement | null = null
let activeUtterance: SpeechSynthesisUtterance | null = null
let speechSafetyTimer: ReturnType<typeof setTimeout> | null = null
let speakListeners: ((text: string) => void)[] = []
let currentSpeechId = 0

export function stopSpeech() {
  currentSpeechId++
  if (speechSafetyTimer) {
    clearTimeout(speechSafetyTimer)
    speechSafetyTimer = null
  }
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.onended = null
    activeAudio.onerror = null
    activeAudio = null
  }
  if (activeUtterance) {
    activeUtterance.onend = null
    activeUtterance.onerror = null
    activeUtterance = null
  }
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  } catch (e) {}
  speakListeners.forEach(l => l(''))
}

if (typeof window !== 'undefined') {
  window.addEventListener('stop-speech', stopSpeech)
}

function speak(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined') {
    onEnd?.()
    return
  }

  stopSpeech()

  currentSpeechId++
  const speechId = currentSpeechId

  speakListeners.forEach(l => l(text))

  let hasEnded = false
  const safeEnd = () => {
    if (hasEnded) return
    hasEnded = true
    stopSpeech()
    onEnd?.()
  }

  // Safety fallback: estimate reading time (approx 90ms per char + 2500ms network buffer)
  const fallbackMs = Math.max(3500, text.length * 90 + 2500)
  speechSafetyTimer = setTimeout(safeEnd, fallbackMs)

  // 1. Try fetching human-like TTS from Deepgram
  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: 'aura-asteria-en' })
  })
  .then(async (res) => {
    if (speechId !== currentSpeechId) return
    if (!res.ok) throw new Error('TTS API failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    activeAudio = audio

    audio.onended = safeEnd
    audio.onerror = () => { throw new Error('Audio play failed') }
    
    // Play human voice
    audio.play().catch((e) => {
      console.warn('Audio play blocked:', e)
      fallbackToSpeechSynthesis(text, safeEnd)
    })
  })
  .catch((err) => {
    if (speechId !== currentSpeechId) return
    console.warn('Deepgram TTS failed or key missing, falling back to Web Speech API:', err)
    fallbackToSpeechSynthesis(text, safeEnd)
  })
}

function fallbackToSpeechSynthesis(text: string, onEnd: () => void) {
  if (!window.speechSynthesis) {
    onEnd()
    return
  }
  const utt = new SpeechSynthesisUtterance(text)
  activeUtterance = utt
  utt.rate   = 0.9
  utt.pitch  = 1.0
  utt.volume = 1.0
  utt.lang   = 'en-US'

  utt.onend = onEnd
  utt.onerror = onEnd

  try {
    window.speechSynthesis.speak(utt)
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
  } catch (err) {
    console.warn('[SpeechSynthesis speak failed]:', err)
    onEnd()
  }
}

interface Landmark { x: number; y: number; z: number; visibility?: number }

function isGestureActive(landmarks: Landmark[], gesture: GestureType): boolean {
  if (gesture === 'none') return false
  const ls = landmarks[LM.LEFT_SHOULDER]
  const rs = landmarks[LM.RIGHT_SHOULDER]
  const lw = landmarks[LM.LEFT_WRIST]
  const rw = landmarks[LM.RIGHT_WRIST]
  const le = landmarks[LM.LEFT_ELBOW]
  const re = landmarks[LM.RIGHT_ELBOW]
  const nose = landmarks[LM.NOSE]
  if (!ls || !rs || !lw || !rw) return false

  // In MediaPipe's normalised coordinate space, y=0 is top.
  // "wrist above shoulder" → wrist.y < shoulder.y
  const leftRaised  = lw.y < ls.y && (lw.visibility ?? 0) > 0.5
  const rightRaised = rw.y < rs.y && (rw.visibility ?? 0) > 0.5

  // Shoulder touch: relax to require just one wrist near any shoulder, or both wrists high up near shoulders.
  // Dementia patients often struggle to cross their arms perfectly, and cameras drop points when arms cross.
  const SHOULDER_TOUCH_THRESHOLD = 0.25 // normalised units
  const leftWristNearShoulders = lw.y < ls.y + 0.3 && (Math.abs(lw.x - ls.x) < SHOULDER_TOUCH_THRESHOLD || Math.abs(lw.x - rs.x) < SHOULDER_TOUCH_THRESHOLD)
  const rightWristNearShoulders = rw.y < rs.y + 0.3 && (Math.abs(rw.x - ls.x) < SHOULDER_TOUCH_THRESHOLD || Math.abs(rw.x - rs.x) < SHOULDER_TOUCH_THRESHOLD)
  const bothShouldersTouched = leftWristNearShoulders || rightWristNearShoulders

  // ── Head Tilt Detection ───────────────────────────────────────────────────
  // Primary metric: Eye slope and ear vertical offset.
  // In MediaPipe (unmirrored normalized coords):
  //  - landmarks[2] is user's LEFT eye (on right side of raw image frame, x > rightEye.x)
  //  - landmarks[5] is user's RIGHT eye (on left side of raw image frame, x < leftEye.x)
  // When user tilts head to their LEFT (towards left shoulder):
  //  - Left eye / ear drops lower in screen space (higher y).
  //  - Therefore: leftEye.y > rightEye.y or leftEar.y > rightEar.y.
  let headTiltedLeft = false
  let headTiltedRight = false

  const leftEye  = landmarks[LM.LEFT_EYE]
  const rightEye = landmarks[LM.RIGHT_EYE]
  const leftEar  = landmarks[LM.LEFT_EAR]
  const rightEar = landmarks[LM.RIGHT_EAR]

  if (leftEye && rightEye) {
    const eyeDy = leftEye.y - rightEye.y
    const eyeDx = Math.abs(leftEye.x - rightEye.x) || 0.1
    const eyeSlope = eyeDy / eyeDx // > 0 = tilted to user's left, < 0 = tilted to user's right

    // Relaxed threshold for head tilt
    if (eyeSlope > 0.08 || eyeDy > 0.015) {
      headTiltedLeft = true
    } else if (eyeSlope < -0.08 || eyeDy < -0.015) {
      headTiltedRight = true
    }
  }

  // Backup detection via ear landmarks
  if (!headTiltedLeft && !headTiltedRight && leftEar && rightEar) {
    const earDy = leftEar.y - rightEar.y
    if (earDy > 0.025) {
      headTiltedLeft = true
    } else if (earDy < -0.025) {
      headTiltedRight = true
    }
  }

  // Backup detection via nose offset from shoulder midpoint
  if (!headTiltedLeft && !headTiltedRight && nose) {
    const shoulderMidX = (ls.x + rs.x) / 2
    const shoulderWidth = Math.abs(rs.x - ls.x) || 0.3
    const noseOffset = (nose.x - shoulderMidX) / shoulderWidth
    if (noseOffset > 0.07) headTiltedLeft = true
    else if (noseOffset < -0.07) headTiltedRight = true
  }

  // ── Nose Touch ────────────────────────────────────────────────────────────
  const NOSE_TOUCH_THRESHOLD = 0.15
  const leftWristTouchesNose = nose && Math.abs(lw.x - nose.x) < NOSE_TOUCH_THRESHOLD && Math.abs(lw.y - nose.y) < NOSE_TOUCH_THRESHOLD
  const rightWristTouchesNose = nose && Math.abs(rw.x - nose.x) < NOSE_TOUCH_THRESHOLD && Math.abs(rw.y - nose.y) < NOSE_TOUCH_THRESHOLD
  const noseTouched = leftWristTouchesNose || rightWristTouchesNose

  // ── Ear Cover ─────────────────────────────────────────────────────────────
  const EAR_COVER_THRESHOLD = 0.2
  const leftWristCoversEar = leftEar && Math.abs(lw.x - leftEar.x) < EAR_COVER_THRESHOLD && Math.abs(lw.y - leftEar.y) < EAR_COVER_THRESHOLD
  const rightWristCoversEar = rightEar && Math.abs(rw.x - rightEar.x) < EAR_COVER_THRESHOLD && Math.abs(rw.y - rightEar.y) < EAR_COVER_THRESHOLD
  const earsCovered = leftWristCoversEar && rightWristCoversEar

  switch (gesture) {
    case 'left-raise':      return leftRaised
    case 'right-raise':     return rightRaised
    case 'both-raise':      return leftRaised && rightRaised
    case 'shoulder-touch':  return bothShouldersTouched
    case 'head-tilt-left':  return headTiltedLeft
    case 'head-tilt-right': return headTiltedRight
    case 'nose-touch':      return !!noseTouched
    case 'ear-cover':       return !!earsCovered
    default:                return false
  }
}

const GESTURE_LABELS: Record<GestureType, string> = {
  'left-raise':      '✓ Left hand raised!',
  'right-raise':     '✓ Right hand raised!',
  'both-raise':      '✓ Both hands raised!',
  'shoulder-touch':  '✓ Both shoulders touched!',
  'head-tilt-left':  '✓ Head tilted left!',
  'head-tilt-right': '✓ Head tilted right!',
  'nose-touch':      '✓ Touched nose!',
  'ear-cover':       '✓ Ears covered!',
  'none':            '',
}

const GESTURE_PROMPTS: Record<GestureType, string> = {
  'left-raise':      'Raise your LEFT hand',
  'right-raise':     'Raise your RIGHT hand',
  'both-raise':      'Raise BOTH hands',
  'shoulder-touch':  'Touch BOTH shoulders with opposite hands',
  'head-tilt-left':  'Tilt your head to the LEFT',
  'head-tilt-right': 'Tilt your head to the RIGHT',
  'nose-touch':      'Touch your nose',
  'ear-cover':       'Cover your ears',
  'none':            '',
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface GameScreenProps {
  patientId: string
  patientHistory: any[]
  preferences?: any
  onComplete?: (results: SessionResult[]) => void
  autoStart?: boolean
  defaultGameMode?: 'strict' | 'guide'
}


export default function GameScreen({ patientId, patientHistory, preferences, onComplete, autoStart, defaultGameMode = 'guide' }: GameScreenProps) {
  // ── Game state ────────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<Phase>('idle')
  const [gameMode, setGameMode]     = useState<'strict' | 'guide'>(defaultGameMode)
  const [rounds, setRounds]         = useState<Round[]>(ROUNDS)
  const [roundIndex, setRoundIndex] = useState(0)
  const [lastAnswer, setLastAnswer] = useState<{ chosen: string; correct: boolean } | null>(null)
  const [guideHighlightActive, setGuideHighlightActive] = useState(false)
  const [subtitle, setSubtitle] = useState('')

  useEffect(() => {
    const listener = (text: string) => setSubtitle(text)
    speakListeners.push(listener)
    return () => { speakListeners = speakListeners.filter(l => l !== listener) }
  }, [])
  
  // Streak & Celebration State
  const [streakData, setStreakData] = useState<{ current_streak: number; longest_streak: number; is_new_day: boolean; was_protected?: boolean } | null>(null)
  const [isPersonalized, setIsPersonalized] = useState(false)
  
  const playChime = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.45); // C6
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.error('Audio chime failed:', e);
    }
  }, []);

  // ── Camera / pose state ───────────────────────────────────────────────────
  const [cameraStatus, setCameraStatus]     = useState<CameraStatus>('idle')
  const [poseLabel, setPoseLabel]           = useState('Waiting for action...')
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false)
  const [isListening, setIsListening]       = useState(false)
  const [spokenText, setSpokenText]         = useState('')

  // ── Refs (stable across renders) ──────────────────────────────────────────
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef  = useRef<any>(null)

  const choiceShownAtRef      = useRef<number>(0)
  const resultsRef            = useRef<SessionResult[]>([])
  const gestureStartRef       = useRef<number | null>(null)
  const physicalConfirmedRef  = useRef(false)
  // Avoids stale closure inside the MediaPipe onResults callback
  const currentGestureRef     = useRef<GestureType>('none')

  // ── Camera lazy-init: only start when game is actually running ──────────
  const cameraInitializedRef = useRef(false)
  const isMountedRef         = useRef(true)

  const stopCamera = useCallback(() => {
    try {
      cameraRef.current?.stop()
      poseRef.current?.close()
    } catch (e) {}
    cameraRef.current = null
    poseRef.current   = null
    cameraInitializedRef.current = false
    setCameraStatus('idle')
  }, [])

  useEffect(() => {
    const shouldRun = phase !== 'idle' && phase !== 'complete' && phase !== 'fetching-levels'

    if (shouldRun && !cameraInitializedRef.current) {
      cameraInitializedRef.current = true

      async function initPose() {
        if (!videoRef.current || !canvasRef.current) return
        setCameraStatus('pending')

        try {
          const [
            { Pose, POSE_CONNECTIONS },
            { Camera },
            { drawConnectors, drawLandmarks },
          ] = await Promise.all([
            import('@mediapipe/pose'),
            import('@mediapipe/camera_utils'),
            import('@mediapipe/drawing_utils'),
          ])

          if (!isMountedRef.current || !cameraInitializedRef.current) return

          const pose = new Pose({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
          })

          pose.setOptions({
            modelComplexity:        1,
            smoothLandmarks:        true,
            enableSegmentation:     false,
            minDetectionConfidence: 0.65,
            minTrackingConfidence:  0.5,
          })

          pose.onResults((results: any) => {
            if (!isMountedRef.current || !cameraInitializedRef.current || !canvasRef.current) return
            const canvas = canvasRef.current
            const ctx    = canvas.getContext('2d')
            if (!ctx) return

            ctx.clearRect(0, 0, canvas.width, canvas.height)

            if (results.poseLandmarks) {
              drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
                color: '#3b82f6',
                lineWidth: 3,
              })
              drawLandmarks(ctx, results.poseLandmarks, {
                color: '#ef4444',
                lineWidth: 2,
                radius: 5,
              })

              const gesture  = currentGestureRef.current
              const detected = isGestureActive(results.poseLandmarks, gesture)

              if (gesture !== 'none' && !physicalConfirmedRef.current) {
                if (detected) {
                  if (gestureStartRef.current === null) {
                    gestureStartRef.current = Date.now()
                  } else if (Date.now() - gestureStartRef.current >= HOLD_MS) {
                    physicalConfirmedRef.current = true
                    setPhysicalConfirmed(true)
                    setPoseLabel(GESTURE_LABELS[gesture])
                  }
                } else {
                  gestureStartRef.current = null
                }
              }
            }
          })

          poseRef.current = pose

          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && poseRef.current && cameraInitializedRef.current && isMountedRef.current) {
                try {
                  await poseRef.current.send({ image: videoRef.current })
                } catch (frameErr) {
                  console.warn('[MediaPipe frame send error]:', frameErr)
                }
              }
            },
            width:      640,
            height:     480,
            facingMode: 'user',
          })

          await camera.start()
          cameraRef.current = camera
          if (isMountedRef.current && cameraInitializedRef.current) {
            setCameraStatus('active')
          }
        } catch (err) {
          console.warn('[GameScreen] Camera/MediaPipe init failed:', err)
          if (isMountedRef.current) setCameraStatus('denied')
        }
      }

      initPose()
    } else if (!shouldRun && cameraInitializedRef.current) {
      stopCamera()
    }
  }, [phase, stopCamera])

  // ── Component unmount cleanup ─────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopCamera()
      stopSpeech()
    }
  }, [stopCamera, stopSpeech])

  const currentRound = rounds[roundIndex]
  const totalRounds  = rounds.length
  
  // Any phase past idle and before complete
  const isActivePhase = phase !== 'idle' && phase !== 'complete' && phase !== 'fetching-levels'

  // Should we show the cognitive question card and answer buttons?
  const showCognitive = phase === 'speaking-cognitive' || phase === 'answering' || phase === 'feedback'

  // ── Keep gesture ref in sync + reset per round ───────────────────────────
  useEffect(() => {
    currentGestureRef.current    = rounds[roundIndex]?.gesture ?? 'none'
    gestureStartRef.current      = null
    physicalConfirmedRef.current = false
    setPhysicalConfirmed(false)
    setPoseLabel('Waiting for action...')
  }, [roundIndex])



  // ── Game logic ────────────────────────────────────────────────────────────

  // Helper to split dual-tasks into Phase 1 (Physical Warmup) and Phase 2 (Cognitive)
  const separateRounds = (rawRounds: Round[]): Round[] => {
    const separated: Round[] = []
    
    // Phase 1: Physical Warmups (First 3 rounds)
    for (let i = 0; i < Math.min(3, rawRounds.length); i++) {
      const r = rawRounds[i]
      separated.push({
        ...r,
        domain: 'Warmup: ' + r.domain
      })
    }

    // Phase 2: Cognitive Questions (Remaining rounds)
    for (let i = 3; i < rawRounds.length; i++) {
      const r = rawRounds[i]
      separated.push({
        ...r,
        gesture: 'none',
        physicalInstruction: '',
        domain: 'Cognitive: ' + r.domain
      })
    }
    
    // Re-index levels
    return separated.map((r, i) => ({ ...r, level: i + 1, id: i + 1 }))
  }

  // Ref used to trigger startRound after state settles (avoids stale closure in setTimeout)
  const pendingStartRef = useRef(false)

  const fetchLevelsAndStart = useCallback(async () => {
    setPhase('fetching-levels')
    resultsRef.current = []
    setRoundIndex(0)

    try {
      const recentQuestions = patientHistory
        .flatMap(session => session.results || session.round_results || [])
        .map(r => r.cognitiveQuestion || r.cognitive_question)
        .filter(Boolean)
        .slice(-10)

      const res = await fetch('/api/generate-levels', {
        method: 'POST',
        cache: 'no-store', // Force no caching
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({ 
          history: patientHistory, 
          patientId, 
          recentQuestions,
          randomSeed: Math.random(),
          forcedTopic: ["morning weather", "a trip to the market", "cooking dinner", "visiting a neighbor", "cleaning the house"][Math.floor(Math.random() * 5)]
        }),
      })
      if (!res.ok) throw new Error('Failed to generate levels')
      const data = await res.json()
      if (data && data.levels && data.levels.length > 0) {
        setRounds(separateRounds(data.levels))
      } else {
        setRounds(separateRounds(ROUNDS))
      }
      
      if (data?.isPersonalized) {
        setIsPersonalized(true)
      }

      // ASYNC: Fire-and-forget background replenishment for the NEXT session
      // Silently enriches the question bank while the user plays
      const diff = data?.difficulty || 'easy'
      fetch('/api/replenish-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: diff, count: 6 }),
      }).catch((e) => console.warn('[Background replenish error]:', e))

    } catch (err) {
      console.error('API failed, falling back to static rounds:', err)
      setRounds(separateRounds(ROUNDS))
    }
    // Signal the effect below to call startRound once state commits
    pendingStartRef.current = true
    setPhase('speaking-physical') // Trigger re-render so the effect sees pendingStartRef
  }, [patientHistory, patientId])

  useEffect(() => {
    if (autoStart && phase === 'idle') {
      fetchLevelsAndStart()
    }
  }, [autoStart, phase, fetchLevelsAndStart])

  const startRound = useCallback((index: number, latestRounds?: Round[]) => {
    const roundsList = latestRounds ?? rounds
    setPhase('speaking-physical')
    setLastAnswer(null)
    hasAdvancedToCognitiveRef.current = false

    const round = roundsList[index]
    if (!round) return

    if (round.gesture === 'none') {
      // Pure cognitive round: skip physical phase
      setPhase('waiting-physical') // briefly set for transition
      setTimeout(() => {
        advanceToCognitive(round)
      }, 50)
      return
    }

    const fullPrompt =
      `Round ${index + 1} of ${roundsList.length}. ` +
      `Physical task: ${round.physicalInstruction}. `

    speak(fullPrompt, () => {
      setPhase('waiting-physical')
    })
  }, [rounds])

  // When fetchLevelsAndStart sets phase to 'speaking-physical' with pendingStartRef=true,
  // we need to actually speak the prompt using the freshly-set rounds state
  useEffect(() => {
    if (phase === 'speaking-physical' && pendingStartRef.current) {
      pendingStartRef.current = false
      setLastAnswer(null)
      setRounds((latestRounds) => {
        const round = latestRounds[0]
        if (round) {
          hasAdvancedToCognitiveRef.current = false
          if (round.gesture === 'none') {
            setPhase('waiting-physical')
            setTimeout(() => {
              advanceToCognitive(round)
            }, 50)
          } else {
            const fullPrompt = `Round 1 of ${latestRounds.length}. Physical task: ${round.physicalInstruction}. `
            speak(fullPrompt, () => setPhase('waiting-physical'))
          }
        }
        return latestRounds
      })
    }
  }, [phase])

  const hasAdvancedToCognitiveRef = useRef(false)
  useEffect(() => { hasAdvancedToCognitiveRef.current = false }, [roundIndex])

  const handleAnswer = useCallback(
    (chosen: string, roundOverride?: Round) => {
      const round = roundOverride || currentRound
      if (!round) return
      
      // Prevent multiple answer submissions for the same round (e.g. double-click or click + voice)
      if (resultsRef.current.some(r => r.roundId === round.id)) return

      const reactionTimeMs = round.correctAnswer === 'none' ? 0 : Date.now() - choiceShownAtRef.current
      const isCorrect      = round.correctAnswer === 'none' || chosen === round.correctAnswer

      resultsRef.current.push({
        roundId:                  round.id,
        domain:                   round.domain,
        chosenAnswer:             chosen,
        correctAnswer:            round.correctAnswer,
        isCorrect,
        reactionTimeMs,
        physicalGestureConfirmed: physicalConfirmedRef.current,
      })

      setLastAnswer({ chosen, correct: isCorrect })
      setPhase('feedback')

      const feedbackText = round.correctAnswer === 'none'
        ? 'Great job!'
        : isCorrect
          ? 'Correct! Well done.'
          : `Not quite. The answer was ${round.correctAnswer}.`

      speak(feedbackText, async () => {
        const nextIndex = rounds.findIndex(r => r.id === round.id) + 1
        if (nextIndex >= totalRounds) {
          setPhase('complete')
          
          // Save to Supabase
          try {
            // Import dynamically or we can just make an API call to avoid importing db.ts in client component
            // Actually, we can just POST to a new server action or API route. But lib/db.ts uses standard client!
            const { saveGameSession, updatePatientStreak } = await import('@/lib/db')
            await saveGameSession(patientId, resultsRef.current)
            const streak = await updatePatientStreak(patientId)
            if (streak) {
              setStreakData(streak)
              if (streak.is_new_day) playChime()
            }
          } catch (e) {
            console.error('Failed to save session:', e)
          }

        } else {
          setRoundIndex(nextIndex)
          startRound(nextIndex)
        }
      })
    },
    [currentRound, rounds, totalRounds, onComplete, patientId, startRound],
  )

  const advanceToCognitive = useCallback((roundOverride?: Round) => {
    if (hasAdvancedToCognitiveRef.current) return
    hasAdvancedToCognitiveRef.current = true

    const round = roundOverride || currentRound
    if (!round) return

    if (round.correctAnswer === 'none') {
      // Pure physical round: skip cognitive questions
      handleAnswer('none', round)
      return
    }

    setPhase('speaking-cognitive')
    speak(`Now answer this question: ${round.cognitiveQuestion || ''}`, () => {
      choiceShownAtRef.current = Date.now()
      setPhase('answering')
    })
  }, [currentRound, handleAnswer])

  // ── Guide Mode: Delay before highlighting the correct answer (gives patient time to try first) ──
  useEffect(() => {
    if (phase === 'answering' && gameMode === 'guide') {
      setGuideHighlightActive(false)
      const timer = setTimeout(() => {
        setGuideHighlightActive(true)
      }, 3500) // 3.5-second delay before hint activates
      return () => clearTimeout(timer)
    } else {
      setGuideHighlightActive(false)
    }
  }, [phase, gameMode, roundIndex])

  // ── Auto-advance when physical gesture confirmed ─────────────────────────
  useEffect(() => {
    if (phase === 'waiting-physical' && physicalConfirmed) {
      // Small delay so the user sees the green checkmark before the next step starts
      const timer = setTimeout(() => {
        advanceToCognitive()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [phase, physicalConfirmed, advanceToCognitive])



  // ── Speech Recognition ─────────────────────────────────────────────
  
  // Keep stable refs to avoid unnecessary re-bindings in the recognition effect
  const handleAnswerRef = useRef(handleAnswer)
  useEffect(() => { handleAnswerRef.current = handleAnswer }, [handleAnswer])
  
  const currentRoundRef = useRef(currentRound)
  useEffect(() => { currentRoundRef.current = currentRound }, [currentRound])

  useEffect(() => {
    // @ts-ignore - Vendor prefixes for Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      setSpokenText('')
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.onresult = (event: any) => {
      let fullText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        fullText += event.results[i][0].transcript
      }
      setSpokenText(fullText)

      const transcript = fullText.toLowerCase().trim()
      // Remove trailing punctuation that some TTS adds (e.g. "five.")
      const cleanTranscript = transcript.replace(/[.,!?]/g, '')
      const choices = currentRoundRef.current.choices

      const numMap: Record<string, string> = {
        'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
        'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'zero': '0'
      }

      // Check if transcript matches any choice
      const matchedChoice = choices.find(c => {
        const lowerC = c.toLowerCase()
        return cleanTranscript === lowerC || cleanTranscript === numMap[lowerC] || numMap[cleanTranscript] === lowerC
      })

      if (matchedChoice) {
        handleAnswerRef.current(matchedChoice)
      }
    }

    if (phase === 'answering') {
      try { recognition.start() } catch (e) {}
    } else {
      try { recognition.stop() } catch (e) {}
      setIsListening(false)
    }

    return () => {
      try { recognition.stop() } catch (e) {}
      setIsListening(false)
    }
  }, [phase]) // only re-run when phase changes

  // ── Progress ──────────────────────────────────────────────────────────────

  const progressPct =
    phase === 'complete'
      ? 100
      : Math.round((roundIndex / totalRounds) * 100)

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  //
  // IMPORTANT: <video> and <canvas> are ALWAYS in the DOM (never inside a
  // conditional block) so their refs remain stable across phase changes.
  // We use `display: none` (not conditional JSX removal) to show/hide the
  // camera section, which does NOT cause React to unmount/remount the elements.
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 px-2 pb-6">

      {/* ════════════════════════════════════════════════════════════════════
          IDLE screen
          ════════════════════════════════════════════════════════════════════ */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center justify-center gap-4 py-6 px-2 text-center">
          <div
            aria-hidden="true"
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{ backgroundColor: '#DBEAFE' }}
          >
            🧠
          </div>

          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: 'var(--font-size-accessible-3xl)', color: 'var(--color-content-primary)' }}
          >
            Simon Says
          </h1>

          <p className="text-xl mb-6 font-medium max-w-xl text-balance" style={{ color: 'var(--color-content-secondary)' }}>
            Are you ready for your personalized dual-task exercise today? We'll test your memory, balance, and quick thinking.
          </p>

          {cameraStatus === 'denied' && (
            <p
              role="alert"
              style={{
                fontSize: 'var(--font-size-accessible-sm)',
                color: '#854D0E',
                backgroundColor: '#FEF9C3',
                border: '2px solid #FDE047',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                maxWidth: '28rem',
                fontWeight: 600,
              }}
            >
              📷 Camera unavailable — you can still play using the answer buttons.
            </p>
          )}

          {/* ── Mode Selector ────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '28rem' }}>
            <p style={{ fontSize: 'var(--font-size-accessible-sm)', fontWeight: 700, color: 'var(--color-content-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Select Mode
            </p>
            <div role="group" aria-label="Game mode" style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              {(['guide', 'strict'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  id={`mode-select-${m}`}
                  aria-pressed={gameMode === m}
                  onClick={() => setGameMode(m)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '1rem',
                    border: `2px solid ${gameMode === m ? (m === 'guide' ? '#7C3AED' : 'var(--color-accessible-blue)') : '#E2E8F0'}`,
                    backgroundColor: gameMode === m ? (m === 'guide' ? '#EDE9FE' : '#DBEAFE') : '#F8FAFC',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 'var(--font-size-accessible-sm)',
                    color: gameMode === m ? (m === 'guide' ? '#5B21B6' : '#1E40AF') : '#64748B',
                    transition: 'all 200ms ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span style={{ fontSize: '1.75rem' }}>{m === 'strict' ? '🎯' : '💡'}</span>
                  <span>{m === 'strict' ? 'Strict Mode' : 'Guide Mode'}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.75 }}>
                    {m === 'strict' ? 'No hints — real assessment' : 'Hints highlighted after a delay'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            id="start-game-btn"
            className="btn-accessible-primary"
            onClick={fetchLevelsAndStart}
            aria-label="Start the Simon Says game"
          >
            ▶ &nbsp; Let's Start
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          FETCHING screen
          ════════════════════════════════════════════════════════════════════ */}
      {phase === 'fetching-levels' && (
        <div className="flex flex-col items-center justify-center gap-4 py-6 px-2 text-center">
          <div
            aria-hidden="true"
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{ backgroundColor: '#DBEAFE' }}
          >
            <span style={{ animation: 'spin 3s linear infinite' }}>⚙️</span>
          </div>
          <h1
            className="font-extrabold tracking-tight"
            style={{ fontSize: '2.5rem', color: 'var(--color-accessible-blue)' }}
          >
            Preparing personalized exercise...
          </h1>
          <p className="text-xl mb-6 font-medium max-w-xl" style={{ color: 'var(--color-content-secondary)' }}>
            Our clinical AI is reviewing your past sessions and personal preferences to generate the perfect difficulty level for you today.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          COMPLETE screen
          ════════════════════════════════════════════════════════════════════ */}
      {phase === 'complete' && (
        <div className="flex flex-col items-center justify-center gap-4 py-6 px-2 text-center">
          <div
            aria-hidden="true"
            className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
            style={{ backgroundColor: '#DCFCE7' }}
          >
            🎉
          </div>

          <h1
            className="font-bold"
            style={{ fontSize: 'var(--font-size-accessible-3xl)', color: 'var(--color-content-primary)' }}
          >
            All Done!
          </h1>

          <p style={{ fontSize: 'var(--font-size-accessible-lg)', color: 'var(--color-content-secondary)' }}>
            You answered&nbsp;
            <strong>{resultsRef.current.filter((r) => r.isCorrect).length}</strong>&nbsp;
            out of&nbsp;<strong>{totalRounds}</strong>&nbsp;questions correctly.
          </p>

          {/* Session summary card */}
          <div
            className="card-accessible w-full max-w-sm text-left"
            role="region"
            aria-label="Session summary"
          >
            <p
              className="font-semibold mb-3"
              style={{ fontSize: 'var(--font-size-accessible-base)', color: 'var(--color-content-primary)' }}
            >
              Session summary
            </p>
            <ul className="space-y-2">
              {resultsRef.current.map((r) => (
                <li
                  key={r.roundId}
                  className="flex items-start gap-3"
                  style={{ fontSize: 'var(--font-size-accessible-sm)', color: 'var(--color-content-secondary)' }}
                >
                  <span aria-hidden="true">{r.isCorrect ? '✅' : '❌'}</span>
                  <span>
                    Round {r.roundId} — {r.isCorrect ? 'Correct' : `Wrong (${r.correctAnswer})`}
                    &nbsp;— {(r.reactionTimeMs / 1000).toFixed(1)}s
                    {r.physicalGestureConfirmed && (
                      <span style={{ marginLeft: '0.4rem', color: '#16A34A', fontWeight: 700 }}>
                        · 🤙 gesture ✓
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className="mt-4 pt-4"
              style={{ fontSize: 'var(--font-size-accessible-sm)', color: 'var(--color-content-muted)', borderTop: '2px solid #e2e8f0' }}
            >
              Average response time:&nbsp;
              <strong>
                {resultsRef.current.length > 0
                  ? (
                      Math.round(
                        resultsRef.current.reduce((s, r) => s + r.reactionTimeMs, 0) /
                          resultsRef.current.length / 100,
                      ) / 10
                    ).toFixed(1)
                  : 0}s
              </strong>
              &nbsp;·&nbsp;Physical gestures confirmed:&nbsp;
              <strong>
                {resultsRef.current.filter((r) => r.physicalGestureConfirmed).length}/{totalRounds}
              </strong>
            </p>
          </div>

          <button
            type="button"
            id="restart-game-btn"
            className="btn-accessible-secondary"
            onClick={() => {
              if (onComplete) {
                onComplete(resultsRef.current)
              } else {
                resultsRef.current = []
                setRoundIndex(0)
                setLastAnswer(null)
                startRound(0)
              }
            }}
            aria-label={onComplete ? "Continue to next step" : "Restart the game from the beginning"}
          >
            {onComplete ? 'Continue ➔' : '↩  Play Again'}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ACTIVE ROUND
          ════════════════════════════════════════════════════════════════════ */}
      {isActivePhase && (
        <>
          {/* Header & Progress bar */}
          <div className="flex flex-col gap-3 mb-2">
            
            {isPersonalized && (
              <div className="mb-2 inline-flex items-center gap-2 bg-purple-100 text-purple-900 px-4 py-2 rounded-full font-bold text-sm shadow-sm border border-purple-200">
                <span className="text-lg">✨</span> Personalized Level Loaded for Patient
              </div>
            )}

            <div className="flex items-center justify-between">
              <span
                style={{
                  fontSize: 'var(--font-size-accessible-sm)',
                  backgroundColor: '#DBEAFE',
                  color: '#1E40AF',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  border: '2px solid #BFDBFE'
                }}
              >
                Domain {currentRound.id}/8: {currentRound.domain}
              </span>
              <span style={{ fontSize: 'var(--font-size-accessible-sm)', color: 'var(--color-content-muted)', fontWeight: 600 }}>
                {progressPct}%
              </span>
            </div>
            
            <div
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Round ${roundIndex + 1} of ${totalRounds}`}
              className="w-full rounded-full overflow-hidden"
              style={{ height: '12px', backgroundColor: '#E2E8F0' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, backgroundColor: 'var(--color-accessible-blue)' }}
              />
            </div>
          </div>

          {/* Physical instruction card */}
          {currentRound.gesture !== 'none' && (
            <section className="card-accessible" aria-labelledby="physical-label">
              <p
                id="physical-label"
                className="uppercase tracking-widest font-bold mb-3"
                style={{ fontSize: 'var(--font-size-accessible-sm)', color: 'var(--color-accessible-blue)' }}
              >
                Physical Task
              </p>
              <p
                className="font-bold leading-snug"
                style={{ fontSize: 'var(--font-size-accessible-xl)', color: 'var(--color-content-primary)' }}
              >
                {currentRound.physicalInstruction}
              </p>

            {/* Guide mode: slow-blinking gesture hint */}
            {gameMode === 'guide' && phase === 'waiting-physical' && (
              <div
                role="note"
                aria-label={`Guide hint: ${GESTURE_PROMPTS[currentRound.gesture]}`}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '1rem',
                  backgroundColor: '#EDE9FE',
                  border: '2.5px solid #A78BFA',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  animation: 'guide-blink 2s ease-in-out infinite',
                }}
              >
                <span className="flex items-center text-purple-600">
                  {currentRound.gesture === 'left-raise'      && <ArrowLeft size={28} />}
                  {currentRound.gesture === 'right-raise'     && <ArrowRight size={28} />}
                  {currentRound.gesture === 'both-raise'      && <div className="flex gap-1"><ArrowLeft size={24} /><ArrowRight size={24} /></div>}
                  {currentRound.gesture === 'shoulder-touch'  && <Handshake size={28} />}
                  {currentRound.gesture === 'head-tilt-left'  && <CornerUpLeft size={28} />}
                  {currentRound.gesture === 'head-tilt-right' && <CornerUpRight size={28} />}
                  {currentRound.gesture === 'nose-touch'      && <div className="text-2xl font-black">👃</div>}
                  {currentRound.gesture === 'ear-cover'       && <Volume2 size={28} />}
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 'var(--font-size-accessible-sm)', color: '#5B21B6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lightbulb size={16} /> Guide Hint
                  </p>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-accessible-sm)', color: '#6D28D9', fontWeight: 600 }}>
                    {GESTURE_PROMPTS[currentRound.gesture]}
                  </p>
                </div>
              </div>
            )}

            {/* If we are speaking or waiting for the physical action, show a "Skip to Question" button */}
            {(phase === 'waiting-physical' || phase === 'speaking-physical') && (
              <button
                type="button"
                onClick={() => {
                  stopSpeech()
                  advanceToCognitive()
                }}
                className="mt-6 w-full"
                style={{
                  minHeight: 'var(--min-height-touch-lg)',
                  fontSize: 'var(--font-size-accessible-base)',
                  fontWeight: 600,
                  backgroundColor: '#E2E8F0',
                  color: '#334155',
                  borderRadius: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <div className="flex items-center gap-2">
                  {currentRound.correctAnswer === 'none' ? 'Skip Task' : 'Skip to Question'} <ArrowRight size={20} />
                </div>
              </button>
            )}
          </section>
          )}

          {/* Cognitive question card (Only shown when physical task is done/skipped) */}
          {showCognitive && (
            <section className="card-accessible" aria-labelledby="cognitive-label">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                <p
                  id="cognitive-label"
                  className="uppercase tracking-widest font-bold m-0"
                  style={{ fontSize: 'var(--font-size-accessible-sm)', color: 'var(--color-accessible-amber)' }}
                >
                  Now Answer
                </p>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 uppercase tracking-wide border border-amber-200">
                  Category: {currentRound.domain}
                </span>
              </div>
              <p
                className="font-bold leading-snug"
                style={{ fontSize: 'var(--font-size-accessible-xl)', color: 'var(--color-content-primary)' }}
              >
                {currentRound.cognitiveQuestion}
              </p>
            </section>
          )}

          {/* TTS speaking indicator */}
          {(phase === 'speaking-physical' || phase === 'speaking-cognitive') && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{ backgroundColor: '#EFF6FF', border: '2px solid #BFDBFE' }}
            >
              <span className="text-blue-600" aria-hidden="true" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                <Volume2 size={32} />
              </span>
              <p className="font-semibold" style={{ fontSize: 'var(--font-size-accessible-base)', color: '#1E40AF' }}>
                Listening… please follow the instructions above.
              </p>
            </div>
          )}

          {/* Voice input indicator */}
          {isListening && phase === 'answering' && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-2 rounded-2xl px-5 py-4"
              style={{ backgroundColor: '#FCE7F3', border: '2px solid #FBCFE8' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-pink-600" aria-hidden="true" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <Mic size={32} />
                </span>
                <p className="font-semibold" style={{ fontSize: 'var(--font-size-accessible-base)', color: '#9D174D' }}>
                  Listening for your answer... You can also tap a button.
                </p>
              </div>
              {spokenText && (
                <div 
                  className="mt-2 p-3 rounded-xl italic font-medium"
                  style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: '#831843' }}
                >
                  " {spokenText} "
                </div>
              )}
            </div>
          )}

          {/* Answer buttons */}
          {(phase === 'answering' || phase === 'feedback') && currentRound.correctAnswer !== 'none' && (
            <section aria-labelledby="choices-label">
              <p
                id="choices-label"
                className="font-bold mb-4"
                style={{ fontSize: 'var(--font-size-accessible-base)', color: 'var(--color-content-secondary)' }}
              >
                Choose your answer:
              </p>

              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Answer choices">
                {currentRound.choices.map((choice) => {
                  const isCorrectChoice  = choice === currentRound.correctAnswer
                  const isSelected       = lastAnswer?.chosen === choice
                  const isGuideHighlight = gameMode === 'guide' && phase === 'answering' && guideHighlightActive && isCorrectChoice

                  let bg        = isGuideHighlight ? '#7C3AED' : 'var(--color-accessible-blue)'
                  let textColor = '#ffffff'
                  if (phase === 'feedback') {
                    if (isCorrectChoice)                               bg = 'var(--color-accessible-green)'
                    else if (isSelected && !lastAnswer?.correct)       bg = 'var(--color-accessible-red)'
                    else                                               bg = '#94A3B8'
                  }

                  return (
                    <button
                      type="button"
                      key={choice}
                      id={`answer-btn-${choice.replace(/\s+/g, '-').toLowerCase()}`}
                      disabled={phase === 'feedback'}
                      onClick={() => handleAnswer(choice)}
                      aria-pressed={phase === 'feedback' ? isSelected : undefined}
                      aria-label={`Answer: ${choice}${phase === 'feedback' ? (isCorrectChoice ? ' — Correct' : isSelected ? ' — Wrong' : '') : ''}${isGuideHighlight ? ' (Hint: this is correct)' : ''}`}
                      style={{
                        minHeight:       'var(--min-height-touch-lg)',
                        fontSize:        'var(--font-size-accessible-lg)',
                        fontWeight:      700,
                        backgroundColor: bg,
                        color:           textColor,
                        border:          isGuideHighlight ? '3px solid #A78BFA' : '3px solid transparent',
                        borderRadius:    '1rem',
                        cursor:          phase === 'feedback' ? 'default' : 'pointer',
                        display:         'flex',
                        alignItems:      'center',
                        justifyContent:  'center',
                        padding:         '0.75rem',
                        transition:      'background-color 200ms ease, transform 100ms ease',
                        boxShadow:       isGuideHighlight ? '0 0 0 4px #C4B5FD' : '0 1px 2px rgb(0 0 0 / 0.12)',
                        opacity:         phase === 'feedback' && !isCorrectChoice && !isSelected ? 0.55 : 1,
                        animation:       isGuideHighlight ? 'guide-blink 2s ease-in-out infinite' : 'none',
                      }}
                    >
                      {phase === 'feedback' && isCorrectChoice && <span aria-hidden="true" className="mr-2 flex items-center"><Check size={20} />&nbsp;</span>}
                      {phase === 'feedback' && isSelected && !isCorrectChoice && <span aria-hidden="true" className="mr-2 flex items-center"><X size={20} />&nbsp;</span>}
                      {isGuideHighlight && phase === 'answering' && <span aria-hidden="true" style={{ marginRight: '0.4rem' }}><Lightbulb size={20} /></span>}
                      {choice}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Inline feedback */}
          {phase === 'feedback' && lastAnswer && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-2xl px-5 py-4 flex items-center gap-3"
              style={{
                backgroundColor: lastAnswer.correct ? '#DCFCE7' : '#FEE2E2',
                border: `2px solid ${lastAnswer.correct ? '#86EFAC' : '#FCA5A5'}`,
              }}
            >
              <span aria-hidden="true">{lastAnswer.correct ? <PartyPopper size={32} className="text-green-600" /> : <Lightbulb size={32} className="text-red-500" />}</span>
              <p
                className="font-bold"
                style={{
                  fontSize: 'var(--font-size-accessible-base)',
                  color:    lastAnswer.correct ? 'var(--color-accessible-green)' : 'var(--color-accessible-red)',
                }}
              >
                {lastAnswer.correct
                  ? 'Correct! Great job!'
                  : `Not quite — the answer was "${currentRound.correctAnswer}".`}
              </p>
            </div>
          )}

          {/* Camera unavailable fallback notice (only shown if denied AND active phase) */}
          {cameraStatus === 'denied' && (
            <p
              role="alert"
              style={{
                fontSize: 'var(--font-size-accessible-sm)',
                color: '#854D0E',
                backgroundColor: '#FEF9C3',
                border: '2px solid #FDE047',
                padding: '0.6rem 1rem',
                borderRadius: '0.75rem',
                fontWeight: 600,
              }}
            >
              <div className="flex items-center gap-2">
                <Camera size={20} /> Camera unavailable — you can skip the physical tasks and just use the buttons.
              </div>
            </p>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CAMERA FEED — always in the DOM, hidden via CSS during idle/complete.
          Using display:none (NOT conditional &&) preserves the refs so
          MediaPipe can keep running without restarting between phases.
          ════════════════════════════════════════════════════════════════════ */}
      <div
        aria-label="Webcam gesture tracking"
        style={{ display: isActivePhase ? 'block' : 'none' }}
      >
        {/* Loading overlay (shown while camera is still initialising) */}
        {cameraStatus === 'pending' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '2rem',
              backgroundColor: '#F1F5F9',
              borderRadius: '1rem',
              border: '2px dashed #CBD5E1',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 'var(--font-size-accessible-sm)', color: 'var(--color-content-muted)', fontWeight: 600, margin: 0 }}>
              ⏳ Loading gesture tracker…
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-content-muted)', margin: 0 }}>
              Allow camera access when prompted.
            </p>
          </div>
        )}

        {/* Live camera feed — visible once camera is active */}
        <div
          style={{
            display:         cameraStatus === 'active' ? 'block' : 'none',
            position:        'relative',
            maxWidth:        '400px',
            width:           '100%',
            margin:          '0 auto',
            borderRadius:    '1rem',
            overflow:        'hidden',
            backgroundColor: '#0F172A',
            aspectRatio:     '4/3',
            boxShadow:       '0 4px 16px rgb(0 0 0 / 0.2)',
          }}
        >
          {/* Live camera feed (mirrored for selfie-view) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-hidden="true"
            style={{
              position:   'absolute',
              inset:      0,
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              transform:  'scaleX(-1)',
            }}
          />

          {/* Skeleton overlay canvas (CSS-mirrored so landmarks align with video) */}
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            aria-hidden="true"
            style={{
              position:  'absolute',
              inset:     0,
              width:     '100%',
              height:    '100%',
              transform: 'scaleX(-1)',
            }}
          />

          {/* Status pill */}
          <div
            role="status"
            aria-live="polite"
            style={{
              position:        'absolute',
              bottom:          '0.75rem',
              left:            '0.5rem',
              right:           '0.5rem',
              display:         'flex',
              alignItems:      'center',
              gap:             '0.5rem',
              backgroundColor: physicalConfirmed
                ? 'rgba(22, 163, 74, 0.92)'
                : 'rgba(15, 23, 42, 0.80)',
              color:           '#ffffff',
              padding:         '0.4rem 0.875rem',
              borderRadius:    '9999px',
              fontSize:        '0.82rem',
              fontWeight:      700,
              backdropFilter:  'blur(6px)',
              transition:      'background-color 300ms ease',
            }}
          >
            <span aria-hidden="true">{physicalConfirmed ? '✓' : '👁'}</span>
            <span>
              {physicalConfirmed
                ? poseLabel
                : currentRound?.gesture !== 'none'
                  ? `Waiting — ${GESTURE_PROMPTS[currentRound?.gesture ?? 'none']}`
                  : 'Gesture tracking active'}
            </span>
          </div>

          {/* "LIVE" badge */}
          <div
            aria-hidden="true"
            style={{
              position:        'absolute',
              top:             '0.625rem',
              right:           '0.625rem',
              backgroundColor: '#EF4444',
              color:           '#fff',
              fontSize:        '0.65rem',
              fontWeight:      800,
              padding:         '0.15rem 0.5rem',
              borderRadius:    '9999px',
              letterSpacing:   '0.08em',
            }}
          >
            LIVE
          </div>
          
          {/* Subtitles Overlay */}
          {subtitle && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-8 py-4 rounded-3xl text-2xl md:text-3xl font-black shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] text-center max-w-[90vw] animate-in fade-in slide-in-from-bottom-8 border-4 border-slate-700">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
