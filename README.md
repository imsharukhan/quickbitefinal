# Grab N Go

Grab N Go is a campus food ordering and pre-order platform for college canteens. Students browse outlets, place orders, pay through Razorpay, receive a pickup token, and track order status in real time. Vendors manage outlet details, menus, live orders, order history, revenue, and feedback from a dedicated dashboard.

The current active implementation is split into a FastAPI backend in `backend/` and a Next.js frontend in `quickbite/`.

## Architecture Summary

```text
Student / Vendor Browser
        |
        | HTTPS, WebSocket
        v
Next.js + React frontend
        |
        | REST API calls through Axios
        v
FastAPI backend
        |
        | async SQLAlchemy
        v
PostgreSQL
        |
        | locks, idempotency, short-lived caches
        v
Redis / Upstash Redis

FastAPI also integrates with Razorpay for payment order creation, signature verification, captured-payment webhooks, and optional Razorpay Route transfers to linked canteen accounts.
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend |Next.js, React, Axios, lucide-react |
| Backend | FastAPI, Uvicorn, Pydantic, SQLAlchemy asyncio |
| Database | PostgreSQL with asyncpg |
| Cache / coordination | Redis through Upstash Redis client |
| Realtime | FastAPI WebSockets |
| Payments | Razorpay Orders, verification, webhooks, Route transfers |
| Email | Resend |
| Observability | Sentry for frontend and backend |
| Testing hosting | Vercel frontend, Railway backend/database/Redis |
| Planned hosting | Google Cloud Platform |

## Major Features

- Student registration, OTP verification, login, token refresh, profile, and password reset.
- Vendor login, forced password change, password reset, and outlet-scoped dashboard.
- Outlet listing, outlet status toggling, closed dates, pickup slot generation, and outlet metadata updates.
- Menu browsing plus vendor menu create, update, availability toggle, soft delete, categories, and daily item limits.
- Cart and checkout flow with single-outlet cart enforcement.
- Order creation with Redis checkout lock and idempotency key.
- Razorpay payment order creation, frontend payment verification, webhook handling, and payment status update.
- Daily token assignment after payment confirmation.
- Vendor order status flow: `Placed` to `Preparing` to `Ready for Pickup` to `Picked Up`.
- Student/vendor cancellation paths, notifications, ratings, feedback, daily stats, and 30-day outlet history.
- WebSocket push updates for student order status, payment confirmation, notifications, and vendor new-order events.

## Folder Structure

```text
.
|-- backend/
|   |-- app/
|   |   |-- auth/               Student/vendor auth, OTP, JWT, refresh, password flows
|   |   |-- menu/               Menu item models, schemas, routes, services
|   |   |-- notifications/      Notification persistence and read-state APIs
|   |   |-- orders/             Order models, order workflow, stats, WebSocket manager
|   |   |-- outlets/            Outlet models, slots, vendor outlet management
|   |   |-- payments/           Razorpay order, verify, webhook, transfer logic
|   |   |-- users/              User and student profile APIs
|   |   |-- vendors/            Vendor model and management APIs
|   |   |-- config.py           Environment-backed settings
|   |   |-- database.py         Async PostgreSQL engine/session setup
|   |   |-- main.py             FastAPI app, routers, CORS, startup migrations, WebSockets
|   |   `-- redis_client.py     Upstash Redis client
|   |-- alembic/                Database migration files
|   |-- tools/                  Development and seed utilities
|   |-- Dockerfile              Backend container entrypoint
|   `-- requirements.txt        Python dependencies
|-- quickbite/
|   |-- src/
|   |   |-- app/                Next.js app entry, layout, global styles
|   |   |-- components/         Shared UI and page-level components
|   |   |-- context/            Auth and app state providers
|   |   |-- hooks/              WebSocket hook
|   |   |-- services/           API service modules
|   |   `-- utils/              Razorpay frontend helper
|   |-- public/                 Static images and category assets
|   |-- package.json            Frontend scripts and dependencies
|   `-- vercel.json             Current Vercel API rewrite configuration
`-- README.md
```

## Setup

### Prerequisites

- Node.js 20 or compatible runtime for Next.js 16.
- Python 3.11.
- PostgreSQL.
- Redis or Upstash Redis.
- Razorpay account credentials.
- Resend API key for email/OTP flows.

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend API docs are available after startup:

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/`

### Frontend

```bash
cd quickbite
npm install
copy .env.example .env.local
npm run dev
```

The frontend runs at `http://localhost:3000` by default.

## Environment Variables

### Backend

Required by the active settings model:

```text
DATABASE_URL
REDIS_URL
REDIS_TOKEN
SECRET_KEY
ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS
RESEND_API_KEY
RESEND_FROM_EMAIL
COLLEGE_EMAIL_DOMAIN
```

Payment-related variables:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

Optional settings with defaults:

```text
PLATFORM_FEE_RATE=0.0236
ORDER_WINDOW_START=20:00
ORDER_WINDOW_END=23:59
```

The example file also includes CORS values. Update backend CORS origins for each deployment environment.

### Frontend

```text
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_RAZORPAY_KEY_ID
```

`NEXT_PUBLIC_API_URL` should point to the backend base URL. WebSocket URLs are derived from this value by replacing `http` with `ws`.

## Deployment Overview

### Current Testing Deployment

- Frontend: Vercel, using `quickbite/vercel.json` to rewrite `/api/*` to the Railway backend.
- Backend: Railway, using `backend/Dockerfile`.
- Database: PostgreSQL on Railway.
- Redis: Upstash Redis or Redis-compatible service.
- Payments: Razorpay live/test credentials configured on the backend and public key exposed to the frontend.

### Planned GCP Deployment

Recommended GCP mapping for the current architecture:

- Frontend: Vercel can remain in place, or deploy Next.js to Cloud Run if a single-cloud deployment is required.
- Backend: Cloud Run container built from `backend/Dockerfile`.
- Database: Cloud SQL for PostgreSQL.
- Redis: Memorystore for Redis, or keep Upstash if using its REST/token-based client.
- Secrets: Secret Manager for database, JWT, Razorpay, Redis, Resend.
- Networking: Serverless VPC Access for private Cloud SQL and Memorystore access.
- HTTPS and domains: Cloud Load Balancing or managed Cloud Run domain mapping.
- Webhooks: Razorpay webhook endpoint should point to the public backend URL at `/api/payments/webhook`.

## Notes

- Alembic migrations are present and the Dockerfile runs `alembic upgrade head` before starting Uvicorn.
- Realtime connections currently use instance-local state.For multi-instance Cloud Run scaling, use one active backend instance for WebSockets or add a shared pub/sub layer before horizontal realtime scaling.
