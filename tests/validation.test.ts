// tests/validation.test.ts
import { mapToFHIR } from '../src/services/fhirMapper';
import { RawObservation } from '../src/utils/parsers';

describe('Validation Layer - mapToFHIR', () => {
  it('should flag observations with invalid value or missing unit in needsReview', () => {
    const rawObservations: RawObservation[] = [
      {
        panelName: "LFT",
        testName: "Bilirubin Total",
        value: 0.59,
        unit: "mg/dL",
        refLow: 0.1,
        refHigh: 1.23,
      },
      {
        panelName: "RFT",
        testName: "Creatinine",
        value: NaN,                    // Invalid value
        unit: "mg/dL",
      },
      {
        panelName: "Urine",
        testName: "Colour",
        value: "Light Red",
        unit: "",                      // Missing unit
      },
      {
        panelName: "CBC",
        testName: "Haemoglobin",
        value: 12.28,
        unit: "gm/dL",
      },
    ];

    const result = mapToFHIR(rawObservations);

    expect(result.meta.source).toBe("ocr-extraction");
    
    // Should flag 2 invalid observations
    expect(result.meta.needsReview).toContain("LFT - Creatinine");
    expect(result.meta.needsReview).toContain("Urine - Colour");
    expect(result.meta.needsReview.length).toBe(2);

    // Valid observations should NOT be in needsReview
    expect(result.meta.needsReview).not.toContain("LFT - Bilirubin Total");
    expect(result.meta.needsReview).not.toContain("CBC - Haemoglobin");
  });

  it('should correctly set interpretation (L/H/N) based on reference range', () => {
    const rawObservations: RawObservation[] = [
      { panelName: "LFT", testName: "Bilirubin Total", value: 0.59, unit: "mg/dL", refLow: 0.1, refHigh: 1.23 },
      { panelName: "RFT", testName: "Creatinine", value: 0.4, unit: "mg/dL", refLow: 0.5, refHigh: 1.2 },   // Low
      { panelName: "RFT", testName: "BUN", value: 25, unit: "mg/dL", refLow: 7, refHigh: 20 },               // High
    ];

    const result = mapToFHIR(rawObservations);

    const observations = result.entry.map(e => e.resource);

    // Normal
    expect(observations[0].interpretation[0].coding[0].code).toBe("N");

    // Low
    expect(observations[1].interpretation[0].coding[0].code).toBe("L");

    // High
    expect(observations[2].interpretation[0].coding[0].code).toBe("H");
  });

  it('should handle string values gracefully (e.g. Absent, Normal)', () => {
    const rawObservations: RawObservation[] = [
      { panelName: "Urine", testName: "Glucose", value: "Absent", unit: "" },
    ];

    const result = mapToFHIR(rawObservations);

    expect(result.meta.needsReview).toContain("Urine - Glucose");
    expect(result.entry[0].resource.valueQuantity.value).toBe("Absent");
  });
});