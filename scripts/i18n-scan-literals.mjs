/**
 * i18n DISCOVERY scan — find user-visible text still hardcoded in TSX.
 *
 * The three lints (`i18n-chrome-lint`, `i18n-groupkey-lint`, `i18n-catalog`) all verify strings that
 * are ALREADY in the system. Nothing points at the ones that never entered it, so untranslated text
 * has been surfacing by eyeball, one file at a time. This walks the TS AST for the two shapes that
 * actually reach a user:
 *
 *   1. JSX TEXT   — `<Typography>Some words</Typography>`
 *   2. JSX PROPS  — `label="Some words"` for a curated set of display-only attributes
 *
 * Reported literals are candidates, not certainties: a scan cannot know that `label="dense"` is a
 * variant token. Keep it advisory (a checklist to work through), not a gate.
 *
 * Usage: node scripts/i18n-scan-literals.mjs [pkg ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const DEFAULT_PACKAGES = [
  'utils-react', 'utils-mui', 'grid-react', 'react',
  'scripting-react', 'scripting-mui', 'studio-mui'
];
const args = process.argv.slice(2);
const packages = args.filter((a) => !a.startsWith('--'));

/** Attributes whose string value is rendered to a user. */
const DISPLAY_ATTRS = new Set([
  'label', 'title', 'placeholder', 'description', 'tooltip', 'helperText',
  'alt', 'aria-label', 'selectAllLabel', 'summary', 'secondaryLabel', 'emptyText'
]);

/**
 * Attribute values that are display-shaped but are really API tokens. Keeping this list tiny and
 * literal beats a clever heuristic — a false negative here is a missed translation.
 */
const NOT_TEXT = new Set([
  'inherit', 'none', 'auto', 'small', 'medium', 'large', 'dense', 'normal', 'primary', 'secondary',
  'left', 'right', 'top', 'bottom', 'center', 'start', 'end', 'row', 'column', 'div', 'span', 'button'
]);

/** Text worth translating: contains at least two consecutive letters. */
const isProse = (s) => /[A-Za-z]{2}/.test(s);

function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/^(__tests__|__mocks__|node_modules|dist|build)$/.test(e.name)) continue;
      collect(full, out);
    } else if (/\.tsx$/.test(e.name) && !/\.(test|spec|stories)\./.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

let totalText = 0;
let totalAttr = 0;
for (const pkg of packages.length ? packages : DEFAULT_PACKAGES) {
  const srcDir = path.join(repoRoot, 'packages', pkg, 'src');
  if (!fs.existsSync(srcDir)) continue;
  const findings = [];

  for (const file of collect(srcDir)) {
    const src = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

    const visit = (node) => {
      if (ts.isJsxText(node)) {
        const text = node.text.trim();
        if (text && isProse(text)) findings.push({ kind: 'TEXT', line: lineOf(node), text });
      } else if (ts.isJsxAttribute(node) && node.initializer) {
        const name = node.name.getText(sf);
        if (DISPLAY_ATTRS.has(name)) {
          // `label="x"` and `label={"x"}` are the same thing to a reader.
          let lit;
          if (ts.isStringLiteral(node.initializer)) lit = node.initializer.text;
          else if (ts.isJsxExpression(node.initializer) && node.initializer.expression &&
                   (ts.isStringLiteral(node.initializer.expression) ||
                    ts.isNoSubstitutionTemplateLiteral(node.initializer.expression))) {
            lit = node.initializer.expression.text;
          }
          if (lit && isProse(lit) && !NOT_TEXT.has(lit.toLowerCase())) {
            findings.push({ kind: 'ATTR', line: lineOf(node), text: `${name}="${lit}"` });
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);

    if (findings.length) {
      const byFile = findings.splice(0, findings.length);
      console.log(`\n${rel}`);
      for (const f of byFile.sort((a, b) => a.line - b.line)) {
        console.log(`  ${String(f.line).padStart(5)}  ${f.kind}  ${f.text.replace(/\s+/g, ' ').slice(0, 100)}`);
        if (f.kind === 'TEXT') totalText++; else totalAttr++;
      }
    }
  }
}
console.log(`\n${totalText} JSX text node(s), ${totalAttr} display attribute(s) still hardcoded.`);
