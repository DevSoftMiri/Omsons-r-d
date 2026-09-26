import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';

dotenv.config();

const loginUsers = [
  {
    name: 'Admin',
    email: 'admin@omsons.com',
    password: 'Admin@12345',
    role: 'Admin',
    department: 'R&D',
    designation: 'Administrator'
  },
  {
    name: 'Staff',
    email: 'staff@omsons.com',
    password: 'Staff@12345',
    role: 'Staff',
    department: 'R&D',
    designation: 'Staff'
  }
];

async function seedLoginUsers() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  for (const loginUser of loginUsers) {
    const existingUser = await User.findOne({ email: loginUser.email }).select('+password');

    if (existingUser) {
      existingUser.name = loginUser.name;
      existingUser.password = loginUser.password;
      existingUser.role = loginUser.role;
      existingUser.department = loginUser.department;
      existingUser.designation = loginUser.designation;
      existingUser.isActive = true;
      await existingUser.save();
    } else {
      await User.create({ ...loginUser, isActive: true });
    }
  }

  console.log('Login users are ready:');
  for (const loginUser of loginUsers) {
    console.log(`${loginUser.role}: ${loginUser.email} / ${loginUser.password}`);
  }
}

seedLoginUsers()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
