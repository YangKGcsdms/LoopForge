#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('=== Workflow 拆分验证 ===\n');

const componentsDir = './src/components';

// 检查文件是否存在
const requiredFiles = [
  'Workflow.vue',
  'WorkflowForm.vue',
  'WorkflowResults.vue',
];

console.log('1️⃣  检查文件是否存在：');
let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(componentsDir, file);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
}

if (!allFilesExist) {
  console.error('\n❌ 某些文件不存在');
  process.exit(1);
}

console.log('\n2️⃣  检查文件内容结构：');

// 检查 Workflow.vue
const workflowContent = fs.readFileSync(path.join(componentsDir, 'Workflow.vue'), 'utf-8');
const hasWorkflowForm = workflowContent.includes('WorkflowForm');
const hasWorkflowResults = workflowContent.includes('WorkflowResults');
const hasGridLayout = workflowContent.includes('lg:grid-cols-2');
console.log(`  ${hasWorkflowForm ? '✓' : '✗'} Workflow.vue 导入 WorkflowForm`);
console.log(`  ${hasWorkflowResults ? '✓' : '✗'} Workflow.vue 导入 WorkflowResults`);
console.log(`  ${hasGridLayout ? '✓' : '✗'} Workflow.vue 有两列网格布局`);

// 检查 WorkflowForm.vue
const formContent = fs.readFileSync(path.join(componentsDir, 'WorkflowForm.vue'), 'utf-8');
const hasProviderSelect = formContent.includes('provider');
const hasRequirementInput = formContent.includes('requirement');
const hasGoalInput = formContent.includes('goal');
const hasDryRunCheckbox = formContent.includes('dryRun');
const hasStartRunMethod = formContent.includes('handleStartRun');
console.log(`  ${hasProviderSelect ? '✓' : '✗'} WorkflowForm.vue 有 provider 选择器`);
console.log(`  ${hasRequirementInput ? '✓' : '✗'} WorkflowForm.vue 有 requirement 输入`);
console.log(`  ${hasGoalInput ? '✓' : '✗'} WorkflowForm.vue 有 goal 输入`);
console.log(`  ${hasDryRunCheckbox ? '✓' : '✗'} WorkflowForm.vue 有 dryRun checkbox`);
console.log(`  ${hasStartRunMethod ? '✓' : '✗'} WorkflowForm.vue 有 handleStartRun 方法`);

// 检查 WorkflowResults.vue
const resultsContent = fs.readFileSync(path.join(componentsDir, 'WorkflowResults.vue'), 'utf-8');
const hasDifficulty = resultsContent.includes('difficulty');
const hasRouting = resultsContent.includes('routing');
const hasTodos = resultsContent.includes('todos');
const hasNodeRendering = resultsContent.includes('nodeKind');
const hasFinalDone = resultsContent.includes('finalDone');
console.log(`  ${hasDifficulty ? '✓' : '✗'} WorkflowResults.vue 显示 difficulty`);
console.log(`  ${hasRouting ? '✓' : '✗'} WorkflowResults.vue 显示 routing`);
console.log(`  ${hasTodos ? '✓' : '✗'} WorkflowResults.vue 显示 todos`);
console.log(`  ${hasNodeRendering ? '✓' : '✗'} WorkflowResults.vue 渲染节点卡片`);
console.log(`  ${hasFinalDone ? '✓' : '✗'} WorkflowResults.vue 显示最终完成状态`);

console.log('\n3️⃣  检查 useRun 的使用：');
const formHasUseRunProps = formContent.includes('useRunState');
const resultsHasUseRunProps = resultsContent.includes('useRunState');
const workflowHasUseRun = workflowContent.includes('useRun');
console.log(`  ${formHasUseRunProps ? '✓' : '✗'} WorkflowForm 消费 useRunState prop`);
console.log(`  ${resultsHasUseRunProps ? '✓' : '✗'} WorkflowResults 消费 useRunState prop`);
console.log(`  ${workflowHasUseRun ? '✓' : '✗'} Workflow 调用 useRun()`);

console.log('\n4️⃣  检查导入和导出：');
const formImports = formContent.includes('import');
const resultsImports = resultsContent.includes('import');
const workflowImports = workflowContent.includes('import');
console.log(`  ${formImports ? '✓' : '✗'} WorkflowForm 有必要的导入`);
console.log(`  ${resultsImports ? '✓' : '✗'} WorkflowResults 有必要的导入`);
console.log(`  ${workflowImports ? '✓' : '✗'} Workflow 有必要的导入`);

console.log('\n5️⃣  检查生命周期钩子：');
const workflowHasCleanup = workflowContent.includes('cleanup');
const workflowHasOnUnmounted = workflowContent.includes('onUnmounted');
console.log(`  ${workflowHasCleanup ? '✓' : '✗'} Workflow 调用 cleanup`);
console.log(`  ${workflowHasOnUnmounted ? '✓' : '✗'} Workflow 使用 onUnmounted`);

const allChecksPassed =
  allFilesExist && hasWorkflowForm && hasWorkflowResults && hasGridLayout &&
  hasProviderSelect && hasRequirementInput && hasGoalInput && hasDryRunCheckbox &&
  hasDifficulty && hasRouting && hasTodos && hasNodeRendering &&
  formHasUseRunProps && resultsHasUseRunProps && workflowHasUseRun &&
  workflowHasCleanup && workflowHasOnUnmounted;

console.log('\n' + (allChecksPassed ? '✅ 所有检查通过' : '❌ 某些检查未通过'));
process.exit(allChecksPassed ? 0 : 1);
