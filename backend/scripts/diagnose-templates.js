/**
 * diagnose-templates.js - Check all rubric templates for docxtemplater parse errors
 */
'use strict';

const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'resources', 'docx-templates');
const templates = [
  'bctt-rubric-template.docx',
  'kltn-gvhd-rubric-template.docx',
  'kltn-gvpb-rubric-template.docx',
  'kltn-council-rubric-template.docx',
];

let allOk = true;

for (const t of templates) {
  const tp = path.join(TEMPLATE_DIR, t);
  if (!fs.existsSync(tp)) {
    console.log(`[MISSING] ${t}`);
    allOk = false;
    continue;
  }

  const bin = fs.readFileSync(tp, 'binary');
  const zip = new PizZip(bin);

  try {
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    // Try a dummy render to catch render-time issues
    doc.render({ dummy: '' });
    console.log(`[OK]      ${t}`);
  } catch (e) {
    allOk = false;
    const errs = e.properties && e.properties.errors;
    if (errs && errs.length > 0) {
      for (const err of errs) {
        const p = err.properties || {};
        console.log(`[ERROR]   ${t} :: id=${p.id} tag="${p.xtag}" ctx="${(p.context||'').slice(0,60)}"`);
      }
    } else {
      console.log(`[ERROR]   ${t} :: ${e.message}`);
    }
  }
}

process.exit(allOk ? 0 : 1);
