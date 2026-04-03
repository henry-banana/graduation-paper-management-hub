/**
 * fix-template-tags-v3.js  
 *
 * Most reliable approach: 
 * Extract ALL text from the XML, find where {{...}} exist,
 * then rewrite the affected <w:r> runs so each full placeholder
 * is in a single, unbroken <w:t> element.
 *
 * Uses docxtemplater's recommended approach:
 * https://docxtemplater.com/docs/tag-types/#fixing-common-errors
 *
 * Usage: node scripts/fix-template-tags-v3.js
 */
'use strict';

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

/**
 * The key insight: Word splits text arbitrarily between <w:t> runs.
 * When {{placeholder}} is typed, Word may split it as:
 *   <w:t>{{stud</w:t>  [in run 1]
 *   <w:t>entName}}</w:t>  [in run 2]
 *
 * The fix: concatenate ALL text across runs in a paragraph, detect
 * which runs carry broken placeholders, then rebuild those runs with
 * the full placeholder text in a single <w:t>.
 *
 * Approach:
 * 1. Split XML by paragraph (<w:p>)
 * 2. For each paragraph, get all runs with their text
 * 3. Concatenate all text → find all {{...}} offsets
 * 4. For each {{...}}, ensure it lives entirely in one run
 * 5. If not, redistribute text so it does
 */

function getAllTextSegments(paraXml) {
  const segments = [];
  // Match each w:r run
  const runRe = /(<w:r\b[^>]*>)([\s\S]*?)(<\/w:r>)/g;
  let rm;
  while ((rm = runRe.exec(paraXml)) !== null) {
    const runFull = rm[0];
    const runOpen = rm[1];
    const runBody = rm[2];
    const runClose = rm[3];
    
    // Get rPr (formatting) if any
    const rPrMatch = runBody.match(/(<w:rPr>[\s\S]*?<\/w:rPr>)/);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    
    // Get all text from this run
    const texts = [];
    const tRe = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
    let tm;
    while ((tm = tRe.exec(runBody)) !== null) {
      texts.push(tm[1]);
    }
    
    segments.push({
      fullXml: runFull,
      runOpen,
      runClose,
      rPr,
      text: texts.join(''),
      start: rm.index,
      end: rm.index + runFull.length,
    });
  }
  return segments;
}

function rebuildParagraph(paraXml, segments) {
  // Concatenate all text from all runs
  let fullText = segments.map(s => s.text).join('');
  
  if (!fullText.includes('{{') && !fullText.includes('}}')) {
    return paraXml; // No placeholders, no change
  }
  
  // Find all {{...}} in fullText and their char ranges
  const placeholders = [];
  const phRe = /\{\{[^{}]*?\}\}/g;
  let pm;
  while ((pm = phRe.exec(fullText)) !== null) {
    placeholders.push({ start: pm.index, end: pm.index + pm[0].length, text: pm[0] });
  }
  
  if (placeholders.length === 0) return paraXml;
  
  // Map each character position to which segment it belongs
  let pos = 0;
  const charMap = []; // charMap[i] = segment index
  for (let si = 0; si < segments.length; si++) {
    for (let c = 0; c < segments[si].text.length; c++) {
      charMap[pos++] = si;
    }
  }
  
  // Check if any placeholder spans multiple segments
  let needsFix = false;
  for (const ph of placeholders) {
    if (ph.start >= charMap.length || ph.end - 1 >= charMap.length) continue;
    const startSeg = charMap[ph.start];
    const endSeg = charMap[ph.end - 1];
    if (startSeg !== endSeg) {
      needsFix = true;
      break;
    }
  }
  
  if (!needsFix) return paraXml;
  
  // Rebuild: split fullText into parts that align with segment boundaries,
  // but ensure no {{...}} is split across boundaries.
  // Strategy: merge segments that share a placeholder.
  
  // Build groups of segments that must be merged
  const groups = [];
  let gi = 0;
  while (gi < segments.length) {
    const group = [gi];
    let groupEnd = segments.slice(0, gi + 1).reduce((s, seg) => s + seg.text.length, 0);
    let groupStart = groupEnd - segments[gi].text.length;
    
    // Check if any placeholder starts in this segment but ends in a later one
    for (const ph of placeholders) {
      if (ph.start >= groupStart && ph.start < groupEnd && ph.end > groupEnd) {
        // This placeholder extends beyond current group. Keep extending.
        while (groupEnd < ph.end && gi + group.length < segments.length) {
          const nextIdx = gi + group.length;
          group.push(nextIdx);
          groupEnd += segments[nextIdx].text.length;
        }
      }
    }
    
    groups.push(group);
    gi += group.length;
  }
  
  // Build new paragraph XML
  // For each group, merge their text and use the first run's rPr
  let newPara = paraXml;
  
  // Process groups from last to first to preserve string positions
  for (let g = groups.length - 1; g >= 0; g--) {
    const group = groups[g];
    if (group.length === 1) continue; // No merge needed
    
    const segs = group.map(idx => segments[idx]);
    const mergedText = segs.map(s => s.text).join('');
    
    // Build merged run XML
    const firstSeg = segs[0];
    const hasSpace = mergedText.startsWith(' ') || mergedText.endsWith(' ') || mergedText.includes('  ');
    const spaceAttr = hasSpace ? ' xml:space="preserve"' : '';
    const escapedText = mergedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    const newRun = `${firstSeg.runOpen}${firstSeg.rPr}<w:t${spaceAttr}>${escapedText}</w:t>${firstSeg.runClose}`;
    
    // Build the original sequence to replace
    const originalSeq = segs.map(s => s.fullXml).join('');
    
    if (newPara.includes(originalSeq)) {
      newPara = newPara.replace(originalSeq, newRun);
    }
  }
  
  return newPara;
}

function fixXml(documentXml) {
  // Process each paragraph
  return documentXml.replace(/(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g, (full, open, body, close) => {
    const segments = getAllTextSegments(body);
    if (segments.length === 0) return full;
    
    const fixedBody = rebuildParagraph(body, segments);
    if (fixedBody === body) return full;
    
    return open + fixedBody + close;
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('🔧 Fixing split {{placeholder}} tags in templates...\n');
let anyFixed = false;

for (const t of templates) {
  const tp = path.join(TEMPLATE_DIR, t);
  if (!fs.existsSync(tp)) {
    console.log(`[SKIP]    ${t}`);
    continue;
  }

  // Backup
  const backupPath = tp + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(tp, backupPath);
    console.log(`           (backed up to ${path.basename(backupPath)})`);
  }

  const bin = fs.readFileSync(tp, 'binary');
  const zip = new PizZip(bin);
  const originalXml = zip.file('word/document.xml')?.asText() ?? '';

  const fixedXml = fixXml(originalXml);

  if (fixedXml === originalXml) {
    console.log(`[OK]      ${t} — no changes needed`);
    continue;
  }

  // Count merged placeholders (approximation)
  const origWt = (originalXml.match(/<w:t[\s>]/g) || []).length;
  const fixedWt = (fixedXml.match(/<w:t[\s>]/g) || []).length;
  
  zip.file('word/document.xml', fixedXml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(tp, buf);
  
  console.log(`[FIXED]   ${t} (<w:t> count: ${origWt} → ${fixedWt})`);
  anyFixed = true;
}

console.log('');
console.log(anyFixed
  ? '✅ Done. Run: node scripts/diagnose-templates.js'
  : '✅ All templates OK. Run: node scripts/diagnose-templates.js to verify');
