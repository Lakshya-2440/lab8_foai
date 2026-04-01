import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const token = env.HF_TOKEN || env.VITE_HF_TOKEN

  return {
    plugins: [
      react(),
      {
        name: 'local-hf-api-proxy',
        configureServer(server) {
          server.middlewares.use('/api/generate', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Method not allowed.' }))
              return
            }

            if (!token) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Missing HF_TOKEN in .env file.' }))
              return
            }

            try {
              const chunks = []
              for await (const chunk of req) chunks.push(chunk)
              const rawBody = Buffer.concat(chunks).toString('utf-8')
              const body = rawBody ? JSON.parse(rawBody) : {}
              const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''

              if (!prompt) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Prompt is required.' }))
                return
              }

              const response = await fetch(
                'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    inputs: prompt,
                    options: { wait_for_model: true },
                  }),
                },
              )

              if (!response.ok) {
                let message = `Image generation failed (HTTP ${response.status}).`
                try {
                  const errorPayload = await response.json()
                  if (errorPayload?.error) message = errorPayload.error
                } catch {
                  // Keep fallback message when payload isn't JSON.
                }

                res.statusCode = response.status
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: message }))
                return
              }

              const blob = await response.arrayBuffer()
              res.statusCode = 200
              res.setHeader('Content-Type', response.headers.get('content-type') || 'image/png')
              res.end(Buffer.from(blob))
            } catch {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Unexpected server error while generating image.' }))
            }
          })
        },
      },
    ],
  }
})
