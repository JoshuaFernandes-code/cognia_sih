'use client'

import { useState, useEffect, useRef } from 'react'
import { Target, Lightbulb, Mic } from 'lucide-react'
import GameScreen, { SessionResult } from '@/components/GameScreen'
import { saveGameSession } from '@/lib/db'

type Step = 'setup' | 'greeting' | 'checkin' | 'breathing' | 'cognitive' | 'caregiver' | 'feedback' | 'done'

interface DailySessionScreenProps {
  patientId: string;
  patientName: string;
  patientHistory: any[];
  preferences: any;
  onSessionComplete: () => void;
}

// Helper to use speech synthesis securely
let activeAudio: HTMLAudioElement | null = null;
let speechSafetyTimer: any = null;
let speakListeners: ((text: string) => void)[] = [];
let currentSpeechId = 0;
export function stopSpeech() {
  currentSpeechId++;
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
  try {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  } catch (e) {}
  speakListeners.forEach(l => l(''))
}

if (typeof window !== 'undefined') {
  window.addEventListener('stop-speech', stopSpeech)
}

function speak(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined') {
    onEnd?.()
    return
  }

  stopSpeech()

  currentSpeechId++;
  const speechId = currentSpeechId;

  speakListeners.forEach(l => l(text));

  let hasEnded = false
  const safeEnd = () => {
    if (hasEnded) return
    hasEnded = true
    stopSpeech()
    onEnd?.()
  }

  const fallbackMs = Math.max(3500, text.length * 90 + 2500)
  speechSafetyTimer = setTimeout(safeEnd, fallbackMs)

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: 'aura-asteria-en' })
  })
  .then(async (res) => {
    if (speechId !== currentSpeechId) return;
    if (!res.ok) throw new Error('TTS API failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    activeAudio = audio

    audio.onended = safeEnd
    audio.onerror = () => { throw new Error('Audio play failed') }
    
    audio.play().catch((e) => {
      console.warn('Audio play blocked:', e)
      fallbackToSpeechSynthesis(text, safeEnd)
    })
  })
  .catch((err) => {
    if (speechId !== currentSpeechId) return;
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
  utt.rate = 0.9
  utt.pitch = 1.0
  utt.onend = onEnd
  utt.onerror = onEnd
  try {
    window.speechSynthesis.speak(utt)
  } catch (err) {
    onEnd()
  }
}

// Helper to record and transcribe via Groq
async function recordAndTranscribe(durationMs = 4000): Promise<string> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    const chunks: BlobPart[] = []
    
    mediaRecorder.ondataavailable = e => chunks.push(e.data)
    
    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('file', blob)
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          const data = await res.json()
          resolve((data.text || '').trim().toLowerCase())
        } catch (err) {
          resolve('')
        }
      }
      mediaRecorder.start()
      setTimeout(() => mediaRecorder.stop(), durationMs)
    })
  } catch (err) {
    console.error('Mic error:', err)
    return '' // fail silently and let user use buttons
  }
}

