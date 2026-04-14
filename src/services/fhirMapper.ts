// src/services/fhirMapper.ts
import { RawObservation } from '../utils/parsers';

const loincMap: Record<string, string> = {
  "Bilirubin Total": "1975-2",
  "Bilirubin Direct": "1968-7",
  "Bilirubin- Indirect": "1970-3",
  "SGOT (AST)": "1920-8",
  "SGPT (ALT)": "1742-6",
  "Alkaline Phosphatase, Serum": "6768-6",
  "Gamma GT (GGTP)": "2324-2",
  "Total Protein": "2885-2",
  "Albumin, Serum": "1751-7",
  "Globulin": "10834-0",
  "Albumin/Globulin Ratio": "10835-7",
  "BUN, Serum": "3094-0",
  "Creatinine, Serum": "2160-0",
  "eGFR": "98979-8",
  "Uric Acid, Serum": "3084-1",
  "Sodium, Serum": "2951-2",
  "Potassium, Serum": "2823-3",
  "Chloride, Serum": "2075-0",
  "Calcium, Serum": "17861-6",
  "Phosphorus, Serum": "2777-1",
  "Specific Gravity": "2965-2",
  "Reaction (pH)": "2756-5",
  "Red blood cells": "5799-2",
  "Pus cells (WBCs)": "5797-6",
  "Epithelial cells": "5787-7",
  "Colour": "5778-6",                    // Urine Colour
  "Transparency (Appearance)": "5777-8", // Urine Clarity
  "Deposit": "5790-1",                   // Urine Sediment
  "Urine Protein (Albumin)": "5804-0",
  "Urine Ketones (Acetone)": "5802-4",
  "Urine Glucose": "5792-7",
  "Bile Pigments": "5770-3",
  "Bile Salts": "5771-1",
  "Urobilinogen": "5803-2",
  "Nitrite": "5800-0",
};

export const mapToFHIR = (rawObservations: RawObservation[]) => {
    const needsReview: string[] = [];
  
    const entries = rawObservations.map((obs) => {
      // Keep panel + test name as you requested
      let displayName = `${obs.panelName} - ${obs.testName}`.trim();
      displayName = displayName
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
  
      const loincCode = loincMap[obs.testName] 
        || loincMap[obs.testName.replace(/, Serum/g, '').trim()] 
        || "unknown";
  
      let interpCode = "N";
      let interpDisplay = "Normal";
  
      if (typeof obs.value === 'number') {
        if (obs.refLow !== undefined && obs.value < obs.refLow) {
          interpCode = "L";
          interpDisplay = "Low";
        } else if (obs.refHigh !== undefined && obs.value > obs.refHigh) {
          interpCode = "H";
          interpDisplay = "High";
        }
      }
  
      // Build referenceRange properly (handles < 1.23, 0-35, 0.1-1.0 etc.)
      const referenceRange: any[] = [];
      if (obs.refLow !== undefined || obs.refHigh !== undefined) {
        const range: any = {};
        if (obs.refLow !== undefined) {
          range.low = { value: obs.refLow, unit: obs.unit || "" };
        }
        if (obs.refHigh !== undefined) {
          range.high = { value: obs.refHigh, unit: obs.unit || "" };
        }
        referenceRange.push(range);
      }
  
      if ((typeof obs.value === 'number' && isNaN(obs.value)) || !obs.unit) {
        needsReview.push(displayName);
      }
  
      return {
        resource: {
          resourceType: "Observation",
          status: "preliminary",
          code: {
            coding: [{
              system: "http://loinc.org",
              code: loincCode,
              display: displayName
            }],
            text: displayName
          },
          valueQuantity: {
            value: typeof obs.value === 'number' ? Number(obs.value.toFixed(3)) : obs.value,
            unit: obs.unit || "",
            system: "http://unitsofmeasure.org",
            code: obs.unit || ""
          },
          interpretation: [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: interpCode,
              display: interpDisplay
            }]
          }],
          ...(referenceRange.length > 0 && { referenceRange })
        }
      };
    });
  
    return {
      resourceType: "Bundle",
      type: "collection",
      entry: entries,
      meta: {
        source: "ocr-extraction",
        needsReview: needsReview.length > 0 ? needsReview : []
      }
    };
  };