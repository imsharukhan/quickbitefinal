# Grab N Go Project Report

## Project Objective

Grab N Go is a college food ordering and pre-order platform designed to reduce canteen queues and support student pickup workflows. The product targets college students and operational load of hundreds of concurrent order actions by separating student ordering, vendor fulfillment, payment verification, token assignment, and realtime status updates.

## System Architecture

Next.js frontend
  - Student app screens
  - Vendor dashboard
  - Axios API client
  - WebSocket client hook
  - Razorpay checkout helper

FastAPI backend
  - Auth, users, vendors, outlets, menu, orders, notifications, payments
  - JWT access and refresh tokens
  - Razorpay order, verify, webhook, and transfer services
  - WebSocket endpoints for students and vendors

PostgreSQL
  - Durable application data
  - Users, students, vendors, outlets, menu items, orders, order items, ratings, notifications

Redis / Upstash Redis
  - Checkout lock
  - Idempotency lookup
  - Short-lived outlet history and feedback cache

External services
  - Razorpay for payment collection and verification
  - Resend for email/OTP flows
  - Sentry for error monitoring

## Workflow Explanation

Student workflow:

1. Student registers or logs in using register number/password.
2. Frontend stores JWT, refresh token, role, and profile fields in local storage.
3. Student browses outlets and menu items.
4. Cart allows items from one outlet at a time.
5. Student selects pickup time and creates a backend order.
6. Backend validates outlet status, menu availability, daily limits, and calculates platform fee.
7. Frontend creates a Razorpay payment order and opens checkout.
8. Backend verifies Razorpay signature or processes Razorpay webhook.
9. Paid order receives a daily outlet token.
10. Vendor receives a realtime new-order event.
11. Student receives notifications and status changes through WebSocket and polling fallback.

Vendor workflow:

1. Vendor logs in using phone/password.
2. Vendor dashboard loads assigned outlets, menu, live orders, stats, history and feedback.
3. Vendor can update outlet state, manage menu items, confirm preparation, move orders through fulfillment states and cancel eligible orders.
4. Each status update creates a student notification and pushes a WebSocket event.


## Frontend / Backend Interaction

The frontend uses a shared Axios instance in `quickbite/src/services/api.js`. The API base URL comes from `NEXT_PUBLIC_API_URL`, and every request adds the bearer token from local storage when present.

The Axios response interceptor handles `401` responses by calling `/api/auth/refresh`, replaying queued failed requests after refresh, and dispatching a local logout event if refresh fails.

Frontend service modules map directly to backend route groups:

- `authService.js` to `/api/auth` and `/api/users/me`
- `outletService.js` and `outletManagementService.js` to `/api/outlets`
- `menuService.js` and `menuManagementService.js` to `/api/menu`
- `orderService.js` to `/api/orders`
- `paymentService.js` to `/api/payments`
- `notificationService.js` to `/api/notifications`

The UI is implemented as a client-side app under `quickbite/src/app/page.js`, switching between page components with React state rather than route files.

## Database Usage

PostgreSQL is accessed through SQLAlchemy asyncio and asyncpg. The backend config normalizes PostgreSQL URLs to `postgresql+asyncpg://` and uses a tuned async connection pool.

Primary tables:

| Table | Purpose |
| --- | --- |
| `users` | Auth identity, role, verification, account status |
| `students` | Student name and register number |
| `vendors` | Vendor business profile and phone login identity |
| `outlets` | Canteen/outlet metadata, hours, open state, UPI, Razorpay account |
| `menu_items` | Outlet menu, pricing, availability, category, daily limit |
| `orders` | Order lifecycle, payment state, pickup time, token, platform fee |
| `order_items` | Snapshot of ordered menu items and quantities |
| `ratings` | Completed-order feedback |
| `notifications` | User notification history and read status |

Indexes exist for common order, menu, notification, rating, and order-item access patterns. Startup code also applies several `IF NOT EXISTS` column/index migrations for deployment compatibility.

## Redis / Realtime Usage

Redis is used for coordination and caching:

- `checkout_lock:{key}` prevents duplicate order creation during checkout.
- `idempotency:{key}` maps repeated checkout attempts to an existing pending order.
- `outlet_history:{outlet_id}` caches 30-day vendor history briefly.
- `outlet_feedback:{outlet_id}` caches feedback data briefly.

