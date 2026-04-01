const MODEL_URL =
  'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0'
const MAX_RETRIES = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const parseJsonSafely = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const generate = async (prompt, token) => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(MODEL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        options: {
          wait_for_model: true,
        },
      }),
    })

    if (response.ok) {
      return {
        ok: true,
        body: Buffer.from(await response.arrayBuffer()).toString('base64'),
        contentType: response.headers.get('content-type') || 'image/png',
      }
    }

    const payload = await parseJsonSafely(response)
    const retryAfterSec = Number(response.headers.get('retry-after') || 0)
    const estimatedSec = Number(payload?.estimated_time || 0)
    const waitMs = Math.max(retryAfterSec * 1000, estimatedSec * 1000, 2000)
    const canRetry = attempt < MAX_RETRIES && (response.status === 429 || response.status === 503)

    if (canRetry) {
      await sleep(waitMs)
      continue
    }

    return {
      ok: false,
      statusCode: response.status,
      error: payload?.error || `Image generation failed (HTTP ${response.status}).`,
    }
  }

  return {
    ok: false,
    statusCode: 500,
    error: 'Image generation failed after retries.',
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed.' }),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  const token = process.env.HF_TOKEN || process.env.VITE_HF_TOKEN
  if (!token) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing HF_TOKEN in Netlify environment.' }),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  let payload
  try {
    payload = event.body ? JSON.parse(event.body) : {}
  } catch {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON body.' }),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  const prompt = typeof payload?.prompt === 'string' ? payload.prompt.trim() : ''
  if (!prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Prompt is required.' }),
      headers: { 'Content-Type': 'application/json' },
    }
  }

  try {
    const result = await generate(prompt, token)
    if (!result.ok) {
      return {
        statusCode: result.statusCode,
        body: JSON.stringify({ error: result.error }),
        headers: { 'Content-Type': 'application/json' },
      }
    }

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
      },
      body: result.body,
    }
  } catch {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unexpected server error while generating image.' }),
      headers: { 'Content-Type': 'application/json' },
    }
  }
}
