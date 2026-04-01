# Text-to-Image AI Web App (Lab 8)

Complete end-to-end React app that generates images from text prompts using the Hugging Face Inference API and Stable Diffusion XL.

Model used:
https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0

## Features

- Prompt input with keyboard shortcut (`Cmd/Ctrl + Enter`)
- Generate button with loading state
- Hugging Face API integration with retry handling
- Error handling for token issues, timeouts, and API errors
- Responsive modern UI
- Environment-variable based token setup
- Ready to deploy on Vercel or Netlify

## 1. Prerequisites

- Node.js 18+
- A Hugging Face access token

## 2. Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and set:

```bash
HF_TOKEN=hf_your_real_token
```

`VITE_HF_TOKEN` is also supported as a fallback, but `HF_TOKEN` is recommended.

## 3. Run Locally

```bash
npm run dev
```

Open the URL shown in terminal (usually `http://localhost:5173`).

Note: the app calls `/api/generate` (same-origin). In dev, Vite handles this route server-side; in Vercel, `api/generate.js` handles it.

## 4. Production Build

```bash
npm run build
npm run preview
```

## 5. Deploy

### Vercel

1. Push this project to GitHub.
2. Import the repo in Vercel.
3. In Vercel Project Settings, add environment variable:
	- `HF_TOKEN` = your Hugging Face token
4. Deploy and use the provided live URL.

### Netlify

1. Push this project to GitHub (recommended) or use manual deploy.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add environment variable:
	- `HF_TOKEN` = your Hugging Face token
5. Deploy and use the provided live URL.

## Security Note

Do not commit `.env` or expose your token in public screenshots/videos.
