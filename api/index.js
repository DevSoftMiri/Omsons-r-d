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
  await ensureDatabase();

  if (!app) {
    app = createApp();
  }

  return app(req, res);
}
