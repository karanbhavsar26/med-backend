// src/server.ts
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import { extractWithMarker } from './services/ocrService';
import { processMarkerOutput } from './utils/parsers';
import { mapToFHIR } from './services/fhirMapper';
import { Request, Response } from "express";

const app = express();

// ====================== CORS ======================
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer for file upload (PDF/Image)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ====================== MAIN ENDPOINT ======================
// src/server.ts  (only changed parts shown)
app.post('/extract', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📤 Processing: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Step 1: Call Datalab Marker
    const markerData: any = await extractWithMarker(req.file.buffer, req.file.originalname);
    console.log(`📊 Marker returned data with keys:`, Object.keys(markerData || {}));

    // Step 2: Parse with AI (no more strict panel names)
    const rawObservations = await processMarkerOutput(markerData);

    if (rawObservations.length === 0) {
      return res.status(422).json({ 
        error: 'No observations extracted',
        message: 'Could not find any lab tests in the report'
      });
    }

    // Step 3: Convert to FHIR R4
    const fhirBundle = mapToFHIR(rawObservations);

    console.log(`✅ Success: ${rawObservations.length} observations → FHIR Bundle ready`);

    res.json(fhirBundle);

  } catch (error: any) {
    console.error('❌ /extract error:', error.message);
    res.status(500).json({ 
      error: 'Processing failed',
      message: error.message 
    });
  }
});
// ====================== HEALTH CHECK ======================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Medical Report OCR Service is running',
    aiRefinerEnabled: process.env.USE_AI_REFINER === 'true',
    timestamp: new Date().toISOString()
  });
});

export default app;