# Swapify

A campus marketplace application for students at the University of the Witwatersrand to buy, sell, and trade items safely on campus.

## Live Application

**Frontend:** https://swapify-frontend-b2h7gvfhhgaka6d7.austriaeast-01.azurewebsites.net

**Backend API:** https://swapify-backend.azurewebsites.net

## Test Credentials

**Student access:**
Sign up with any email via the Get Started button on the live app.

**Admin/Staff access:**
- Email: `swapifydemo@gmail.com`
- Password: `Swapify2026!`

This account has admin and staff access and can view:
- Admin Panel — user management, analytics, reviews moderation
- Staff Dashboard — today's bookings, mark received, confirm cash, release item

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), Clerk Auth, Axios, Socket.io |
| Backend | Node.js, Express |
| Database | PostgreSQL (Azure Database for PostgreSQL Flexible Server) |
| Authentication | Clerk |
| Payments | PayFast (sandbox) |
| Hosting | Azure App Service (backend), Azure Static Web Apps (frontend) |
| CI/CD | GitHub Actions |
| Testing | Jest, Codecov |

## Project Structure
Swapify/
├── src/                    # Backend source code
│   ├── config/             # Database connection
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Auth and role middleware
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   └── services/           # Business logic
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── services/       # API service calls
├── migrations/             # SQL migration files
├── tests/                  # Jest test suites
└── .github/workflows/      # CI/CD pipelines

## How to Run Locally

### Prerequisites

- Node.js v20+
- PostgreSQL (local) or access to the Azure PostgreSQL instance
- A Clerk account (for auth)

### 1. Clone the repo

```bash
git clone https://github.com/SwapifyTeam/Swapify.git
cd Swapify
```

### 2. Backend setup

```bash
# Install backend dependencies
npm install

# Create a .env file in the root directory with the following:
DATABASE_URL=postgresql://swapifyadmin:{your-password}@swapify-db.postgres.database.azure.com:5432/postgres?sslmode=require
CLERK_SECRET_KEY=your_clerk_secret_key
PAYFAST_MERCHANT_ID=your_payfast_merchant_id
PAYFAST_MERCHANT_KEY=your_payfast_merchant_key
PAYFAST_PASSPHRASE=your_payfast_passphrase

# Run database migrations
npm run migrate

# Start the backend server
npm run dev
```

Backend runs on `http://localhost:8080`

### 3. Frontend setup

```bash
cd frontend

# Install frontend dependencies
npm install

# Create a .env file inside the frontend/ directory with the following:
VITE_API_URL=http://localhost:8080
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Start the frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

## Running Tests

```bash
# From the root directory
npm install
npx jest --coverage
```

- **18 test suites, 259 tests, 0 failures**
- **Coverage: 82.37%** (enforced minimum: 70%)
- Coverage reported via Codecov on every push to `main`

## CI/CD

Every push to `main` triggers the following GitHub Actions workflows:

| Workflow | Description |
|---|---|
| `ci.yml` | Runs all tests and enforces 70% coverage threshold |
| `main_swapify-backend.yml` | Deploys backend to Azure App Service |
| `main_swapify-frontend.yml` | Deploys frontend to Azure Static Web Apps |

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/users` | Create or retrieve user |
| GET | `/api/listings` | Get all listings with optional filters |
| POST | `/api/listings` | Create a new listing |
| GET | `/api/bookings/staff/today` | Get today's bookings (staff only) |
| POST | `/api/bookings` | Book a trade slot |
| POST | `/api/transactions` | Create a transaction |
| POST | `/api/payfast/initiate` | Initiate a PayFast payment |
| POST | `/api/ratings` | Submit a rating |
| GET | `/api/notifications` | Get user notifications |
| GET | `/api/analytics` | Get analytics data (admin only) |

## Team

| Name | Student Number |
|---|---|
| Aboobaker Cassim | 2687174 |
| Kgotlelelo Mokwana | 2856117 |
| Kulani Mafanele | 2881277 |
| Tasmiya Choonara | 2656353 |
| Thabo Maleke | 2830106 |

## Scrum Documentation

All Scrum artefacts are available in our Notion workspace:

 **https://www.notion.so/Swapify-33b7c783ca6e8018877bdac8d1ae0bc8**

All submission documents (PDFs) are available in our Google Drive:
**https://drive.google.com/drive/folders/1z3tp-nr3OT9hG-QTTDwAygGwsKUZy8IF?usp=sharing**

Includes:
- Product Backlog (with story points)
- Sprint Backlogs — Sprints 1–4
- Sprint Meeting Notes (Planning, Standups, Retrospectives, Reviews)
- Individual Retrospectives
- UATs (Acceptance Tests)
- UML Diagrams (Sprints 1–4)
- CI/CD & Deployment documentation
- Test Coverage Report
