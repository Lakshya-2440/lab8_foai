const MODEL_URL =
  'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0'
const MAX_RETRIES = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const readBody = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf-8')
  return raw ? JSON.parse(raw) : {}
}

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
      return { ok: true, blob: await response.arrayBuffer(), contentType: response.headers.get('content-type') || 'image/png' }
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
      status: response.status,
      error: payload?.error || `Image generation failed (HTTP ${response.status}).`,
    }
  }

  return { ok: false, status: 500, error: 'Image generation failed after retries.' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const token = process.env.HF_TOKEN || process.env.VITE_HF_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'Missing Hugging Face token. Set HF_TOKEN in environment.' })
  }

  try {
    const body = await readBody(req)
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required.' })
    }

    const result = await generate(prompt, token)
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }

    res.setHeader('Content-Type', result.contentType)
    return res.status(200).send(Buffer.from(result.blob))
  } catch {
    return res.status(500).json({ error: 'Unexpected server error while generating image.' })
  }
}
