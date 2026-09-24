# Laboratory Glassware R&D Tracking Software

Production-oriented MERN/Vite scaffold for a PLM-lite workflow tailored to laboratory glassware product development.

## Run

```bash
npm.cmd run install:all
npm.cmd run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000/api/health`

## Deploy to Vercel

This repository is configured for Vercel with:

- Vite build output from `frontend/dist`
- Express API served through `api/index.js`
- `/api/*` requests routed to the serverless backend
- React Router fallback routed to `index.html`

Set these environment variables in the Vercel project before deploying:

```text
MONGO_URI=...
JWT_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_PROJECT_DOCUMENTS_BUCKET=project-documents
```

Then deploy from the repository root. Vercel will install root, frontend, and backend dependencies and run the frontend build.

In Vercel project settings, keep **Root Directory** set to the repository root, not `backend` or `frontend`. If Root Directory is set to `backend`, Vercel will look for `backend/frontend/package.json` and the install step will fail.

## Highlights

- JWT-ready Express API with role-based middleware
- MongoDB/Mongoose models for users, projects, stages, benchmarking, BOM, vendors, files, reports, certificates, and notifications
- React 19 + Vite + TypeScript frontend
- Tailwind enterprise UI
- Redux Toolkit project state
- React Hook Form + Zod project creation
- Spreadsheet-like benchmarking table with paste-from-Excel and CSV export
- BOM total costing and procurement stages
- Standardized 8-stage project lifecycle with admin override logic represented in the data model
