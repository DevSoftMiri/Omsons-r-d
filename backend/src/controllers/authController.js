import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
}

export const register = asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  res.status(201).json({ user, token: signToken(user) });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+password');
  if (!user || !user.isActive || !(await user.comparePassword(req.body.password || ''))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }
  user.password = undefined;
  res.json({ user, token: signToken(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json(req.user);
});

export const listStaff = asyncHandler(async (_req, res) => {
  const users = await User.find({}).select('name email role designation isActive').sort({ name: 1 });
  res.json(users);
});

export const createStaff = asyncHandler(async (req, res) => {
  const { name, email, password, designation, role = 'Staff' } = req.body;
  if (!name?.trim() || !email?.trim() || !password) {
    res.status(400);
    throw new Error('Name, login email and password are required');
  }
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }
  if (!['Staff', 'Admin'].includes(role)) {
    res.status(400);
    throw new Error('Role must be Staff or Admin');
  }
  const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), password, role, designation: designation?.trim() || role, isActive: true });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, designation: user.designation, isActive: user.isActive });
});

export const updateStaff = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) {
    res.status(404);
    throw new Error('Staff account not found');
  }

  const role = req.body.role || user.role;
  if (!['Staff', 'Admin'].includes(role)) {
    res.status(400);
    throw new Error('Role must be Staff or Admin');
  }

  if (req.body.name !== undefined) user.name = String(req.body.name).trim();
  if (req.body.email !== undefined) user.email = String(req.body.email).trim().toLowerCase();
  user.role = role;
  if (req.body.designation !== undefined) user.designation = String(req.body.designation).trim() || role;
  if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);

  if (!user.name || !user.email) {
    res.status(400);
    throw new Error('Name and login email are required');
  }

  await user.save();
  if (user.role === 'Admin') {
    await Project.updateMany({ teamMembers: user._id }, { $pull: { teamMembers: user._id } });
  }
  res.json({ _id: user._id, name: user.name, email: user.email, role: user.role, designation: user.designation, isActive: user.isActive });
});

export const resetStaffPassword = asyncHandler(async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8) {
    res.status(400);
    throw new Error('Password must be at least 8 characters');
  }

  const user = await User.findById(req.params.userId).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('Staff account not found');
  }

  user.password = password;
  await user.save();
  res.json({ message: 'Password updated' });
});
