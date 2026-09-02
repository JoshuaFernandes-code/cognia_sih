import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Build FormData for Groq API
    const groqFormData = new FormData();
    // Groq requires a filename. Since it's a blob, we mock a filename.
    groqFormData.append('file', file, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3');
    // whisper-large-v3 model usually requires temperature or language, but defaults are fine

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData as any,
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      console.error('Groq API Error:', errorText);
      return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
    }

    const data = await groqRes.json();
    return NextResponse.json({ text: data.text });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
