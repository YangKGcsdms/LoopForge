#!/usr/bin/env node
import { readFileSync } from 'fs';

const resultsFile = readFileSync('src/components/WorkflowResults.vue', 'utf-8');
const baseCardFile = readFileSync('src/components/BaseCard.vue', 'utf-8');

console.log('=== WorkflowResults.vue Checks ===');
const checks = [
  ['imports BaseCard', resultsFile.includes('import BaseCard from')],
  ['imports StatusBadge', resultsFile.includes('import StatusBadge from')],
  ['imports SectionTitle', resultsFile.includes('import SectionTitle from')],
  ['uses BaseCard for main container', resultsFile.includes('<BaseCard')],
  ['uses SectionTitle for header', resultsFile.includes('<SectionTitle')],
  ['uses StatusBadge for node status', resultsFile.includes('<StatusBadge')],
  ['has difficulty section', resultsFile.includes('难度指标')],
  ['has routing section', resultsFile.includes('路由方案')],
  ['has phase divider', resultsFile.includes("item.kind === 'phase'")],
  ['has TODO list card', resultsFile.includes("item.kind === 'todos'")],
  ['has node card', resultsFile.includes("<!-- 节点卡片")],
  ['has final done card', resultsFile.includes('finalDone.value')],
  ['uses kindClass for node type', resultsFile.includes('kindClass')],
  ['uses diffClass for difficulty', resultsFile.includes('diffClass')],
  ['typing effect preserved', resultsFile.includes('animate-pulse')],
];

checks.forEach(([name, result]) => {
  console.log(`${result ? '✓' : '✗'} ${name}`);
});

console.log('\n=== BaseCard.vue Checks ===');
const cardChecks = [
  ['supports $attrs.class', baseCardFile.includes('$attrs.class')],
  ['has tone="info"', baseCardFile.includes("'info'")],
  ['has tone="success"', baseCardFile.includes("'success'")],
];

cardChecks.forEach(([name, result]) => {
  console.log(`${result ? '✓' : '✗'} ${name}`);
});

const allPass = [...checks, ...cardChecks].every(([_, result]) => result);
console.log(allPass ? '\n✓ All checks passed!' : '\n✗ Some checks failed');
process.exit(allPass ? 0 : 1);
