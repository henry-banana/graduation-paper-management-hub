/**
 * fix-council-template.js
 * 
 * Direct fix: the council template has split placeholders like:
 *   <w:t>{{diem</w:t>  [XML noise]  <w:t>}}</w:t>
 * 
 * The number between is missing because Word split the text while typing.
 * We fix by:
 * 1. Find the exact positions of each split {{diem + }} pair
 * 2. Determine which diem number it should be (2,3,4,5) based on order
 * 3. Replace the second <w:t>}}</w:t> with <w:t>N}}</w:t> and remove the opening partial
 * 
 * Usage: node scripts/fix-council-template.js
 */
'use strict';

const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const tp = path.join(__dirname, '..', 'resources', 'docx-templates', 'kltn-council-rubric-template.docx');

// Backup
const backupPath = tp + '.bak2';
fs.copyFileSync(tp, backupPath);
console.log('Backed up to:', path.basename(backupPath));

const bin = fs.readFileSync(tp, 'binary');
const zip = new PizZip(bin);
let xml = zip.file('word/document.xml').asText();

// Find all text segments containing relevant chars
const re = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
const segments = [];
let m;
while ((m = re.exec(xml)) !== null) {
  segments.push({
    full: m[0],
    attrs: m[1],
    text: m[2],
    pos: m.index,
    end: m.index + m[0].length,
  });
}

// Find the broken pattern: {{diem followed later by }}
// We expect pairs: segment with "{{diem" text, then some segments later a segment with "}}"
// The "N" (number) is missing entirely — it was typed in a way that got eaten by Word formatting

// Collect indices of broken segments
const brokenDiemOpens = [];
const brokenCloses = [];

for (const seg of segments) {
  if (seg.text === '{{diem') brokenDiemOpens.push(seg);
  if (seg.text === '}}') brokenCloses.push(seg);
}

console.log(`Found ${brokenDiemOpens.length} broken {{diem opens`);
console.log(`Found ${brokenCloses.length}} }}  closes`);

// Pair them up in order
const pairs = [];
for (let i = 0; i < brokenDiemOpens.length; i++) {
  const openSeg = brokenDiemOpens[i];
  // Find the next }} after this openSeg
  const closeSeg = brokenCloses.find(c => c.pos > openSeg.pos);
  if (closeSeg) {
    pairs.push({ open: openSeg, close: closeSeg, diemNum: i + 2 }); // diem2, diem3, diem4, diem5
    // Remove from brokenCloses to avoid re-using
    brokenCloses.splice(brokenCloses.indexOf(closeSeg), 1);
  }
}

console.log(`\nWill fix ${pairs.length} pairs:`);
for (const p of pairs) {
  console.log(`  {{diem${p.diemNum}}} (open@${p.open.pos}, close@${p.close.pos})`);
}

if (pairs.length === 0) {
  console.log('Nothing to fix.');
  process.exit(0);
}

// Apply fixes from LAST to FIRST (to preserve positions)
const sortedPairs = [...pairs].sort((a, b) => b.close.pos - a.close.pos);

for (const pair of sortedPairs) {
  const { open, close, diemNum } = pair;
  
  // Replace close segment: }} → N}}
  const newClose = `<w:t${close.attrs}>${diemNum}}}</w:t>`;
  xml = xml.slice(0, close.pos) + newClose + xml.slice(close.end);
  
  // Replace open segment: {{diem → {{diem (keep, but docxtemplater needs it cleaned)
  // Actually we need to replace {{diem with empty string since the number+}} is now in close
  // WAIT - that won't work. We need complete {{diemN}} in one tag.
  // Better: replace open with {{diemN}} and close with empty
}

// Reset and try different approach: 
// Replace open "{{diem" with "{{diemN" and close "}}" with "}}"
// but they're in separate <w:t> — docxtemplater can't handle cross-run placeholders

// The ONLY reliable fix is to put it all in ONE <w:t>
// Strategy: replace the open segment with complete {{diemN}} and replace close with empty text

xml = zip.file('word/document.xml').asText(); // Reset

// Sort pairs by position descending
const sortedPairs2 = [...pairs].sort((a, b) => b.open.pos - a.open.pos);

for (const pair of sortedPairs2) {
  const { open, close, diemNum } = pair;
  
  // Replace close with just empty (or whitespace to not break XML)
  const newClose = `<w:t${close.attrs}> </w:t>`;
  xml = xml.slice(0, close.pos) + newClose + xml.slice(close.end);
  
  // Replace open with full placeholder
  const newOpen = `<w:t${open.attrs}>{{diem${diemNum}}}</w:t>`;
  xml = xml.slice(0, open.pos) + newOpen + xml.slice(open.end);
}

// Verify result
const verify = [];
const re2 = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
while ((m = re2.exec(xml)) !== null) {
  const t = m[2];
  if (t.includes('{') || t.includes('}')) {
    verify.push(`pos=${m.index} text=${JSON.stringify(t)}`);
  }
}

console.log('\nVerification (all { } text segments):');
for (const v of verify) console.log(' ', v);

// Check for remaining broken patterns
const hasBroken = verify.some(v => v.includes('"{{diem"') || v.includes('"}}">'));
if (hasBroken) {
  console.log('\n⚠️  Still has broken patterns. Check manually.');
} else {
  // Save
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(tp, buf);
  console.log('\n✅ Saved fixed template.');
}
