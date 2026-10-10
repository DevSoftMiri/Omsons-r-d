import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    contactPerson: String,
    designation: String,
    email: String,
    phone: String,
    location: String,
    category: String,
    suppliedComponents: { type: String, trim: true },
    paymentType: { type: String, enum: ['Advance', 'Credit'], default: 'Advance' },
    advancePercentage: { type: Number, min: 0, max: 100, default: 0 },
    creditDays: { type: Number, min: 0, default: 0 },
    paymentTerms: { type: String, trim: true },
    preferred: { type: Boolean, default: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    notes: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 3 }
  },
  { timestamps: true }
);

export const Vendor = mongoose.model('Vendor', vendorSchema);
