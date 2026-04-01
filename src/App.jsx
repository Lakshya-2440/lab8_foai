import { useEffect, useMemo, useState } from 'react'
import './App.css'

const REQUEST_TIMEOUT_MS = 120000

const generateImage = async (prompt, signal) => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
    signal,
  })

  if (response.ok) {
    return response.blob()
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const payload = await response.json()
    throw new Error(payload?.error || `Image generation failed (HTTP ${response.status}).`)
  }

  throw new Error(`Image generation failed (HTTP ${response.status}).`)
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const hasPrompt = useMemo(() => prompt.trim().length > 0, [prompt])

  const onGenerate = async () => {
    const cleanedPrompt = prompt.trim()
    if (!cleanedPrompt || isLoading) return

    setError('')
    setIsLoading(true)

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl)
      setImageUrl('')
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const blob = await generateImage(cleanedPrompt, controller.signal)
      const nextUrl = URL.createObjectURL(blob)
      setImageUrl(nextUrl)
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      const isNetworkError = err instanceof TypeError
      if (isAbort) {
        setError('Request timed out. Please try a shorter prompt.')
      } else if (isNetworkError) {
        setError('Network request failed. Ensure the dev server is running and try again.')
      } else {
        setError(err.message)
      }
    } finally {
      window.clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const onEnterSubmit = (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      onGenerate()
    }
  }

  useEffect(
    () => () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    },
    [imageUrl],
  )

  return (
    <main className="page-shell">
      <section className="card">
        <header className="hero">
          <p className="kicker">Lab 8: Text to Image AI</p>
          <h1>Turn ideas into visuals in seconds</h1>
          <p className="subhead">
            Powered by Stable Diffusion XL on Hugging Face. Write a prompt, click generate,
            and get an AI-created image.
          </p>
        </header>

        <section className="composer" aria-label="Prompt composer">
          <label htmlFor="prompt-input">Describe the image you want</label>
          <textarea
            id="prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onEnterSubmit}
            placeholder="Example: Cinematic sunrise over a futuristic Jaipur skyline, ultra-detailed, warm light"
            rows={4}
          />

          <div className="actions">
            <button type="button" onClick={onGenerate} disabled={!hasPrompt || isLoading}>
              {isLoading ? 'Generating...' : 'Generate Image'}
            </button>
            <span>Tip: Press Ctrl/Cmd + Enter to generate quickly.</span>
          </div>
        </section>

        {error ? <p className="status error">{error}</p> : null}
        {isLoading ? <p className="status loading">Creating your image. This can take up to a minute.</p> : null}

        <section className="preview" aria-live="polite">
          {imageUrl ? (
            <img src={imageUrl} alt={`AI generated visual for prompt: ${prompt.trim()}`} />
          ) : (
            <div className="placeholder">
              <p>Your generated image will appear here.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
