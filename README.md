# QuickBite 🍽️
### Smart Campus Food Pre-Order System

> Skip the queue. Pre-order from your campus canteen and pick up when it's ready.

[![Live Demo](https://img.shields.io/badge/Live-quickbitefinal.vercel.app-orange)](https://quickbitefinal.vercel.app)
[![Backend](https://img.shields.io/badge/API-Railway-purple)](https://railway.app)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## What is QuickBite?

QuickBite is a campus food pre-ordering platform built for college canteens. Students pre-order food via UPI, receive a token number and collect their food at the scheduled time so no waiting in queues. Vendors manage orders in real-time through a dedicated dashboard.

**Live at:** [quickbitefinal.vercel.app](https://quickbitefinal.vercel.app)

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐
│   Next.js SPA   │ ──API──▶│   FastAPI Backend     │
│   (Vercel)      │◀──WS───│   (Railway)           │
└─────────────────┘         └──────────┬───────────┘
                                        │
                            ┌───────────▼───────────┐
                            │   PostgreSQL + Redis   │
                            │   (Railway)            │
                            └───────────────────────┘
                                        │
                            ┌───────────▼───────────┐
                            │   Razorpay Routes      │
                            │   Payment Gateway      │
                            └───────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, CSS Variables |
| Backend | FastAPI, SQLAlchemy (async), Pydantic |
| Database | PostgreSQL (asyncpg) |
| Cache | Redis |
| Payments | Razorpay + Razorpay Routes (split payments) |
| Real-time | WebSockets (FastAPI native) |
| Deployment | Vercel (frontend) + Railway (backend + DB + Redis) |
| Email | Resend |

---

## Key Features

- **Student Flow** — Browse canteens → Add to cart → Pay via UPI → Get token → Collect food
- **Vendor Dashboard** — Real-time order management, menu control, revenue analytics, 30-day history
- **Split Payments** — Platform fee (2.36% incl. GST) auto-collected via Razorpay Routes. Canteen receives exact food amount
- **Token System** — Per-canteen daily tokens (1-20), resets every day at midnight IST
- **Smart Scheduling** — 15-minute pickup slots, auto-disable past slots, IST timezone aware
- **Real-time Updates** — WebSocket push notifications. Vendor action → student sees it instantly
- **Multi-canteen** — Each canteen isolated with own vendor, menu, UPI, and token sequence

---

## Payment Flow

```
Student pays ₹222 (₹216 food + ₹6 platform fee)
         │
         ▼
    Razorpay captures ₹223
         │
         ├──▶ ₹216 transferred to canteen (via Razorpay Routes)
         │
         └──▶ ₹6 stays in QuickBite account
```

---

## Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis

### Backend
```bash
cd backend
cp .env.example .env          # fill in your values
pip install -r requirements.txt
alembic upgrade head           # run migrations
uvicorn app.main:app --reload
```

### Frontend
```bash
cd quickbite
cp .env.example .env.local    # fill in your values
npm install
npm run dev
```

---

## Environment Variables

See `backend/.env.example` and `quickbite/.env.example` for all required variables.

**Required for payments to work:**
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

---

## API Documentation

FastAPI auto-generates interactive API docs:
- Swagger UI: `https://your-backend.railway.app/docs`
- ReDoc: `https://your-backend.railway.app/redoc`

---

## Deployment

### Backend (Railway)
1. Connect GitHub repo to Railway
2. Set all environment variables from `.env.example`
3. Railway auto-deploys on every push to `main`

### Frontend (Vercel)
1. Connect GitHub repo to Vercel
2. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL
3. Vercel auto-deploys on every push to `main`

---

## Revenue Model

Platform charges **2.36%** (2% + 18% GST) on every transaction.

## Built By

**Sharukhan** — 3rd Year Student, [DSU]

Built as a real production system, not a prototype. Live transactions processed, real canteen vendors onboarded.

---

## License

MIT
