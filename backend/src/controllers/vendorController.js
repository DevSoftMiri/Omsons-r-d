import asyncHandler from 'express-async-handler';
import { Vendor } from '../models/Vendor.js';

export const listVendors = asyncHandler(async (_req, res) => {
  res.json(await Vendor.find().sort({ name: 1 }));
});

export const createVendor = asyncHandler(async (req, res) => {
  res.status(201).json(await Vendor.create(req.body));
});

export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!vendor) {
    res.status(404);
    throw new Error('Vendor not found');
  }

  res.json(vendor);
});
