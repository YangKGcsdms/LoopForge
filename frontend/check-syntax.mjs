#!/usr/bin/env node
import fs from 'fs';

const files = [
  'src/components/WorkflowResults.vue',
  'src/components/BaseCard.vue',
];

let errors = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');

  // Check for balanced tags
  const openDiv = (content.match(/<div/g) || []).length;
  const closeDiv = (content.match(/<\/div>/g) || []).length;
  if (openDiv !== closeDiv) {
    errors.push(`${file}: div tags unbalanced (${openDiv} open, ${closeDiv} close)`);
  }

  // Check for required imports
  if (file.includes('WorkflowResults')) {
    if (!content.includes('import BaseCard')) errors.push(`${file}: missing BaseCard import`);
    if (!content.includes('import StatusBadge')) errors.push(`${file}: missing StatusBadge import`);
    if (!content.includes('import SectionTitle')) errors.push(`${file}: missing SectionTitle import`);
  }

  console.log(`✓ ${file}: ${content.length} bytes`);
});

if (errors.length) {
  console.error('\nErrors found:');
  errors.forEach(e => console.error(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log('\n✓ All syntax checks passed');
  process.exit(0);
}
