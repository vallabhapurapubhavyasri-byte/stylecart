# StyleCart

A small full-stack shopping storefront built with HTML, CSS, browser JavaScript, Express, and MongoDB.

## Run locally

Install Node.js 20 or newer and MongoDB Community Server, then run these commands from the project root:

```powershell
Set-Location backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm start
```

Edit `backend/.env` and set `MONGODB_URI` to your MongoDB connection string. The backend uses the `stylecart` database by default; set `MONGODB_DB` to change it. Start your local MongoDB service before running the app when using the local URI. Open <http://localhost:3000>. The Express server serves the frontend from `frontend/`, and the product collection is seeded on first run. Use the app through this server so account and checkout requests reach the API.

The database switch seeds products into MongoDB but does not migrate existing SQLite users, orders, or newsletter subscribers.

For MongoDB Atlas, replace the values in `backend/.env` with your Atlas connection details:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-host>/
MONGODB_DB=stylecart
```

Keep your real connection string private; do not commit it to the repository.

## Features

- Product catalog with search, category filters, detail views, and stock counts
- Persistent browser shopping bag with quantity controls
- Account registration and sign-in using scrypt-hashed passwords and expiring bearer sessions
- Stock-checked order creation with server-calculated totals and embedded order items
- MongoDB collections for products, users, sessions, orders, and newsletter subscribers

## API

- `GET /api/products` and `GET /api/products/:id`
- `POST /api/auth/register`, `POST /api/auth/login`, and `POST /api/auth/logout`
- `POST /api/orders` (requires a bearer token)
- `POST /api/newsletter`

This demo records orders but does not process payments or arrange shipping.