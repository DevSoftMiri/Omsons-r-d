import dotenv from 'dotenv';
import { createApp } from '../src/server.js';
import { connectDatabase } from '../src/utils/database.js';

dotenv.config();

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
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    console.error('API initialization failed:', error);
    return res.status(503).json({ message: 'API temporarily unavailable.' });
  }
}
