import mongoose from 'mongoose';

const inventoryItemSchema = new mongoose.Schema({
  itemCode: { type: String, required: true, trim: true, unique: true },
  itemName: { type: String, required: true, trim: true },
  specification: { type: String, trim: true, default: '' },
  unit: { type: String, required: true, trim: true, default: 'pcs' },
  price: { type: Number, min: 0, default: 0 },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  attachment: {
    name: String,
    mimeType: String,
    fileSize: Number,
    storagePath: String,
    url: String
  }
}, { timestamps: true });

export const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
