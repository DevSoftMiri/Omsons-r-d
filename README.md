# Laboratory Glassware R&D Tracking Software

Production-oriented MERN/Vite scaffold for a PLM-lite workflow tailored to laboratory glassware product development.

## Run

```bash
npm.cmd run install:all
npm.cmd run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000/api/health`

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
