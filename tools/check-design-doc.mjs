#!/usr/bin/env node
/**
 * Structural checker for DESIGN_DOC.md.
 *
 * The document states counts ("seven performance indexes", "fifteen in all"),
 * cites decisions (D-0NN) and sections (16.NN), and pairs them ("(D-078,
 * §16.45)"). Each of those is a fact that drifts when a later decision adds a
 * value or a section. This script derives each fact from the text and compares
 * it with the claim, so drift fails loudly instead of being found one instance
 * at a time.
 *
 * Usage: node tools/check-design-doc.mjs [path]
 * Exit code 1 if any check fails.
 */

import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'DESIGN_DOC.md';
const doc = readFileSync(path, 'utf8');
const lines = doc.split('\n');

const problems = [];
const facts = [];
const fail = (line, msg) => problems.push(`${path}:${line + 1}: ${msg}`);

const WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20,
};
const num = (w) => WORDS[String(w).toLowerCase()] ?? Number(w);
const isCountWord = (w) => Number.isFinite(num(w));

const backticked = (text) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);

function region(startRe, endRe) {
  const from = lines.findIndex((l) => startRe.test(l));
  if (from < 0) return null;
  let to = lines.findIndex((l, i) => i > from && endRe.test(l));
  if (to < 0) to = lines.length;
  return { from, to, text: lines.slice(from, to).join('\n') };
}

// ---------------------------------------------------------------------------
// 1. Headings
// ---------------------------------------------------------------------------

const sections = new Map(); // "16.45" -> line
const seenHeadings = new Map();

