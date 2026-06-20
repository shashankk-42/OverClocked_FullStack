# Razorpay Test Sandbox (Backend + Frontend)

This project gives you a local test environment for Razorpay Standard Checkout with:

- Order creation on server
- Checkout open on client
- Payment success/failure handling
- Signature verification on server
- PostgreSQL storage for verified payment responses

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Open:

```text
http://localhost:3001
```

## Environment Variables

The project uses `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
PORT=3001
PGHOST=localhost
PGPORT=5433
PGDATABASE=razorpay_test
PGUSER=postgres
PGPASSWORD=postgres
PGSSL=false
# DATABASE_URL=postgres://postgres:postgres@localhost:5433/razorpay_test
```

Use only test keys while testing.

## PostgreSQL Setup

1. Ensure PostgreSQL is running locally.
2. Create database:

```sql
CREATE DATABASE razorpay_test;
```

3. Keep `.env` PostgreSQL values aligned with your local credentials.
4. Start server. The `payments` table is auto-created on startup.

## API Routes

- `GET /api/health` -> health check
- `GET /api/config` -> returns public key id for checkout
- `POST /api/create-order` -> creates order
- `POST /api/verify-payment` -> verifies Razorpay signature and stores the record in PostgreSQL

## Notes Before Merging to Other Projects

- Keep `RAZORPAY_KEY_SECRET` only on backend.
- Store only the fields required by your compliance policy.
- Add auth/rate limits for production APIs.
- Add webhook handling if you need asynchronous payment event confirmation.
