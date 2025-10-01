import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response('No file provided', { status: 400 });
    }

    // Create a new FormData for OpenAI API
    const openaiFormData = new FormData();
    openaiFormData.append('file', file);
    openaiFormData.append('model', 'whisper-1');
    openaiFormData.append('response_format', 'json');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response('OpenAI API key not configured', { status: 500 });
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      return new Response(`OpenAI API Error: ${response.status} ${errorText}`, { 
        status: response.status 
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(`Server error: ${error.message}`, { status: 500 });
  }
}
