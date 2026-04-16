// src/utils/markerParser.ts

export interface RawObservation {
    panelName: string;
    testName: string;
    value: number | string;
    unit: string;
    refLow?: number;
    refHigh?: number;
    originalValue?: string;
    flag?: string;
  }
  
  export const convertMarkerStructuredJSON = (markerData: any): RawObservation[] => {
    const observations: RawObservation[] = [];
    const testResults = markerData?.test_results || {};
  
    Object.entries(testResults).forEach(([panelKey, panelData]: [string, any]) => {
      const panelName = getPanelName(panelKey);
  
      // Handle nested objects (like urine_examination_routine.general, .chemical, .microscopic)
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
    if (k.includes('renal') || k.includes('rft')) return "RFT";
    if (k.includes('urine')) return "URINE";
    if (k.includes('cbc') || k.includes('haemogram')) return "CBC";
    if (k.includes('electrolytes')) return "ELECTROLYTES";
    return "Uncategorized";
  }
  
  function processSection(section: any, panelName: string, observations: RawObservation[]) {
    if (!section || typeof section !== 'object') return;
  
    Object.entries(section).forEach(([testKey, testData]: [string, any]) => {
      let testName = testKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  
      if (typeof testData === 'string') {
        // Simple values like "Absent", "Negative", "Normal"
        observations.push({
          panelName,
          testName,
          value: testData,
          unit: "",
          originalValue: testData
        });
      } 
      else if (testData && typeof testData === 'object') {
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