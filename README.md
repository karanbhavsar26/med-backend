# Medical Report OCR Service

A standalone **Node.js** microservice that accepts diagnostic lab reports (PDF or image), extracts medical observations using **Datalab Marker OCR**, and returns structured data in **FHIR R4 Bundle** format.

This service was built as per the assignment requirements for a production-ready healthcare platform.

## Features

- Single endpoint: `POST /extract`
- Supports **PDF, JPEG, PNG, WebP**
- Static Bearer token authentication
- Returns valid **FHIR R4 Bundle** of `Observation` resources
- Automatic interpretation (`L` / `H` / `N`) based on reference range
- `needsReview` flag for invalid or suspicious observations
- Strong garbage filtering (removes patient name, contact, registered on, etc.)
- Proper reference range handling (`< 1.23`, `0-35`, `>100`, etc.)

## Tech Stack

- **Node.js + TypeScript**
- **Express.js**
- **Multer** (file upload)
- **Datalab Marker API** (OCR)
- **CORS** enabled
- **Jest** (basic validation test)

## Prerequisites

- Node.js (v18 or higher)
- Datalab Marker API key (free tier is sufficient)
- Git

## Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd medical-report-ocr-backend
   
## curl example

curl -X POST http://localhost:3000/extract \
  -H "Authorization: Bearer your-token" \
  -F "file=@report.pdf"