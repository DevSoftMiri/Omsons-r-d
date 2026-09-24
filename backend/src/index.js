import dotenv from 'dotenv';
import { createApp } from './server.js';
import { connectDatabase } from './utils/database.js';

dotenv.config();

const port = process.env.PORT || 5000;

await connectDatabase(process.env.MONGO_URI);

createApp().listen(port, () => {
  console.log(`R&D API running on port ${port}`);
});
