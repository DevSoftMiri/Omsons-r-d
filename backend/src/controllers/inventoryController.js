import asyncHandler from 'express-async-handler';
import { InventoryItem } from '../models/InventoryItem.js';
import { createProjectDocumentUpload, uploadProjectDocument, deleteProjectDocument } from '../services/supabaseStorageService.js';

const populate = (query) => query.populate('vendor', 'name code status');

export const listInventory = asyncHandler(async (_req, res) => {
  res.json(await populate(InventoryItem.find().sort({ updatedAt: -1 })));
});

export const createInventory = asyncHandler(async (req, res) => {
  const item = await InventoryItem.create(req.body);
  res.status(201).json(await populate(InventoryItem.findById(item._id)));
});

export const updateInventory = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  res.json(await populate(InventoryItem.findById(item._id)));
});

export const deleteInventory = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  await deleteProjectDocument(item.attachment?.storagePath);
  await item.deleteOne();
  res.json({ id: String(item._id) });
});

export const uploadInventoryAttachment = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  if (!req.file) { res.status(400); throw new Error('File is required'); }
  await deleteProjectDocument(item.attachment?.storagePath);
  const upload = await uploadProjectDocument({ path: `inventory/${item._id}/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '')}`, buffer: req.file.buffer, mimeType: req.file.mimetype });
  item.attachment = { name: req.file.originalname, mimeType: req.file.mimetype, fileSize: req.file.size, ...upload };
  await item.save();
  res.json(await populate(InventoryItem.findById(item._id)));
});

export const createInventoryAttachmentUpload = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  const name = String(req.body.name || '').trim();
  if (!name) { res.status(400); throw new Error('File name is required'); }
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '');
  res.json(await createProjectDocumentUpload({ path: `inventory/${item._id}/${Date.now()}-${safeName}` }));
});

export const completeInventoryAttachmentUpload = asyncHandler(async (req, res) => {
  const item = await InventoryItem.findById(req.params.id);
  if (!item) { res.status(404); throw new Error('Inventory item not found'); }
  const { storagePath, publicUrl, name, mimeType, fileSize } = req.body;
  if (!storagePath || !name) { res.status(400); throw new Error('Upload metadata is incomplete'); }
  if (!storagePath.startsWith(`inventory/${item._id}/`) || Number(fileSize) > 10 * 1024 * 1024) { res.status(400); throw new Error('Invalid inventory upload'); }
  await deleteProjectDocument(item.attachment?.storagePath);
  item.attachment = { name, mimeType, fileSize, storagePath, publicUrl, url: publicUrl };
  await item.save();
  res.json(await populate(InventoryItem.findById(item._id)));
});
