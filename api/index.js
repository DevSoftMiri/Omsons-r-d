import dotenv from 'dotenv';
import { createApp } from '../backend/src/server.js';
import { connectDatabase } from '../backend/src/utils/database.js';

dotenv.config({ path: 'backend/.env' });

let app;
let databaseConnection;

async function ensureDatabase() {
  if (!databaseConnection) {
    databaseConnection = connectDatabase(process.env.MONGO_URI);
  }

  await databaseConnection;
}

export default async function handler(req, res) {
  if (!app) {
    app = createApp();
  }

  try {
    await ensureDatabase();
    return app(req, res);
  } catch (error) {
    // The Express CORS middleware cannot run if initialization fails first.
    // Keep the browser response readable instead of turning the failure into
    // a misleading CORS error.
    const origin = req.headers.origin;
    if (origin === 'https://omsonsr-d.omsonsinstruments.in' || origin === 'https://omsons-r-d.vercel.app') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    console.error('API initialization failed:', error);
    return res.status(503).json({ message: 'API temporarily unavailable.' });
  }
}
