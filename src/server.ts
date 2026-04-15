// src/server.ts
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import { extractWithMarker } from './services/ocrService';
import { parseLabReportMarkdown } from './utils/parsers';
import { mapToFHIR } from './services/fhirMapper';
import { Request, Response } from "express";

const app = express();

// ====================== CORS (Must be first) ======================
app.use(cors({
  origin: true,                    // Allow all origins in development
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ====================== MAIN ENDPOINT ======================
app.post('/extract', upload.single('file'), async  (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`📤 Received file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Step 1: Extract text using Datalab Marker
    const markdown = await extractWithMarker(req.file.buffer, req.file.originalname);

    // Step 2: Parse into observations
    const rawObservations = parseLabReportMarkdown(markdown);

    if (rawObservations.length === 0) {
      return res.status(422).json({ error: 'No medical observations could be extracted' });
    }

    // Step 3: Convert to FHIR R4 Bundle
    const fhirBundle = mapToFHIR(rawObservations);

    console.log(`✅ Successfully extracted ${rawObservations.length} observations`);

    res.json(fhirBundle);

  } catch (error: any) {
    console.error('❌ Error in /extract:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error during OCR processing' 
    });
  }
});

// Health check endpoint (bonus)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Medical Report OCR Service is running',
    timestamp: new Date().toISOString()
  });
});

export default app;