/**
 * fix-template-tags-v2.js
 * 
 * Fixes Word .docx templates where {{placeholder}} tags are split across
 * multiple <w:r> runs in the XML. This is the real fix for:
 *   duplicate_open_tag: "{{stud" (split from "entName}}")
 *   duplicate_close_tag: "ixed}}" (split from "{{totalScoreF")
 *
 * Strategy: extract all text from the paragraph, detect {{...}}, then
 * use docxtemplater's built-in "fixDocPrCorruptCharacters" isn't available,
 * so we use a raw string approach:
 *   1. Read full document XML
 *   2. Concatenate all <w:t> text in successive runs (within a <w:p>)
 *   3. Detect that the concatenated form has {{ }} balanced
 *   4. Rebuild the XML with corrected runs
 *
 * Simpler approach used here:
 *   - Collapse the entire XML into a flat string of all text within each <w:p>
 *   - Re-inject the text back into the first run of each set
 *   - Actually: just merge entire paragraphs' <w:t> text into single run text
 *     but ONLY for paragraphs/cells that contain a partial {{ or }}
 *
 * Usage: node scripts/fix-template-tags-v2.js
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
 * The real fix: in the full XML string, find any {{ that is split across
 * <w:t> boundaries with arbitrary XML between, and rejoin them.
 *
 * We do this by:
 * 1. Finding all "text content" runs (extracting position + text of each <w:t>)
 * 2. Concatenating all texts and finding {{ ... }} patterns
 * 3. If a placeholder spans multiple <w:t> elements, we merge those elements
 *
 * Implementation: simpler regex-based XML tag stitching.
 */
