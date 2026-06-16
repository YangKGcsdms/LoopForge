#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const componentsDir = './frontend/src/components';

console.log('=== Workflow Split Verification ===\n');

// Test 1: Check files exist
console.log('Test 1: Verify files exist');
const files = ['Workflow.vue', 'WorkflowForm.vue', 'WorkflowResults.vue'];
const allExist = files.every(f => fs.existsSync(path.join(componentsDir, f)));
console.log(`  ${allExist ? 'PASS' : 'FAIL'}: All component files exist\n`);

// Test 2: Check Workflow.vue structure
console.log('Test 2: Verify Workflow.vue structure');
const workflowContent = fs.readFileSync(path.join(componentsDir, 'Workflow.vue'), 'utf-8');
const checks = [
  ['imports WorkflowForm', workflowContent.includes('import WorkflowForm')],
  ['imports WorkflowResults', workflowContent.includes('import WorkflowResults')],
  ['uses useRun', workflowContent.includes('useRun')],
  ['has grid layout', workflowContent.includes('lg:grid-cols-2')],
  ['calls cleanup on unmount', workflowContent.includes('onUnmounted(runState.cleanup)')],
];
checks.forEach(([name, result]) => {
  console.log(`  ${result ? 'PASS' : 'FAIL'}: ${name}`);
});

// Test 3: Check WorkflowForm.vue
console.log('\nTest 3: Verify WorkflowForm.vue structure');
const formContent = fs.readFileSync(path.join(componentsDir, 'WorkflowForm.vue'), 'utf-8');
const formChecks = [
  ['accepts useRunState prop', formContent.includes('useRunState')],
  ['has provider select', formContent.includes('provider')],
  ['has requirement textarea', formContent.includes('requirement')],
  ['has goal input', formContent.includes('goal')],
  ['has dryRun checkbox', formContent.includes('dryRun')],
  ['has startRun method', formContent.includes('handleStartRun')],
  ['loads models on mount', formContent.includes('onMounted')],
];
formChecks.forEach(([name, result]) => {
  console.log(`  ${result ? 'PASS' : 'FAIL'}: ${name}`);
});

// Test 4: Check WorkflowResults.vue
console.log('\nTest 4: Verify WorkflowResults.vue structure');
const resultsContent = fs.readFileSync(path.join(componentsDir, 'WorkflowResults.vue'), 'utf-8');
const resultsChecks = [
  ['accepts useRunState prop', resultsContent.includes('useRunState')],
  ['displays difficulty', resultsContent.includes('difficulty.value')],
  ['displays routing', resultsContent.includes('routing.value')],
  ['renders todos', resultsContent.includes('live.value')],
  ['renders node cards', resultsContent.includes('nodeKind')],
  ['shows final done state', resultsContent.includes('finalDone.value')],
];
resultsChecks.forEach(([name, result]) => {
  console.log(`  ${result ? 'PASS' : 'FAIL'}: ${name}`);
});

// Test 5: Check test file
console.log('\nTest 5: Verify test file');
const testExists = fs.existsSync(path.join(componentsDir, '__tests__', 'Workflow.test.ts'));
console.log(`  ${testExists ? 'PASS' : 'FAIL'}: Test file exists`);

if (testExists) {
  const testContent = fs.readFileSync(path.join(componentsDir, '__tests__', 'Workflow.test.ts'), 'utf-8');
  const testChecks = [
    ['tests Workflow component', testContent.includes('Workflow')],
    ['tests WorkflowForm component', testContent.includes('WorkflowForm')],
    ['tests WorkflowResults component', testContent.includes('WorkflowResults')],
    ['tests useRun state', testContent.includes('useRun')],
  ];
  testChecks.forEach(([name, result]) => {
    console.log(`  ${result ? 'PASS' : 'FAIL'}: ${name}`);
  });
}

console.log('\n=== Summary ===');
const allPassed = allExist &&
  checks.every(c => c[1]) &&
  formChecks.every(c => c[1]) &&
  resultsChecks.every(c => c[1]) &&
  testExists;

console.log(`Overall: ${allPassed ? '✅ All tests passed' : '❌ Some tests failed'}`);
process.exit(allPassed ? 0 : 1);
