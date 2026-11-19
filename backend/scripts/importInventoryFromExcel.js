import dotenv from 'dotenv';
import fs from 'node:fs';
import mongoose from 'mongoose';
import XLSX from '../../frontend/node_modules/xlsx/xlsx.mjs';
import { InventoryItem } from '../src/models/InventoryItem.js';
import { Vendor } from '../src/models/Vendor.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const filePath = process.argv[2];
if (!filePath) throw new Error('Usage: node scripts/importInventoryFromExcel.js <xlsx-path>');

const workbook = XLSX.read(fs.readFileSync(filePath));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
const items = rows
  .map((row) => ({
    itemCode: String(row['Item Code'] || '').trim(),
    itemName: String(row.Item || '').trim(),
    specification: String(row.Specification || '').trim(),
    unit: String(row.Unit || 'pcs').trim().toLowerCase(),
    price: Number(row.Price || 0),
    vendorName: String(row.Vendor || '').trim()
  }))
  .filter((item) => item.itemCode && item.itemName);

const duplicateCodes = items.filter((item, index) => items.findIndex((row) => row.itemCode === item.itemCode) !== index);
if (duplicateCodes.length) throw new Error(`Duplicate item codes in workbook: ${[...new Set(duplicateCodes.map((item) => item.itemCode))].join(', ')}`);

await mongoose.connect(process.env.MONGO_URI);
const vendorIds = new Map();
for (const vendorName of [...new Set(items.map((item) => item.vendorName).filter(Boolean))]) {
  const vendor = await Vendor.findOneAndUpdate(
    { name: vendorName },
    { $setOnInsert: { name: vendorName, preferred: true, status: 'Active' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  vendorIds.set(vendorName, vendor._id);
}

let inserted = 0;
let updated = 0;
for (const item of items) {
  const payload = {
    itemName: item.itemName,
    specification: item.specification,
    unit: item.unit || 'pcs',
    price: Number.isFinite(item.price) ? item.price : 0,
    ...(vendorIds.has(item.vendorName) ? { vendor: vendorIds.get(item.vendorName) } : {})
  };
  const existing = await InventoryItem.findOne({ itemCode: item.itemCode }).select('_id');
  await InventoryItem.updateOne({ itemCode: item.itemCode }, { $set: payload, $setOnInsert: { itemCode: item.itemCode } }, { upsert: true });
  if (existing) updated += 1;
  else inserted += 1;
}

console.log(JSON.stringify({ sourceRows: rows.length, importedRows: items.length, inserted, updated, vendors: [...vendorIds.keys()] }));
await mongoose.disconnect();
