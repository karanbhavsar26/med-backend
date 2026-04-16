// src/services/fhirMapper.ts
import { RawObservation } from "../utils/parsers";   // ← make sure this path matches your parser file

export const mapToFHIR = (rawObservations: RawObservation[]) => {
  const needsReview: string[] = [];

  const entries = rawObservations.map((obs, index) => {
    const displayName = `${obs.panelName} - ${obs.testName}`.trim();

    // ====================== Interpretation Logic ======================
    let interpCode = "N";
    let interpDisplay = "Normal";

    const numericValue = typeof obs.value === 'number' ? obs.value : 
                        (typeof obs.value === 'string' ? parseFloat(obs.value) : NaN);

    if (!isNaN(numericValue)) {
      if (obs.refLow !== null && obs.refLow !== undefined && numericValue < obs.refLow) {
        interpCode = "L";
        interpDisplay = "Low";
      } else if (obs.refHigh !== null && obs.refHigh !== undefined && numericValue > obs.refHigh) {
        interpCode = "H";
        interpDisplay = "High";
      }
    } else {
      // Non-numeric values (Absent, Present, Negative, Non Reactive, Trace, etc.)
      if (String(obs.value).toLowerCase().includes("positive") || 
          String(obs.value).toLowerCase().includes("reactive") ||
          String(obs.value).toLowerCase().includes("present")) {
        interpCode = "H";
        interpDisplay = "Abnormal";
      } else if (String(obs.value).toLowerCase().includes("negative") || 
                 String(obs.value).toLowerCase().includes("absent") ||
                 String(obs.value).toLowerCase().includes("non reactive")) {
        interpCode = "N";
        interpDisplay = "Normal";
      } else {
        // Unknown non-numeric → flag for review
        needsReview.push(displayName);
      }
    }

    // ====================== Reference Range ======================
    const referenceRange: any[] = [];
    if (obs.refLow !== null || obs.refHigh !== null) {
      const range: any = {};
      if (obs.refLow !== null && obs.refLow !== undefined) {
        range.low = { value: obs.refLow, unit: obs.unit || "" };
      }
      if (obs.refHigh !== null && obs.refHigh !== undefined) {
        range.high = { value: obs.refHigh, unit: obs.unit || "" };
      }
      if (Object.keys(range).length > 0) {
        referenceRange.push(range);
      }
    }

    // ====================== Validation & needsReview ======================
    const isNumeric = !isNaN(numericValue);
    const hasUnit = !!obs.unit && obs.unit.trim() !== "";

    // Flag for review in these cases:
    if (!obs.testName || obs.testName.trim() === "") {
      needsReview.push(`Observation ${index + 1}: Missing test name`);
    }
    if (isNumeric && !hasUnit) {
      needsReview.push(displayName + " (missing unit)");
    }
    if (typeof obs.value === 'string' && obs.value.trim() === "") {
      needsReview.push(displayName + " (empty value)");
    }

    // ====================== FHIR Observation ======================
    return {
      resource: {
        resourceType: "Observation",
        status: "preliminary",
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "unknown",                    // TODO: Add LOINC mapping later
            display: obs.testName
          }],
          text: displayName
        },
        valueQuantity: isNumeric ? {
          value: Number(numericValue.toFixed(4)),   // avoid floating point noise
          unit: obs.unit || "",
          system: "http://unitsofmeasure.org",
          code: obs.unit || ""
        } : {
          // For non-numeric values (e.g. "Absent", "Positive", "Non Reactive")
          value: String(obs.value),
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
        ...(referenceRange.length > 0 && { referenceRange }),
        // Optional: store original extracted data for debugging
        note: [{
          text: `Original: ${obs.originalValue} | Panel: ${obs.panelName}`
        }]
      }
    };
  });

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entries,
    meta: {
      source: "ocr-extraction",
      processedAt: new Date().toISOString(),
      totalObservations: rawObservations.length,
      needsReview: needsReview.length > 0 ? needsReview : undefined
    }
  };
};