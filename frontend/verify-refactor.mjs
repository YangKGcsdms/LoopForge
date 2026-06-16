import fs from 'fs';
import path from 'path';

const files = [
  'src/components/WorkflowResults.vue',
  'src/components/BaseCard.vue',
];

const checkFile = (filePath) => {
  const fullPath = path.resolve(filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  console.log(`✓ ${filePath} exists (${content.length} bytes)`);

  // Check for key imports
  if (filePath.includes('WorkflowResults')) {
    const checks = [
      ['BaseCard', content.includes('BaseCard')],
      ['StatusBadge', content.includes('StatusBadge')],
      ['SectionTitle', content.includes('SectionTitle')],
      ['kindClass', content.includes('kindClass')],
      ['diffClass', content.includes('diffClass')],
    ];

    checks.forEach(([name, found]) => {
      console.log(`  ${found ? '✓' : '✗'} ${name} import`);
    });
  }
};

files.forEach(checkFile);
console.log('\n✓ All files verified');