export default function DailySessionScreen({ patientId, patientName, patientHistory, preferences, onSessionComplete }: DailySessionScreenProps) {
  const [currentStep, setCurrentStep] = useState<Step>('setup')
  const [permissionsGranted, setPermissionsGranted] = useState(false)
  const [gameMode, setGameMode] = useState<'guide' | 'strict'>('guide')
  
  // Session Metrics
  const [mood, setMood] = useState<string>('')
  const [didBreathing, setDidBreathing] = useState<boolean>(false)
  const [loopsCompleted, setLoopsCompleted] = useState<number>(0)
  const [gameResults, setGameResults] = useState<SessionResult[]>([])

  const [isListening, setIsListening] = useState(false)
  const [breathingActive, setBreathingActive] = useState(false)
  const [breathingTimeLeft, setBreathingTimeLeft] = useState(60)
  const breathingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const breathingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [subtitle, setSubtitle] = useState('')

  useEffect(() => {
    const listener = (text: string) => setSubtitle(text)
    speakListeners.push(listener)
    return () => { speakListeners = speakListeners.filter(l => l !== listener) }
  }, [])
  
  // Track the actual current step for async callbacks to prevent racing
  const stepRef = useRef<Step>(currentStep)
  useEffect(() => { stepRef.current = currentStep }, [currentStep])
  
  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [])

  // ---------------------------------------------------------------------------
  // STEP 0: Setup & Permissions
  // ---------------------------------------------------------------------------
  const handleStartSession = async () => {
    try {
      // Request mic permission upfront
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // Stop it immediately, we just wanted permission
      setPermissionsGranted(true)
      
      // Unlock speech synthesis on this user interaction
      const dummy = new SpeechSynthesisUtterance('')
      dummy.volume = 0
      window.speechSynthesis.speak(dummy)
      
      setCurrentStep('greeting')
    } catch (err) {
      console.error('Permission denied:', err)
      alert("Microphone access is required for the voice assistant. Please allow it in your browser settings.")
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Greeting
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 'greeting') {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dayString = now.toLocaleDateString([], { weekday: 'long' });
      const prompt = `Hello ${patientName}. Today is ${dayString}. The time is ${timeString}. Let's start our daily session.`;
      
      speak(prompt, () => {
        setCurrentStep('checkin')
      })
    }
  }, [currentStep, patientName])

  // ---------------------------------------------------------------------------
  // STEP 2: Check-in
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 'checkin') {
      speak("How are you feeling today?", async () => {
        setIsListening(true)
        // Record for 4 seconds
        const text = await recordAndTranscribe(4000)
        setIsListening(false)
        
        // Only apply if user hasn't already clicked a button to advance
        if (text && stepRef.current === 'checkin') {
          handleMoodSelect(text.length > 20 ? 'Okay' : text) // Basic heuristic if they babble
        } else {
          // If silence or already advanced, do nothing
        }
      })
    }
  }, [currentStep])

  const handleMoodSelect = (selectedMood: string) => {
    setMood(selectedMood)
    try { window.speechSynthesis.cancel() } catch(e) {}
    setCurrentStep('breathing')
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Breathing
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 'breathing') {
      speak("Would you like to do a quick 1-minute breathing exercise before we play?", async () => {
        setIsListening(true)
        const text = await recordAndTranscribe(4000)
        setIsListening(false)
        
        if (stepRef.current !== 'breathing') return; // Abort if user clicked a button
        
        if (text.includes('yes') || text.includes('yeah') || text.includes('sure') || text.includes('okay')) {
          startBreathing()
        } else if (text.includes('no') || text.includes('skip') || text.includes('later')) {
          skipBreathing()
        }
      })
    }
  }, [currentStep])

  const startBreathing = () => {
    setDidBreathing(true)
    setBreathingActive(true)
    setBreathingTimeLeft(60)
    try { window.speechSynthesis.cancel() } catch(e) {}
    
    // Start countdown interval
    breathingIntervalRef.current = setInterval(() => {
      setBreathingTimeLeft((prev) => {
        if (prev <= 1) {
          if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Run animation for 60 seconds, then move on
    breathingTimerRef.current = setTimeout(() => {
      setBreathingActive(false)
      if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current)
      setCurrentStep('cognitive')
    }, 60000)
  }

  const skipBreathing = () => {
    if (breathingTimerRef.current) {
      clearTimeout(breathingTimerRef.current)
    }
    if (breathingIntervalRef.current) {
      clearInterval(breathingIntervalRef.current)
    }
    setBreathingActive(false)
    window.dispatchEvent(new Event('stop-speech'))
    setCurrentStep('cognitive')
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Cognitive (GameScreen) is handled in render
  // ---------------------------------------------------------------------------
  const handleGameComplete = (results: SessionResult[]) => {
    setGameResults(prev => [...prev, ...results])
    setCurrentStep('caregiver')
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Caregiver Task
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 'caregiver') {
      const task = preferences?.caregiver_daily_task || "I just wanted to say I love you, have a great day!"
      const prompt = `Here is a message for you: ${task}. Say 'I did it' or click the button when you are done.`
      speak(prompt, async () => {
        // We will do a looping listen until they say done or click
        const loopListen = async () => {
          setIsListening(true)
          const text = await recordAndTranscribe(5000)
          setIsListening(false)
          
          if (stepRef.current !== 'caregiver') return; // Abort if user clicked
          
          if (text.includes('done') || text.includes('did it') || text.includes('yes') || text.includes('finished')) {
            handleCaregiverTaskDone()
          } else {
            // Restart loop if they didn't say it and haven't clicked
            setTimeout(loopListen, 500)
          }
        }
        loopListen()
      })
    }
  }, [currentStep, preferences])

  const handleCaregiverTaskDone = () => {
    try { window.speechSynthesis.cancel() } catch(e) {}
    setCurrentStep('feedback')
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Feedback & Loop
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (currentStep === 'feedback') {
      speak("Wonderful job today! You did great! Would you like to play a few more games?", async () => {
        setIsListening(true)
        const text = await recordAndTranscribe(4000)
        setIsListening(false)
        
        if (stepRef.current !== 'feedback') return; // Abort if user clicked
        
        if (text.includes('yes') || text.includes('yeah') || text.includes('sure') || text.includes('okay')) {
          handleLoop('yes')
        } else if (text.includes('no') || text.includes('stop') || text.includes('done')) {
          handleLoop('no')
        }
      })
    }
  }, [currentStep])

  const handleLoop = async (choice: 'yes' | 'no') => {
    try { window.speechSynthesis.cancel() } catch(e) {}
    
    if (choice === 'yes') {
      setLoopsCompleted(prev => prev + 1)
      setCurrentStep('cognitive')
    } else {
      setCurrentStep('done')
      // Save everything
      try {
        await saveGameSession(patientId, gameResults, {
          mood_reported: mood,
          did_breathing_exercise: didBreathing,
          loops_completed: loopsCompleted + 1
        })
      } catch (err) {
        console.error('Failed to save full session data:', err)
      }
      onSessionComplete()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  const renderSubtitle = () => {
    if (!subtitle) return null;
    return (
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-8 py-4 rounded-3xl text-2xl md:text-3xl font-black shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-[100] text-center max-w-[90vw] animate-in fade-in slide-in-from-bottom-8 border-4 border-slate-700">
        {subtitle}
      </div>
    );
  }

  if (currentStep === 'setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500 w-full px-4 text-center">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 text-center mb-6">Ready for your session?</h1>
        <p className="text-xl font-semibold text-slate-600 dark:text-slate-300 text-center max-w-2xl mx-auto mb-12">
          We will need access to your microphone and camera to guide you through today's activities.
        </p>

        {/* ── Mode Selector ────────────────────────────────────── */}
        <div className="w-full max-w-md mb-8">
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
            Select Game Mode
          </p>
          <div className="flex gap-4 w-full">
            {(['guide', 'strict'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setGameMode(m)}
                className={`flex-1 py-4 px-2 rounded-2xl border-4 flex flex-col items-center gap-1 transition-all ${
                  gameMode === m 
                    ? 'border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 ring-4 ring-purple-200 dark:ring-purple-900/50' 
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className="mb-2">
                  {m === 'strict' ? <Target size={32} /> : <Lightbulb size={32} />}
                </div>
                <span className="font-bold text-lg">{m === 'strict' ? 'Strict Mode' : 'Guide Mode'}</span>
                <span className="text-xs font-semibold opacity-80">
                  {m === 'strict' ? 'No hints' : 'Visual hints'}
                </span>
              </button>
            ))}
          </div>
        </div>
        
        <button 
          onClick={handleStartSession}
          className="w-full max-w-md py-6 rounded-3xl bg-blue-600 text-white hover:bg-blue-700 transition-all text-3xl font-black shadow-[0_8px_0_rgb(37,99,235)] hover:shadow-[0_4px_0_rgb(37,99,235)] hover:translate-y-1"
        >
          Start Session
        </button>
        {renderSubtitle()}
      </div>
    )
  }

  if (currentStep === 'greeting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in duration-500">
        <h1 className="text-5xl font-black text-slate-800 dark:text-slate-100 text-center mb-8">
          Hello, {patientName}!
        </h1>
        <p className="text-2xl font-bold text-slate-600 dark:text-slate-300 text-center mb-12 max-w-lg leading-relaxed">Getting your session ready...</p>
        {renderSubtitle()}
      </div>
    )
  }

  if (currentStep === 'checkin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in slide-in-from-right duration-500">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 text-center mb-12">How are you feeling today?</h1>
        
        {isListening && <div className="mb-8 text-blue-500 font-bold animate-pulse text-xl flex items-center gap-2 justify-center"><Mic size={24} /> Listening for your answer...</div>}
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
          {['Great', 'Okay', 'Tired'].map(m => (
            <button 
              key={m}
              onClick={() => handleMoodSelect(m)}
              className="py-12 rounded-3xl border-4 border-blue-200 bg-blue-50 hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all text-3xl font-black shadow-lg"
            >
              {m}
            </button>
          ))}
        </div>
        {renderSubtitle()}
      </div>
    )
  }

  if (currentStep === 'breathing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in slide-in-from-right duration-500 w-full">
        {!breathingActive ? (
          <div className="text-center">
            <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 text-center mb-12 px-4 leading-tight">
              Would you like to do a quick 1-minute breathing exercise?
            </h1>
            
            {isListening && <div className="mb-8 text-blue-500 font-bold animate-pulse text-xl flex items-center gap-2 justify-center"><Mic size={24} /> Listening... (Say Yes or Skip)</div>}
            
            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-6 w-full max-w-2xl px-4 mx-auto">
              <button 
                onClick={startBreathing}
                className="flex-1 flex items-center justify-center py-10 rounded-3xl bg-green-500 text-white hover:bg-green-600 transition-all text-3xl font-black shadow-xl"
              >
                Yes, let's breathe
              </button>
              <button 
                onClick={skipBreathing}
                className="flex-1 flex items-center justify-center py-10 rounded-3xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all text-3xl font-black shadow-lg"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-12">
            <h2 className="text-3xl font-bold text-slate-600 animate-pulse">Follow the circle...</h2>
            {/* CSS Animation for Breathing */}
            <div className="relative flex items-center justify-center w-64 h-64">
              <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-20" style={{ animationDuration: '4s' }}></div>
              <div className="absolute inset-4 bg-blue-500 rounded-full animate-pulse opacity-40" style={{ animationDuration: '4s' }}></div>
              <div className="absolute inset-8 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center transition-transform duration-1000 ease-in-out">
                 <span className="text-white font-black text-xl">Breathe</span>
              </div>
            </div>
            
            <div className="text-xl font-medium text-slate-500 dark:text-slate-400">
              Time remaining: {breathingTimeLeft} seconds
            </div>
            
            <button
              onClick={skipBreathing}
              className="mt-4 px-8 py-4 rounded-2xl bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold text-xl shadow-sm transition-colors"
            >
              Stop & Continue
            </button>
          </div>
        )}
        {renderSubtitle()}
      </div>
    )
  }

  if (currentStep === 'cognitive') {
    return (
      <div className="animate-in fade-in duration-500 w-full h-full">
        {/* We reuse the GameScreen but pass an internal onComplete */}
        <GameScreen 
          patientId={patientId} 
          patientHistory={patientHistory} 
          preferences={preferences}
          onComplete={handleGameComplete}
          autoStart={true}
          defaultGameMode={gameMode}
        />
      </div>
    )
  }

  if (currentStep === 'caregiver') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in-95 duration-500 px-4 text-center">
        <h1 className="text-4xl font-black text-slate-800 dark:text-slate-100 text-center mb-8 px-4 leading-tight">
          Help out around the house
        </h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-3xl p-8 mb-10 w-full max-w-2xl shadow-sm text-center">
          <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 leading-snug">
            "{preferences?.caregiver_daily_task || "I just wanted to say I love you, have a great day!"}"
          </p>
        </div>
        
        {isListening && <div className="mb-6 text-blue-500 font-bold animate-pulse text-xl flex items-center justify-center gap-2"><Mic size={24} /> Say "I did it" or click below...</div>}
        
        <button 
          onClick={handleCaregiverTaskDone}
          className="w-full max-w-xl py-8 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all text-4xl font-black shadow-[0_8px_0_rgb(37,99,235)] hover:shadow-[0_4px_0_rgb(37,99,235)] hover:translate-y-1"
        >
          I Did It!
        </button>
        {renderSubtitle()}
      </div>
    )
  }

  if (currentStep === 'feedback') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in slide-in-from-bottom duration-500 w-full px-4 text-center">
        <h1 className="text-5xl md:text-7xl font-black text-green-500 mb-6 tracking-tight">
          Wonderful Job!
        </h1>
        <p className="text-2xl text-slate-600 font-bold mb-12">
          Would you like to play a few more games?
        </p>
        
        {isListening && <div className="mb-6 text-blue-500 font-bold animate-pulse text-xl flex items-center justify-center gap-2"><Mic size={24} /> Listening...</div>}
        
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-3xl">
          <button 
            onClick={() => handleLoop('yes')}
            className="flex-1 py-10 rounded-3xl bg-blue-500 text-white hover:bg-blue-600 transition-all text-3xl font-black shadow-xl"
          >
            Yes, play more
          </button>
          <button 
            onClick={() => handleLoop('no')}
            className="flex-1 py-10 rounded-3xl bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all text-3xl font-black shadow-lg"
          >
            No, I'm done
          </button>
        </div>
        {renderSubtitle()}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <h1 className="text-3xl font-bold text-slate-500">Saving session...</h1>
    </div>
  )
}
