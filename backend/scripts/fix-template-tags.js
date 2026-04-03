/**
 * fix-template-tags.js
 * Fixes Word .docx templates where {{placeholder}} tags get split across
 * multiple <w:t> XML runs (common when typing {{ }} directly in Word).
 *
 * The fix merges text within a <w:r> run so all {{...}} are in one <w:t>.
 * Then saves back a fixed copy of the template.
 *
 * Usage: node scripts/fix-template-tags.js
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
 * Merge multiple <w:t> elements within the same <w:r> run into one.
 * This ensures {{placeholder}} that Word split across runs is reunified.
 */
function mergeRunTexts(documentXml) {
  // Step 1: Within each <w:r>...</w:r>, merge all <w:t>...</w:t> text content
  // into a single <w:t xml:space="preserve">...</w:t>
  return documentXml.replace(
    /(<w:r[ >][\s\S]*?<\/w:r>)/g,
    (run) => {
      // Collect all text from <w:t> elements in this run
      const textMatches = [];
      const tPattern = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
      let m;
      while ((m = tPattern.exec(run)) !== null) {
        textMatches.push(m[1]);
      }

      if (textMatches.length <= 1) {
        // Nothing to merge
        return run;
      }

      const mergedText = textMatches.join('');

      // Only rewrite if merged text contains placeholder chars ({{ or }})
      // OR if there are multiple <w:t> (fragmented run)
      // Replace all <w:t>...</w:t> occurrences with single merged one
      const needsSpace = mergedText.startsWith(' ') || mergedText.endsWith(' ');
      const spaceAttr = needsSpace ? ' xml:space="preserve"' : '';
      const mergedTag = `<w:t${spaceAttr}>${mergedText}</w:t>`;

      // Remove all existing <w:t>...</w:t> and replace with merged one
      const withoutTs = run.replace(/<w:t(?:[^>]*)>[\s\S]*?<\/w:t>/g, '');
      // Insert merged tag before </w:r>
      return withoutTs.replace('</w:r>', `${mergedTag}</w:r>`);
    }
  );
}

/**
 * Further fix: if a {{ or }} spans across different <w:r> elements
 * (mergeRunTexts won't cover that case), we use a simpler regex approach
 * to stitch the raw XML.
 *
 * Strategy: in the full XML, find patterns like
 *   </w:t>...</w:t>{{ or }}...</w:t>...
 * This is hard to do reliably, so we skip and rely on mergeRunTexts +
 * user correctly placing tags in Word.
 */
function fixDocumentXml(xml) {
  let result = mergeRunTexts(xml);

  // Additional pass: collapse any remaining split {{ or }} across adjacent <w:t>
  // Pattern: text ending with '{' followed immediately (within same run or adjacent) by text starting with '{'
  // This handles cases like <w:t>{</w:t><w:t>{var}}</w:t>
  result = result.replace(
    /<\/w:t>((?:<\/w:r>)?(?:<w:r[^>]*>)?(?:<w:rPr>[\s\S]*?<\/w:rPr>)?(?:<w:t[^>]*>))\{/g,
    (match, between) => {
      // Only stitch if immediately adjacent (no complex content between)
      return '\u007b'; // Return just '{' — we handle in mergeRunTexts
    }
  );

  return result;
}

let anyFixed = false;

for (const t of templates) {
  const tp = path.join(TEMPLATE_DIR, t);
  if (!fs.existsSync(tp)) {
    console.log(`[SKIP]    ${t} — file not found`);
    continue;
  }

  const bin = fs.readFileSync(tp, 'binary');
  const zip = new PizZip(bin);
  const originalXml = zip.file('word/document.xml')?.asText() ?? '';

  // Apply fix
  const fixedXml = mergeRunTexts(originalXml);

  if (fixedXml === originalXml) {
    console.log(`[NOCHANGE] ${t} — no fragmented runs detected`);
    continue;
  }

  // Count how many runs were merged
  const origRunCount = (originalXml.match(/<w:t/g) || []).length;
  const fixedRunCount = (fixedXml.match(/<w:t/g) || []).length;
  const merged = origRunCount - fixedRunCount;

  // Save back
  zip.file('word/document.xml', fixedXml);
  const outputBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(tp, outputBuf);

  console.log(`[FIXED]   ${t} — merged ${merged} fragmented <w:t> elements`);
  anyFixed = true;
}

console.log('');
console.log(anyFixed ? '✅ Templates fixed. Re-run diagnose-templates.js to verify.' : '✅ No fixes needed.');
