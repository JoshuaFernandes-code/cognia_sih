import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { text, voice = 'aura-asteria-en' } = await req.json().catch(() => ({}))

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const apiKey = process.env.DEEPGRAM_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPGRAM_API_KEY is not configured' }, { status: 500 })
    }

    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${voice}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Deepgram API error: ${response.status} - ${errorText}`)
    }

    // Stream the audio back to the client
    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: any) {
    console.error('TTS generation failed:', error)
    return NextResponse.json({ error: error.message || 'TTS generation failed' }, { status: 500 })
  }
}
