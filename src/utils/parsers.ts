// src/utils/parsers.ts - Simple + Strong Garbage Filter

export interface RawObservation {
    panelName: string;
    testName: string;
    value: number | string;
    unit: string;
    refLow?: number;
    refHigh?: number;
    originalValue?: string;
  }
  
  export const parseLabReportMarkdown = (markdown: string): RawObservation[] => {
    const observations: RawObservation[] = [];
    let currentPanel = "General";
  
    const lines = markdown.split('\n');
  
    for (let line of lines) {
      let cleanLine = line.trim()
        .replace(/<\/?[^>]+>/g, '')   // remove all HTML
        .replace(/\s+/g, ' ');
  
      // === PANEL DETECTION ===
      if (/LFT|Liver Function/i.test(cleanLine)) currentPanel = "LFT (Liver Function Test) 2 - Mini";
      else if (/RFT|Renal|Kidney/i.test(cleanLine)) currentPanel = "RFT (Renal/Kidney) Function Tests Profile - Maxi";
      else if (/Routine Examination Profile - Urine/i.test(cleanLine)) currentPanel = "Routine Examination Profile - Urine";
      else if (/CBC|Haemogram/i.test(cleanLine)) currentPanel = "CBC Haemogram";
  
      // === STRONG GARBAGE FILTER (This will remove Name, Referred by, Collected On, etc.) ===
      const garbage = [
        "Name :", "Referred by", "Collected On", "Registered On", 
        "Contact No.", "Patient Name", "Age", "Gender", "Female", 
        "Year(s)", "Dr.", "Pathologist", "Remark", "Test done on"
      ];
  
      if (garbage.some(word => cleanLine.includes(word))) {
        continue;
      }
  
      if (cleanLine.length < 5 || 
          cleanLine.includes("Investigation") || 
          cleanLine.includes("---")) {
        continue;
      }
  
      // Handle table rows with |
      if (cleanLine.includes('|')) {
        const cells = cleanLine.split('|').map(c => c.trim()).filter(c => c.length > 0);
        if (cells.length >= 2) {
          let testName = cells[0].replace(/^\*\*|\*\*$/g, '').trim();
          let valueStr = cells[1] || '';
          let unit = (cells[2] || '').trim();
          let refStr = (cells[3] || '').trim();
  
          testName = testName.replace(/\s*\(.*?\)/, '').trim();
  
          let value: number | string = NaN;
          const numMatch = valueStr.match(/(\d+\.?\d*)/);
          if (numMatch) value = parseFloat(numMatch[1]);
  
          if (valueStr.includes('>') || valueStr.includes('<')) value = valueStr;
  
          let refLow: number | undefined;
          let refHigh: number | undefined;
          if (refStr.includes('-')) {
            const parts = refStr.split('-').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
            if (parts.length === 2) {
              refLow = !isNaN(parts[0]) ? parts[0] : undefined;
              refHigh = !isNaN(parts[1]) ? parts[1] : undefined;
            }
          } else if (refStr.includes('<')) {
            refHigh = parseFloat(refStr.replace(/[^0-9.]/g, ''));
          }
  
          if (testName) {
            observations.push({
              panelName: currentPanel,
              testName,
              value: !Number.isNaN(value) ? value : valueStr,
              unit,
              refLow,
              refHigh,
              originalValue: valueStr
            });
          }
        }
        continue;
      }
  let i=0
      // Simple multi-line test pattern (for CBC)
      if (i + 1 < lines.length) {
        let nextLine = lines[i + 1].trim().replace(/<\/?[^>]+>/g, '').replace(/\s+/g, ' ');
        const valueMatch = nextLine.match(/(\d+\.?\d*|\d+,\d+)\s+([^\s]+(?:\s+[^\s]+)?)?\s*(.+)?/);
        
        if (valueMatch) {
          let testName = cleanLine.replace(/\s*\(.*?\)/, '').trim();
          let valueStr = valueMatch[1];
          let unit = valueMatch[2] || '';
          let refStr = valueMatch[3] || '';
  
          let value: number | string = NaN;
          const num = valueStr.match(/(\d+\.?\d*)/);
          if (num) value = parseFloat(num[1]);
  
          if (valueStr.includes('>') || valueStr.includes('<')) value = valueStr;
  
          let refLow: number | undefined;
          let refHigh: number | undefined;
          if (refStr && refStr.includes('-')) {
            const parts = refStr.split('-').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
            if (parts.length === 2) {
              refLow = !isNaN(parts[0]) ? parts[0] : undefined;
              refHigh = !isNaN(parts[1]) ? parts[1] : undefined;
            }
          } else if (refStr && refStr.includes('<')) {
            refHigh = parseFloat(refStr.replace(/[^0-9.]/g, ''));
          }
  
          if (testName && valueStr) {
            observations.push({
              panelName: currentPanel,
              testName,
              value,
              unit,
              refLow,
              refHigh,
              originalValue: valueStr
            });
          }
          i++; // skip next line
        }
      }
    }
  
    return observations;
  };