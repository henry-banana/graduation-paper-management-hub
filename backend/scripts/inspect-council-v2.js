/**
 * inspect-council-v2.js - deeper XML inspection including rsid splits
 */
'use strict';

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const tp = path.join(__dirname, '..', 'resources', 'docx-templates', 'kltn-council-rubric-template.docx');
const zip = new PizZip(fs.readFileSync(tp, 'binary'));
const xml = zip.file('word/document.xml').asText();

// Find context around problematic strings
const probes = ['{{stud', 'Name}}', 'ntId}}', '{{tota', 'ixed}}'];

for (const probe of probes) {
  let startIdx = 0;
  while (true) {
    const idx = xml.indexOf(probe, startIdx);
    if (idx < 0) break;
    const ctx = xml.slice(Math.max(0, idx - 120), Math.min(xml.length, idx + 120));
    console.log(`\n=== "${probe}" at pos ${idx} ===`);
    console.log(ctx);
    startIdx = idx + 1;
  }
}