Realtime updates use FastAPI WebSockets:

- `/api/orders/ws/student/{user_id}?token=...`
- `/api/orders/ws/vendor/{vendor_id}?token=...`

The WebSocket manager keeps active student and vendor sockets in backend process memory. The frontend also uses polling fallback for active student orders when needed.

## Payment Workflow

1. Backend order is created with `payment_status=PENDING`, `status=Placed`, and no token.
2. Frontend calls `/api/payments/create-order`.
3. Backend creates or reuses a Razorpay order and returns checkout metadata.
4. Frontend opens Razorpay checkout using `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
5. Frontend sends Razorpay IDs and signature to `/api/payments/verify`.
6. Backend verifies the signature, marks payment as `COMPLETED`, stores gateway ID, assigns token if missing, creates a student notification, and notifies the vendor.
7. Razorpay webhook `/api/payments/webhook` also handles `payment.captured` idempotently.
8. If an outlet has `razorpay_account_id`, backend attempts a Razorpay Route transfer after payment confirmation.

Platform fee is calculated from `PLATFORM_FEE_RATE`, defaulting to `0.0236`.

## Scalability Overview

Current implementation choices that support higher campus load:

- Async FastAPI request handling.
- Async PostgreSQL access with bounded connection pool.
- Batch order response formatter to reduce N+1 query behavior.
- Order, menu, notification, rating, and history indexes.
- Redis checkout locks and idempotency to reduce duplicate order pressure.
- Short-lived Redis caching for vendor history and feedback.
- WebSocket push for active order events plus polling fallback on the student side.

Current deployment consideration:

- WebSocket connections are process-local. Horizontal backend scaling across multiple Cloud Run instances requires sticky routing, single-instance realtime handling, or a shared pub/sub mechanism for cross-instance events.

## Current Implementation Status

Implemented and active:

- Student auth, registration, OTP verification, login, refresh, logout, password reset.
- Vendor login, forced password change, password reset, dashboard workflow.
- Outlet listing, slot retrieval, vendor outlet updates, open/close toggles, closed dates.
- Menu listing and vendor menu management.
- Cart, order creation, idempotency, cancellation, status transitions, order history, stats, ratings.
- Notifications and read-state APIs.
- Razorpay payment order creation, signature verification, webhook processing, and optional Route transfer.
- WebSocket endpoints for student and vendor updates.
- PostgreSQL persistence, Alembic migrations, and startup compatibility migrations.
- Redis-backed locks, idempotency keys, and selected caches.
- Vercel/Railway testing deployment configuration.

## Production Optimization Notes

Deployment-critical items to finalize before production GCP launch:

- Finalize environment-specific deployment configuration for production.
- Decide the production WebSocket scaling model before increasing Cloud Run instance count.
- Centralize production secrets using GCP Secret Manager.
- Evaluate Redis deployment strategy for long-term GCP scaling.
- Confirm Cloud SQL connection strategy and pool limits for expected concurrent checkout and vendor dashboard traffic.

## GCP Deployment Notes

Backend:

- Build `backend/Dockerfile` and deploy to Cloud Run.
- Set `DATABASE_URL`, Redis, JWT, Razorpay, Resend, and app variables through Secret Manager or Cloud Run environment variables.
- Run Alembic migrations before serving traffic. The current Docker command already runs `alembic upgrade head`.
- Use Serverless VPC Access when connecting privately to Cloud SQL or Memorystore.

Database:

- Use Cloud SQL for PostgreSQL.
- Create the production database and user.
- Apply migrations with the same async PostgreSQL URL format expected by the app.
- Review max connections against Cloud Run concurrency and SQLAlchemy pool settings.

Redis:

- Use Upstash as-is, or migrate to Memorystore with code/config changes because the active Redis client imports `upstash_redis.asyncio.Redis` and expects URL plus token.

Frontend:

- Keep Vercel or deploy the Next.js app separately.
- Set `NEXT_PUBLIC_API_URL` to the production backend origin.
- Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to the matching Razorpay environment key.
- Update CORS allowed origins on the backend for the production frontend URL.

Payments:

- Configure Razorpay webhook URL as `https://<backend-domain>/api/payments/webhook`.
- Use the same Razorpay key pair on backend and frontend public config.
- Configure linked account IDs on outlets before enabling Route transfers.
