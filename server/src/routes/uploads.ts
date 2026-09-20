import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../lib/errors.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype] ?? path.extname(file.originalname);
    cb(null, `${Date.now().toString(36)}-${nanoid(8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('Only JPG, PNG, WEBP or GIF images are allowed'))),
});

export const uploadsRouter = Router();
uploadsRouter.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) throw badRequest('No file uploaded (use multipart field "file")');
  res.status(201).json({ url: `${config.publicUrl}/uploads/${req.file.filename}`, size: req.file.size, mimetype: req.file.mimetype });
});
