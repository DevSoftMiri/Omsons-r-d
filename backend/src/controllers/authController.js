import jwt from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { User } from '../models/User.js';

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