function fixSplitTags(xml) {
  // Replace all {{...}} that are split by XML tags between the { { and } }
  // 
  // Pattern: we look for { followed by XML-noise followed by { (open tag split)
  // and } followed by XML-noise followed by } (close tag split)
  //
  // The noise between characters is: any XML that does NOT contain plain text
  // i.e., it can contain </w:t>, </w:r>, <w:r>, <w:t>, <w:rPr>...</w:rPr> etc.
  // but the text characters must form a continuous sequence when concatenated.
  //
  // We use a two-pass approach:
  //   Pass 1: find the concatenated text of each <w:p> paragraph
  //   Pass 2: if concat text has {{ }}, check if each <w:t> has the full tag
  //           if not, rewrite the paragraph

  let result = xml;

  // Match each paragraph <w:p ...>...</w:p>
  result = result.replace(/(<w:p[ >][\s\S]*?<\/w:p>)/g, (para) => {
    // Get all text runs from this paragraph
    const runPattern = /(<w:r[ >][\s\S]*?<\/w:r>)/g;
    const runs = [];
    let m;
    while ((m = runPattern.exec(para)) !== null) {
      const runXml = m[1];
      // Extract text from <w:t>
      const texts = [];
      const tPattern2 = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
      let tm;
      while ((tm = tPattern2.exec(runXml)) !== null) {
        texts.push(tm[1]);
      }
      runs.push({
        xml: runXml,
        text: texts.join(''),
        index: m.index,
      });
    }

    if (runs.length === 0) return para;

    // Concatenate all run texts
    const fullText = runs.map(r => r.text).join('');

    // Check if full text has any {{ or }} that might be incomplete in individual runs
    const hasPlaceholder = /\{\{/.test(fullText) || /\}\}/.test(fullText);
    if (!hasPlaceholder) return para;

    // Check if any individual run has an incomplete {{ or }}
    // (starts/ends with partial placeholder)
    const hasPartialTag = runs.some(r => {
      const t = r.text;
      // partial open: ends with { but no }}; or starts with {var}}
      return (t.endsWith('{') && !t.includes('{{')) ||
             (t.startsWith('{') && !t.startsWith('{{') && t.includes('}}')) ||
             // partial close: ends with } but no {{ }}
             (t.endsWith('}') && !t.includes('}}')) ||
             (t.startsWith('}') && !t.startsWith('}}') && !t.includes('{{'));
    });

    if (!hasPartialTag) return para;

    // The paragraph has split placeholders. We need to merge adjacent runs
    // that together form a complete {{placeholder}}.
    //
    // Strategy: merge ALL runs' text into the first run, remove others.
    // This is aggressive but safe for table cells that only have placeholder text.
    //
    // Better strategy: find which runs need merging and only merge those.

    // We'll do a targeted merge: build a list of run groups where
    // {{ }} is split across group members, merge each group.
    const mergedRuns = mergeSplitRuns(runs);

    if (mergedRuns === null) {
      // Fallback: no change
      return para;
    }

    // Rebuild the paragraph: replace run sequences with merged versions
    let newPara = para;
    // Replace from last to first to preserve indices
    for (let i = mergedRuns.merges.length - 1; i >= 0; i--) {
      const merge = mergedRuns.merges[i];
      // Build new merged run XML
      const firstRun = runs[merge.start];
      const mergedText = runs.slice(merge.start, merge.end + 1).map(r => r.text).join('');
      const needsSpace = mergedText.includes(' ') || mergedText.startsWith(' ') || mergedText.endsWith(' ');
      const spaceAttr = needsSpace ? ' xml:space="preserve"' : '';
      const newT = `<w:t${spaceAttr}>${escapeXml(mergedText)}</w:t>`;

      // Replace the run's <w:t> content with merged text (only in first run)
      let newFirstRun = firstRun.xml.replace(/<w:t(?:[^>]*)>[\s\S]*?<\/w:t>/, newT);

      // Build replacement: new first run + empty strings for removed runs
      const runXmls = runs.slice(merge.start, merge.end + 1).map(r => r.xml);
      const originalSequence = runXmls.join('');
      newPara = newPara.replace(originalSequence, newFirstRun);
    }

    return newPara;
  });

  return result;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Given an array of runs [{xml, text}], find groups of consecutive runs
 * that need to be merged because {{ }} is split across them.
 * Returns { merges: [{start, end}] } or null.
 */
function mergeSplitRuns(runs) {
  const merges = [];
  let i = 0;
  while (i < runs.length) {
    const t = runs[i].text;
    
    // Check if this run starts a partial {{ tag
    if (t.includes('{') && !t.includes('{{') && (t.endsWith('{') || t.includes('{{'))) {
      // Find the run that closes it
      let end = i;
      let combined = t;
      while (end < runs.length - 1 && !combined.includes('{{')) {
        end++;
        combined += runs[end].text;
      }
      if (combined.includes('{{') && end > i) {
        merges.push({ start: i, end });
        i = end + 1;
        continue;
      }
    }
    
    // Check if this run starts {{ but doesn't close }}
    if (t.includes('{{') && !t.includes('}}')) {
      let end = i;
      let combined = t;
      while (end < runs.length - 1 && !combined.includes('}}')) {
        end++;
        combined += runs[end].text;
      }
      if (combined.includes('}}') && end > i) {
        merges.push({ start: i, end });
        i = end + 1;
        continue;
      }
    }
    
    // Check partial close: run ends with } but no }}
    if (t.endsWith('}') && !t.endsWith('}}') && !t.includes('{{')) {
      let start = i;
      let combined = t;
      while (start > 0) {
        start--;
        combined = runs[start].text + combined;
        if (combined.includes('{{') || combined.includes('}}')) break;
      }
      // handle in forward pass
    }
    
    i++;
  }

  if (merges.length === 0) return null;
  return { merges };
}

// ── Main ────────────────────────────────────────────────────────────────────
let anyFixed = false;
let allOk = true;

for (const t of templates) {
  const tp = path.join(TEMPLATE_DIR, t);
  if (!fs.existsSync(tp)) {
    console.log(`[SKIP]    ${t} — file not found`);
    continue;
  }

  // Backup original
  const backupPath = tp + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(tp, backupPath);
  }

  const bin = fs.readFileSync(tp, 'binary');
  const zip = new PizZip(bin);
  const originalXml = zip.file('word/document.xml')?.asText() ?? '';

  const fixedXml = fixSplitTags(originalXml);

  if (fixedXml === originalXml) {
    console.log(`[OK]      ${t} — no split tags detected`);
    continue;
  }

  const origCount = (originalXml.match(/<w:t/g) || []).length;
  const fixedCount = (fixedXml.match(/<w:t/g) || []).length;

  zip.file('word/document.xml', fixedXml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(tp, buf);

  console.log(`[FIXED]   ${t} — <w:t> count: ${origCount} → ${fixedCount}`);
  anyFixed = true;
}

console.log('');
if (anyFixed) {
  console.log('✅ Templates fixed. Now run: node scripts/diagnose-templates.js');
} else {
  console.log('ℹ️  No changes made. If you still see errors, placeholders are split');
  console.log('   across different paragraphs/cells — fix manually in Word.');
}
