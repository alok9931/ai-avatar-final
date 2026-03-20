# 🎭 AI Avatar Webinar Platform

A production-ready AI avatar webinar platform built with **Next.js**, **HeyGen LiveAvatar**, **OpenAI GPT-4o**, and **Firebase**.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 Live AI Avatar | Real-time avatar streams via WebRTC using HeyGen LiveAvatar |
| 🧠 GPT-4o Q&A Brain | Audience questions are answered by GPT-4o, spoken by the avatar |
| 📊 Slide Sync | Slide deck advances automatically as the avatar presents |
| 💬 Live Chat | Real-time audience chat via Firebase |
| 🎤 Voice Input | Audience can ask questions by voice (Web Speech API) |
| 📢 Auto Presentation | Avatar auto-presents all slides with AI-generated scripts |
| 👥 Audience View | Separate `/audience` page for attendees |

---

## 🚀 Quick Start (5 Steps)

### Step 1 — Clone and install

```bash
git clone <your-repo>
cd ai-avatar-webinar
npm install
```

### Step 2 — Set up your API keys

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

- **HEYGEN_API_KEY** — from [app.heygen.com/settings](https://app.heygen.com/settings) → API section
- **NEXT_PUBLIC_AVATAR_ID** — your avatar ID from [app.liveavatar.com](https://app.liveavatar.com)
- **OPENAI_API_KEY** — from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Firebase config** — from [console.firebase.google.com](https://console.firebase.google.com)

### Step 3 — Create your Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Realtime Database** (not Firestore)
4. Set database rules to allow read/write (for development):
   ```json
   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }
   ```
5. Copy the config values into `.env.local`

### Step 4 — Create your HeyGen avatar

1. Sign up at [app.liveavatar.com](https://app.liveavatar.com)
2. Click **Create Avatar**
3. Record a 2-minute video split into:
   - **15 seconds** — silent, listening expression
   - **90 seconds** — talking naturally
   - **15 seconds** — silent, idle/resting
4. Submit and wait 24–48 hours for approval
5. Copy your Avatar ID into `.env.local`

### Step 5 — Run locally

```bash
npm run dev
```

- **Host view**: [http://localhost:3000](http://localhost:3000)
- **Audience view**: [http://localhost:3000/audience](http://localhost:3000/audience)

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              ← Host view (full controls)
│   ├── audience/page.tsx     ← Audience view (stream + chat)
│   ├── api/
│   │   ├── answer/           ← POST: generate Q&A answer via GPT-4o
│   │   ├── script/           ← POST: generate slide script via GPT-4o
│   │   └── heygen-token/     ← POST: get HeyGen session token
│   └── globals.css
├── hooks/
│   └── useLiveAvatar.ts      ← WebRTC avatar session hook
└── lib/
    ├── openai.ts             ← GPT-4o answer + script generation
    └── firebase.ts           ← Real-time chat, Q&A, slide sync
```

---

## 🎛 Customizing Your Webinar

### Edit slides
Open `src/app/page.tsx` and modify the `SLIDES` array at the top:

```typescript
const SLIDES = [
  {
    title: "Your slide title",
    body: "Brief subtitle or context",
    bullets: ["Key point 1", "Key point 2", "Key point 3"],
  },
  // Add more slides...
];
```

### Customize the avatar persona
In `.env.local`, edit `NEXT_PUBLIC_AVATAR_PERSONA`:

```
NEXT_PUBLIC_AVATAR_PERSONA=You are a sales expert presenting our SaaS product. 
Focus on ROI and business value. Keep answers under 60 words. Be confident and enthusiastic.
```

### Use your own LLM (Custom mode)
Instead of calling OpenAI, edit `src/lib/openai.ts` to call your own LLM endpoint. The avatar just needs a text string to speak.

---

## 🌐 Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Set all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## 💰 Cost Estimate

| Service | Cost |
|---|---|
| HeyGen LiveAvatar (Lite mode) | ~$0.10/min = **~$6 for a 1-hour webinar** |
| OpenAI GPT-4o | ~$0.01 per Q&A answer = **~$1 for 100 questions** |
| Firebase Realtime DB | Free tier covers most webinars |
| Vercel hosting | Free tier for dev, $20/mo for production |
| **Total for 1-hour webinar** | **~$7–10** |

---

## 🗺 Architecture

```
Audience Browser
      │
      │ WebRTC / HTTP
      ▼
 Next.js App (Vercel)
      ├── /api/heygen-token  ← Keeps HeyGen API key server-side
      ├── /api/answer        ← GPT-4o Q&A generation
      └── /api/script        ← GPT-4o slide script generation
            │
            ├── HeyGen LiveAvatar (WebRTC avatar stream)
            ├── OpenAI GPT-4o (Q&A brain)
            └── Firebase Realtime DB (chat + Q&A sync)
```

---

## 📞 Support

Built using:
- [HeyGen LiveAvatar Docs](https://docs.heygen.com/docs/streaming-api)
- [OpenAI Node SDK](https://github.com/openai/openai-node)
- [Firebase JS SDK](https://firebase.google.com/docs/web/setup)
