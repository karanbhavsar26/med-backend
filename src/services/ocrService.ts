import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

// Load environment variables (only needed if not loaded in index.ts)
dotenv.config();

const API_KEY = process.env.DATALAB_API_KEY;
const BASE_URL = 'https://www.datalab.to/api/v1';   // Correct base URL

if (!API_KEY) {
  throw new Error('DATALAB_API_KEY is not set in .env file');
}

/**
 * Extracts text (Markdown) from PDF/Image using Datalab Marker API
 * Handles async job: Submit → Poll until complete
 */
export const extractWithMarker = async (fileBuffer: Buffer, filename: string): Promise<string> => {
  const form = new FormData();
  form.append('file', fileBuffer, {
    filename: filename,
    contentType: filename.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
  });

  // Recommended parameters for lab reports
  form.append('output_format', 'markdown');
  form.append('mode', 'balanced');           // balanced = good speed + accuracy
  form.append('include_metadata', 'true');

  try {
    // Step 1: Submit the file
    console.log('Submitting file to Datalab Marker...');
    const submitResponse = await axios.post(`${BASE_URL}/convert`, form, {
      headers: {
        ...form.getHeaders(),
        'X-API-Key': API_KEY,                 // Datalab uses X-API-Key header
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
console.log("submitResponse.data",submitResponse.data)
    const { request_id, request_check_url } = submitResponse.data;

    if (!request_check_url && !request_id) {
      throw new Error('Invalid response from Datalab: no request ID returned');
    }

    const pollUrl = request_check_url || `${BASE_URL}/convert/${request_id}`;

    // Step 2: Poll until processing is complete
    console.log('Polling for result...');
    let result: any;
    let attempts = 0;
    const maxAttempts = 40; // ~2 minutes (poll every 3s)

    while (attempts < maxAttempts) {
      const pollResponse = await axios.get(pollUrl, {
        headers: { 'X-API-Key': API_KEY },
      });

      result = pollResponse.data;

      if (result.status === 'complete' || result.success === true) {
        break;
      }

      if (result.status === 'failed' || result.error) {
        throw new Error(result.error || 'Datalab processing failed');
      }

      await new Promise(resolve => setTimeout(resolve, 3000)); // wait 3 seconds
      attempts++;
    }

    if (!result.markdown && !result.text) {
      throw new Error('No markdown or text returned from Datalab Marker');
    }

    const extractedText = result.markdown || result.text || '';
    console.log(`✅ Successfully extracted ${extractedText.length} characters`);

    return extractedText;

  } catch (error: any) {
    console.error('Datalab OCR Error:', error.response?.data || error.message);
    throw new Error(`OCR service failed: ${error.message}`);
  }
};