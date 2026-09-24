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
  await ensureDatabase();

  if (!app) {
    app = createApp();
  }

  return app(req, res);
}
