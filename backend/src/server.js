import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import testingValidationRoutes from './routes/testingValidationRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

export function createApp() {
  const app = express();

  const allowedOrigins = new Set([
    'https://omsonsr-d.omsonsinstruments.in',
    'https://omsons-r-d.vercel.app',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/$/, '')] : [])
  ]);

  app.use(cors({
    origin(origin, callback) {
      // Allow non-browser requests (health checks, server-to-server calls).
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
  }));
  app.options('*', cors());
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static('uploads'));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: mongoose.connection.readyState === 1,
      service: 'glassware-rnd-api',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/vendors', vendorRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/projects', testingValidationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