lines.forEach((line, i) => {
  const m = /^(#{1,4})\s+(\d+(?:\.\d+)*)\.?\s+(.*)$/.exec(line);
  if (!m) return;
  const [, hashes, number, title] = m;
  const key = `${hashes} ${title}`;
  if (seenHeadings.has(key)) {
    fail(i, `duplicate heading "${title.trim()}" (also line ${seenHeadings.get(key) + 1})`);
  }
  seenHeadings.set(key, i);
  if (number.includes('.')) sections.set(number, i);
});

// §16 is append-only: its section numbers must strictly increase.
const appendix = [...sections.entries()]
  .filter(([n]) => n.startsWith('16.'))
  .sort((a, b) => a[1] - b[1])
  .map(([n, line]) => ({ n, line, value: Number(n.split('.')[1]) }));
for (let i = 1; i < appendix.length; i++) {
  if (appendix[i].value <= appendix[i - 1].value) {
    fail(appendix[i].line, `§${appendix[i].n} follows §${appendix[i - 1].n}; §16 is append-only`);
  }
}
facts.push(`§16 sections: 16.1 … 16.${appendix.at(-1)?.value}`);

const sectionExists = (ref) => {
  if (sections.has(ref)) return true;
  const parts = ref.split('.');
  for (let n = parts.length - 1; n >= 2; n--) {
    if (sections.has(parts.slice(0, n).join('.'))) return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// 2. Decisions
// ---------------------------------------------------------------------------

const decisionHome = new Map(); // "D-078" -> "16.45"
let currentSection = null;

lines.forEach((line, i) => {
  const h = /^#{1,4}\s+(\d+(?:\.\d+)*)\.?\s+/.exec(line);
  if (h) currentSection = h[1];
  const d = /\*\*Confirmed decision \((D-\d{3})\)/.exec(line);
  if (d && currentSection) {
    if (decisionHome.has(d[1]) && decisionHome.get(d[1]) !== currentSection) {
      fail(i, `${d[1]} is defined twice (${decisionHome.get(d[1])} and ${currentSection})`);
    }
    decisionHome.set(d[1], currentSection);
  }
});

// A decision also counts as defined when the register (§12) or the backlog (§17)
// names it, so those citations are not reported as orphaned.
const registerRegion = region(/^## 12\. /, /^## 13\. /);
const backlogRegion = region(/^# 17\. /, /$^/);
const definedDecisions = new Set(decisionHome.keys());
for (const source of [registerRegion, backlogRegion]) {
  if (!source) continue;
  for (const m of source.text.matchAll(/\bD-\d{3}\b/g)) definedDecisions.add(m[0]);
}

lines.forEach((line, i) => {
  for (const m of line.matchAll(/\bD-(\d{3})\b/g)) {
    const id = `D-${m[1]}`;
    if (!definedDecisions.has(id)) fail(i, `${id} is cited but never defined`);
  }
});

// A pair is wrong when it points at a section that both defines a different
// decision and never mentions the one cited — a genuine mis-citation rather
// than an "amended at" cross-reference.
const pairRe = /(D-\d{3})\s*,?\s*(§\d+(?:\.\d+)+)|(§\d+(?:\.\d+)+)\s*,?\s*(D-\d{3})/g;
const sectionText = new Map();
for (const [ref, line] of sections) {
  const next = Math.min(
    ...[...sections.values()].filter((l) => l > line).concat([lines.length]),
  );
  sectionText.set(ref, lines.slice(line, next).join('\n'));
}
lines.forEach((line, i) => {
  for (const m of line.matchAll(pairRe)) {
    const id = m[1] ?? m[4];
    const ref = (m[2] ?? m[3]).replace('§', '');
    const home = decisionHome.get(id);
    const owner = decisionHome.get(ref);
    if (home && owner && owner !== id && !sectionText.get(ref)?.includes(id)) {
      fail(i, `${id} is paired with §${ref}, which defines ${owner} and never mentions ${id}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 3. Section citations resolve
// ---------------------------------------------------------------------------

lines.forEach((line, i) => {
  for (const m of line.matchAll(/§(\d+(?:\.\d+)+)/g)) {
    if (!sectionExists(m[1])) fail(i, `§${m[1]} is cited but has no heading`);
  }
});

// ---------------------------------------------------------------------------
// 4. Enumerated sets
// ---------------------------------------------------------------------------

/**
 * Every "N <noun>" claim must match the derived size. Historical phrasing
 * ("from five … to seven", "either … or") is skipped: it describes a change
 * rather than the current state.
 */
function checkClaim(nounPattern, actual, label) {
  const re = new RegExp(`\\b([A-Za-z]+|\\d+)\\s+${nounPattern}`, 'gi');
  lines.forEach((line, i) => {
    if (/from \w+ (performance indexes|uniqueness)/i.test(line)) return;
    for (const m of line.matchAll(re)) {
      if (!isCountWord(m[1])) continue;
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 12);
      if (/^\s*to\s+(\w+|\d+)/i.test(after)) continue;
      if (num(m[1]) !== actual) {
        fail(i, `${label}: text says "${m[0]}" but the document enumerates ${actual}`);
      }
    }
  });
  facts.push(`${label}: ${actual}`);
}

// Action vocabulary (§16.34 rule 8).
const vocab = region(/A fixed action vocabulary\./, /^\*\*The shapes\.\*\*/);
if (vocab) {
  const values = new Set(backticked(vocab.text).filter((v) => /^[a-z_]+$/.test(v)));
  checkClaim('action vocabulary|in all \\(§16\\.34 rule 8\\)', values.size, 'audit action values');

  lines.forEach((line, i) => {
    const m = /`action` in D-067's (\w+)[^.]*?plus ([^—;]*?)—\s*(\w+) in all/.exec(line);
    if (!m) return;
    const base = num(m[1]);
    const added = backticked(m[2]).length;
    const total = num(m[3]);
    if (base + added !== total || total !== values.size) {
      fail(i, `audit action arithmetic: ${base} + ${added} = ${base + added}, text says ${total}, list has ${values.size}`);
    }
  });
}

// entity_type (§16.34 rule 2).
const entityType = /`entityType` is one of ([^.]*)\./.exec(doc);
if (entityType) {
  const values = backticked(entityType[1]).filter((v) => /^[a-z_]+$/.test(v));
  const line = doc.slice(0, entityType.index).split('\n').length - 1;
  lines.forEach((l, i) => {
    // only the count attached to entity_type, not the action list on the same line
    const claim = /entity_?[Tt]ype[^.]{0,60}?D-067's (\w+)/.exec(l);
    if (claim && isCountWord(claim[1]) && num(claim[1]) !== values.length) {
      fail(i, `entity_type: text says D-067's ${claim[1]} but the list has ${values.length}`);
    }
  });
  facts.push(`entity types: ${values.length}`);
}

// Notification types (§16.35).
const notif = region(/^## 16\.35 /, /^## 16\.36 /);
if (notif) {
  const types = new Set([...notif.text.matchAll(/`([A-Z][A-Z_]{3,})`/g)].map((m) => m[1]));
  checkClaim('notification types|fixed types', types.size, 'notification types');
  for (const m of doc.matchAll(/D-068's (\w+)/g)) {
    if (isCountWord(m[1]) && num(m[1]) !== types.size) {
      fail(0, `notification types: text says D-068's ${m[1]} but §16.35 lists ${types.size}`);
    }
  }
}

// Index inventory (§16.36 rule 10).
const inventory = region(/\| Index or constraint \| Serves \|/, /^$/);
if (inventory) {
  const rows = inventory.text.split('\n').filter((l) => l.startsWith('| `'));
  const unique = rows.filter((l) => /\*\*unique/.test(l)).length;
  const perf = rows.length - unique;
  checkClaim('performance indexes', perf, 'performance indexes');
  checkClaim('uniqueness rules', unique, 'uniqueness rules');
  facts.push(`inventory rows: ${rows.length} (${perf} performance, ${unique} uniqueness)`);
}

// Unauthenticated routes (§16.23 rule 1, first sentence only — the amendment
// below it names the route that was replaced).
const rule1 = lines.find((l) => /One credential type, one header/.test(l));
if (rule1) {
  const firstSentence = rule1.split('**Amended')[0];
  const routes = new Set([...firstSentence.matchAll(/`POST (\/v1\/auth\/[a-z-]+)`/g)].map((m) => m[1]));
  for (const m of doc.matchAll(/the (\w+) unauthenticated routes?/gi)) {
    if (isCountWord(m[1]) && num(m[1]) !== routes.size) {
      fail(0, `unauthenticated routes: text says "${m[1]}" but rule 1 names ${routes.size} (${[...routes].join(', ')})`);
    }
  }
  facts.push(`unauthenticated routes: ${routes.size} (${[...routes].join(', ')})`);
}

// ---------------------------------------------------------------------------
// 5. Mechanical checks
// ---------------------------------------------------------------------------

const fenceCount = lines.filter((l) => l.startsWith('```')).length;
if (fenceCount % 2 !== 0) fail(0, `odd number of code fences (${fenceCount})`);
facts.push(`code fences: ${fenceCount}`);

let tableCells = null;
lines.forEach((line, i) => {
  if (!line.startsWith('|')) { tableCells = null; return; }
  const cells = line.replace(/\\\|/g, '').split('|').length - 2;
  if (tableCells === null) tableCells = cells;
  else if (cells !== tableCells) {
    fail(i, `table row has ${cells} cells, table header has ${tableCells}`);
  }
});
facts.push('table cell counts: checked');

const maxD = Math.max(...[...definedDecisions].map((d) => Number(d.slice(2))));
const missing = [];
for (let n = 35; n <= maxD; n++) {
  const id = `D-${String(n).padStart(3, '0')}`;
  if (!definedDecisions.has(id)) missing.push(id);
}
if (missing.length) fail(0, `decision ids missing from the sequence: ${missing.join(', ')}`);
facts.push(`decision ids: D-035 … D-${String(maxD).padStart(3, '0')}`);

// ---------------------------------------------------------------------------

console.log('— derived facts');
for (const f of facts) console.log(`  ${f}`);
console.log(`\n— problems (${problems.length})`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
