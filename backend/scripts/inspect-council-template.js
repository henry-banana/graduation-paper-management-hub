/**
 * inspect-council-template.js - Show all { } containing text in XML
 */
'use strict';
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const tp = path.join(__dirname, '..', 'resources', 'docx-templates', 'kltn-council-rubric-template.docx');
const zip = new PizZip(fs.readFileSync(tp, 'binary'));
const xml = zip.file('word/document.xml').asText();

const re = /<w:t(?:[^>]*)>([^<]*)<\/w:t>/g;
let m;
while ((m = re.exec(xml)) !== null) {
  const t = m[1];
  if (t.includes('{') || t.includes('}')) {
    console.log(`pos=${m.index} text=${JSON.stringify(t)}`);
  }
}
