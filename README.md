# FluentLens — AI Spoken-Language Coach & Skill Assessment

**FluentLens** is an AI-powered spoken-language coach built for hackathons (theme: *AI-powered practical education + skill assessment*). A learner records a video or audio clip (1-3 minutes) speaking in **ANY language**, chooses a learning goal (conversation, job interview, IELTS speaking, presentation pitch), and receives coach-level feedback on vocabulary, grammar, idioms, tone, delivery clarity, intonation, and body language.

Learners can ask follow-up questions about their recording (e.g. *"How was my intonation at 01:20?"*), track a deterministic **Fluency Index**, save vocabulary words to a personal notebook that auto-marks them as **Learned** when spoken in future recordings, and build a daily practice streak.

---

## 🏗️ Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           Client (React + Vite + TS)                        │
 │  - Tailwind CSS Glassmorphic UI  - Recharts Progress Analytics              │
 │  - Native MediaRecorder API (Video + Audio)  - Timestamp Seeking Video Player│
 └──────────────────────────────────────┬──────────────────────────────────────┘
                                        │ REST API (JWT Auth)
 ┌──────────────────────────────────────▼──────────────────────────────────────┐
 │                           Server (Node.js + Express + TS)                   │
 │  - Multer Uploads  - Rate Limiter (30 req / 15m) - Helmet & CORS Security  │
 │  - Background Async Processing Pipeline                                     │
 └─────────────┬────────────────────────┬────────────────────────┬─────────────┘
               │                        │                        │
               ▼                        ▼                        ▼
 ┌───────────────────────────┐ ┌───────────────────┐ ┌────────────────────────┐
 │   MongoDB Atlas (Mongoose)│ │ Gemini API        │ │ FFmpeg + FFprobe       │
 │ - User & Streak state     │ │ (@google/genai)   │ │ (silencedetect,        │
 │ - Session history & chats │ │ - Interactions API│ │  clip duration,        │
 │ - Saved/Learned Vocab     │ │ - Files API       │ │  pause count & ratio)  │
 └───────────────────────────┘ └───────────────────┘ └────────────────────────┘
```

---

## ⚡ Quick Start & Local Setup

### Prerequisites
- **Node.js**: v22.0.0 or higher (v24 recommended)
- **npm**: v10+

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/fluentlens.git
cd fluentlens

# Install server and client dependencies
npm run install:all
```

### 2. Environment Variables

Create `.env` files for both `/server` and `/client` using `.env.example` templates:

**Server Environment (`server/.env`):**
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
MONGODB_URI=mongodb://127.0.0.1:27017/fluentlens
JWT_SECRET=super_secret_jwt_key_change_in_production
CLIENT_URL=http://localhost:5173
PORT=8080
MAX_UPLOAD_MB=100
MAX_CLIP_SECONDS=200
```

**Client Environment (`client/.env`):**
```env
VITE_API_URL=http://localhost:8080
```

### 3. Run Locally

Start server and client concurrently:
```bash
npm run dev
```
- Client runs at: `http://localhost:5173`
- Backend API runs at: `http://localhost:8080`

---

## 🧪 Testing

### Unit Tests
Run Vitest unit tests for the deterministic Fluency Index formula, streak calculation across timezones, and sample report schemas:
```bash
npm test --prefix server
```

### Standalone Gemini API Verification Script
Test real media analysis with Gemini via CLI:
```bash
npm run test:gemini --prefix server -- ./path/to/media.mp3
```

---

## 🚀 Deployment Instructions

### Deploy Backend on Render
1. Create a new **Web Service** on Render connected to your GitHub repo.
2. Set **Root Directory**: `server`
3. Set **Build Command**: `npm install && npm run build`
4. Set **Start Command**: `npm start`
5. Add Environment Variables:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (`gemini-2.5-flash`)
   - `MONGODB_URI` (MongoDB Atlas connection string)
   - `JWT_SECRET`
   - `CLIENT_URL` (URL of deployed frontend)
   - `NODE_ENV=production`

### Deploy Frontend on Vercel
1. Import project into Vercel.
2. Set **Root Directory**: `client`
3. Set **Build Command**: `npm run build`
4. Set **Output Directory**: `dist`
5. Add Environment Variable:
   - `VITE_API_URL` (URL of deployed Render backend)

---

## ⚠️ Known Limitations

1. **Beta Gemini Interactions API**: The Google GenAI Interactions API stateful session mechanism (`previous_interaction_id`) is in beta. FluentLens includes an automatic fallback to standard text context prompts if an interaction session expires or fails.
2. **Pronunciation Scope**: Pronunciation feedback focuses on clarity, intonation, and rhythm observations. It does not claim precise phoneme-level IPA acoustic alignment.
3. **Gemini File Expiration**: Uploaded media files on Gemini Files API expire after 48 hours; FluentLens automatically deletes files immediately after processing completes.

---

## 🔒 Privacy & Security

- **Temporary Media Storage**: Media files uploaded to the server are saved temporarily in `/uploads` for FFmpeg silence analysis and Gemini upload, and are **ALWAYS deleted immediately** in a `finally` block once analysis completes (or fails).
- **Gemini File Cleanup**: Remote files uploaded via the Gemini Files API are explicitly deleted immediately after model output generation.
- **Client Security**: API keys live strictly on the server and are never exposed to the client bundle.
