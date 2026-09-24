import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: String,
    email: String,
    phone: String,
    category: String,
    rating: { type: Number, min: 1, max: 5, default: 3 }
  },
  { timestamps: true }
);

export const Vendor = mongoose.model('Vendor', vendorSchema);
