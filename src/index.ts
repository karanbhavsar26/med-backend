// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import app from './server';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`✅ Server started - CORS will be handled in server.ts`);
});