import 'dotenv/config';
import mongoose from 'mongoose';
import { Project } from '../src/models/Project.js';

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) throw new Error('MONGO_URI is not configured');

await mongoose.connect(mongoUri);

try {
  const instrumentProjects = await Project.find({ category: /^instrument$/i }).sort({ createdAt: 1, _id: 1 });
  const usedCodes = new Set(
    (await Project.find({ productCode: /^INS-\d+$/i }).select('productCode').lean())
      .map((project) => project.productCode.toUpperCase())
  );
  let nextNumber = Math.max(0, ...Array.from(usedCodes).map((code) => Number(code.slice(4)) || 0)) + 1;
  let migratedCount = 0;

  for (const project of instrumentProjects) {
    if (/^INS-\d+$/i.test(project.productCode)) continue;
    while (usedCodes.has(`INS-${String(nextNumber).padStart(3, '0')}`)) nextNumber += 1;
    const nextCode = `INS-${String(nextNumber).padStart(3, '0')}`;
    project.productCode = nextCode;
    await project.save();
    usedCodes.add(nextCode);
    nextNumber += 1;
    migratedCount += 1;
    console.log(`${project.name}: ${nextCode}`);
  }

  console.log(`Migrated ${migratedCount} instrument project(s).`);
} finally {
  await mongoose.disconnect();
}
