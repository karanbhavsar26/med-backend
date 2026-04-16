// src/utils/markerParser.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { convertMarkerStructuredJSON } from "./markerToRaw";


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const processMarkerOutput = async (markerData: any): Promise<RawObservation[]> => {
  console.log("🔄 Processing Marker output for lab report...");

  const observations = await extractWithGemini(markerData);

  console.log(`✅ Successfully extracted ${observations.length} observations`);
  return observations;
};

// ==================== RULE-BASED CONVERTER ====================
export const parseLabReportMarkdown = (markerData: any): RawObservation[] => {
  const observations: RawObservation[] = [];
  const testResults = markerData?.test_results || {};

  Object.entries(testResults).forEach(([panelKey, panelData]: [string, any]) => {
    const panelName = getPanelName(panelKey);

    if (panelData && typeof panelData === 'object' && !panelData.observed) {
      Object.entries(panelData).forEach(([subSection, subData]) => {
        processSection(subData, panelName, observations);
      });
    } else {
      processSection(panelData, panelName, observations);
    }
  });

  return observations;
};

function getPanelName(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('liver') || k.includes('lft')) return "LFT";
  if (k.includes('renal') || k.includes('rft') || k.includes('kidney')) return "RFT";
  if (k.includes('urine')) return "URINE";
  if (k.includes('cbc') || k.includes('haemogram') || k.includes('hemogram')) return "CBC";
  if (k.includes('electrolytes')) return "ELECTROLYTES";
  return "Uncategorized";
}

function processSection(section: any, panelName: string, observations: RawObservation[]) {
  if (!section || typeof section !== 'object') return;

  Object.entries(section).forEach(([testKey, testData]: [string, any]) => {
    let testName = testKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    if (typeof testData === 'string') {
      observations.push({
        panelName,
        testName,
        value: testData,
        unit: "",
        originalValue: testData
      });
    } else if (testData && typeof testData === 'object') {
      const obsValue = testData.observed ?? testData.value ?? testData.percent ?? testData.absolute;

      observations.push({
        panelName,
        testName,
        value: obsValue !== undefined ? obsValue : testData,
        unit: testData.unit || "",
        refLow: extractRefLow(testData.reference),
        refHigh: extractRefHigh(testData.reference),
        originalValue: String(obsValue ?? testData),
        flag: testData.flag
      });
    }
  });
}

function extractRefLow(ref?: string): number | undefined {
  if (!ref) return undefined;
  const match = ref.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : undefined;
}

function extractRefHigh(ref?: string): number | undefined {
  if (!ref) return undefined;
  const matches = ref.match(/(\d+\.?\d*)/g);
  return matches && matches.length > 1 ? parseFloat(matches[1]) : undefined;
}

// src/utils/markerParser.ts

export interface RawObservation {
  panelName: string;        // AI will decide freely now
  testName: string;
  value: number | string;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  originalValue: string;
  flag?: string | null;     // "H", "L", "High", "Low", etc.
  page?: number;
}


// ==================== MAIN EXTRACTION (AI-powered, flexible panels) ====================
async function extractWithGemini(markerData: any): Promise<RawObservation[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for reliable parsing");
  }

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp", // best for long reports
    });

    const prompt = `
You are an expert medical lab report parser for Indian diagnostic labs (Sterling Accuris, NRL, Metropolis, Thyrocare, SRL, Dr. Lal PathLabs, etc.).

The input below is raw, noisy Markdown extracted by Datalab Marker from a multi-page PDF report.
It contains tables, repeated headers, doctor signatures, explanations, QR codes, and page breaks.

Task:
- Ignore all noise (patient info repetition, signatures, explanations, QR codes, logos, page numbers).
- Extract **EVERY** laboratory test result present in the document.
- Group tests logically under a suitable panelName (you can create any panelName that makes sense, e.g., "BIOCHEMISTRY", "LFT", "RFT", "THYROID FUNCTION TEST", "HbA1c", "IRON STUDIES", "IMMUNOASSAY", "VITAMIN PROFILE", "HB ELECTROPHORESIS", "URINE ROUTINE", "HIV & HEPATITIS", etc.).
- Return **ONLY** a clean JSON array with this exact structure. No extra text, no markdown.

[
  {
    "panelName": "string - logical panel name (be consistent but flexible)",
    "testName": "clean test name without HTML tags",
    "value": number or string (keep exact format like "141.0", "H 7.10", "Present (+)", "Non Reactive", "< 148", "Negative"),
    "unit": "string or empty string",
    "refLow": number or null,
    "refHigh": number or null,
    "originalValue": "exact original value as shown",
    "flag": "H" or "L" or "High" or "Low" or null,
    "page": number or null
  }
]

Extraction Rules:
- Always extract the test even if panel looks unusual.
- For ranges: "74 - 106" → refLow=74, refHigh=106
- For "< 16.7" or "<1.0" → refHigh=16.7 (or 1.0), refLow=null
- For "H 141.0" → value=141.0, flag="H", originalValue="H 141.0"
- Keep non-numeric values exactly (e.g., "Present (+)", "Absent", "Non Reactive", "Negative").
- Do not skip any test. Process all pages.
- PanelName should be meaningful and consistent (e.g., group all liver-related under "LFT", kidney under "RFT").

Raw Marker output:

${typeof markerData === 'string' ? markerData.substring(0, 45000) : JSON.stringify(markerData).substring(0, 45000)}
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0,
        maxOutputTokens: 16384,           // increased for long reports
      },
    });

    const responseText = result.response.text().trim();
    const parsed = JSON.parse(responseText);

    if (!Array.isArray(parsed)) {
      throw new Error("AI did not return valid array");
    }

    // Optional: light post-cleanup
    return parsed.map((obs: any) => ({
      panelName: String(obs.panelName || "UNCATEGORIZED").trim(),
      testName: String(obs.testName || "").trim(),
      value: obs.value,
      unit: String(obs.unit || "").trim(),
      refLow: typeof obs.refLow === 'number' ? obs.refLow : null,
      refHigh: typeof obs.refHigh === 'number' ? obs.refHigh : null,
      originalValue: String(obs.originalValue || obs.value || ""),
      flag: obs.flag ? String(obs.flag).trim() : null,
      page: typeof obs.page === 'number' ? obs.page : null,
    }));

  } catch (error: any) {
    console.error("❌ Gemini extraction failed:", error.message);
    throw new Error(`Failed to parse lab report: ${error.message}`);
  }
}

export default processMarkerOutput;