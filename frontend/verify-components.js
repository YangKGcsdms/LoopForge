#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const componentsDir = './src/components';

console.log('=== 基础组件验证 ===\n');

// 检查所有必需的文件
const requiredFiles = [
  'BaseButton.vue',
  'BaseInput.vue',
  'BaseCard.vue',
  'BaseSelect.vue',
  'StatusBadge.vue',
  'SectionTitle.vue',
  'BaseComponentShowcase.vue',
  '__tests__/BaseButton.test.ts',
  '__tests__/BaseInput.test.ts',
  '__tests__/BaseCard.test.ts',
  '__tests__/BaseSelect.test.ts',
  '__tests__/StatusBadge.test.ts',
  '__tests__/SectionTitle.test.ts'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  const fullPath = path.join(componentsDir, file);
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✓' : '✗'} ${file}`);
  if (!exists) allFilesExist = false;
});

if (!allFilesExist) {
  console.error('\n❌ 有文件缺失！');
  process.exit(1);
}

console.log('\n✓ 所有文件都存在');

// 检查 SkConfig.vue 和 Workflow.vue 的导入
console.log('\n=== 导入检查 ===\n');

const skConfigContent = fs.readFileSync('./src/components/SkConfig.vue', 'utf-8');
const workflowContent = fs.readFileSync('./src/components/Workflow.vue', 'utf-8');

const checks = [
  { file: 'SkConfig.vue', content: skConfigContent, imports: ['BaseButton', 'BaseInput', 'BaseCard', 'BaseSelect'] },
  { file: 'Workflow.vue', content: workflowContent, imports: ['BaseButton', 'BaseInput', 'BaseCard', 'BaseSelect'] }
];

checks.forEach(({ file, content, imports }) => {
  console.log(`${file}:`);
  imports.forEach(imp => {
    const hasImport = content.includes(`import ${imp}`);
    const hasUsage = content.includes(`<${imp}`);
    console.log(`  ${hasImport && hasUsage ? '✓' : '✗'} ${imp}`);
  });
});

// 检查组件属性
console.log('\n=== 组件属性检查 ===\n');

const baseButtonContent = fs.readFileSync('./src/components/BaseButton.vue', 'utf-8');
const baseInputContent = fs.readFileSync('./src/components/BaseInput.vue', 'utf-8');
const baseCardContent = fs.readFileSync('./src/components/BaseCard.vue', 'utf-8');
const baseSelectContent = fs.readFileSync('./src/components/BaseSelect.vue', 'utf-8');
const statusBadgeContent = fs.readFileSync('./src/components/StatusBadge.vue', 'utf-8');
const sectionTitleContent = fs.readFileSync('./src/components/SectionTitle.vue', 'utf-8');

const props = {
  'BaseButton': ['variant', 'size', 'disabled', 'fullWidth', 'type'],
  'BaseInput': ['type', 'variant', 'size', 'disabled', 'error', 'fullWidth', 'placeholder', 'modelValue'],
  'BaseCard': ['variant', 'size', 'tone', 'interactive'],
  'BaseSelect': ['modelValue', 'disabled', 'fullWidth', 'size'],
  'StatusBadge': ['status', 'label', 'disabled', 'compact'],
  'SectionTitle': ['title', 'level', 'description', 'divider', 'dividerColor', 'spacing', 'disabled']
};

console.log('BaseButton props:');
props['BaseButton'].forEach(p => {
  const has = baseButtonContent.includes(`${p}`) || baseButtonContent.includes(`"${p}"`);
  console.log(`  ${has ? '✓' : '✗'} ${p}`);
});

console.log('\nBaseInput props:');
props['BaseInput'].forEach(p => {
  const has = baseInputContent.includes(`${p}`) || baseInputContent.includes(`"${p}"`);
  console.log(`  ${has ? '✓' : '✗'} ${p}`);
});

console.log('\nBaseCard props:');
props['BaseCard'].forEach(p => {
  const has = baseCardContent.includes(`${p}`) || baseCardContent.includes(`"${p}"`);
  console.log(`  ${has ? '✓' : '✗'} ${p}`);
});

console.log('\nBaseSelect props:');
props['BaseSelect'].forEach(p => {
  const has = baseSelectContent.includes(`${p}`) || baseSelectContent.includes(`"${p}"`);
  console.log(`  ${has ? '✓' : '✗'} ${p}`);
});

console.log('\nStatusBadge props:');
props['StatusBadge'].forEach(p => {
  const has = statusBadgeContent.includes(`${p}`) || statusBadgeContent.includes(`"${p}"`);
  console.log(`  ${has ? '✓' : '✗'} ${p}`);
});

console.log('\nSectionTitle props:');
props['SectionTitle'].forEach(p => {
  const has = sectionTitleContent.includes(`${p}`) || sectionTitleContent.includes(`"${p}"`);
  console.log(`  ${has ? '✓' : '✗'} ${p}`);
});

// 检查焦点环
console.log('\n=== 焦点环检查（统一为 ring-2/offset-2） ===\n');

const focusRingChecks = [
  { name: 'BaseButton', content: baseButtonContent, pattern: 'focus:ring-2', offsetPattern: 'focus:ring-offset-2' },
  { name: 'BaseInput', content: baseInputContent, pattern: 'focus:ring-2', offsetPattern: 'focus:ring-offset-2' },
  { name: 'BaseSelect', content: baseSelectContent, pattern: 'focus:ring-2', offsetPattern: 'focus:ring-offset-2' }
];

focusRingChecks.forEach(({ name, content, pattern, offsetPattern }) => {
  const hasRing = content.includes(pattern);
  const hasOffset = content.includes(offsetPattern);
  console.log(`${hasRing && hasOffset ? '✓' : '✗'} ${name}: ${pattern} + ${offsetPattern}`);
});

// 检查 Workflow.vue 中是否用了 BaseCard 替换了原生 section 标签
console.log('\n=== Workflow.vue 替换检查 ===\n');

const baseCardInWorkflow = workflowContent.match(/<BaseCard/g);
const nativeSectionCount = workflowContent.match(/<section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">/g);

console.log(`BaseCard 使用次数: ${baseCardInWorkflow ? baseCardInWorkflow.length : 0}`);
console.log(`原生 section 标签（特定类）: ${nativeSectionCount ? nativeSectionCount.length : 0}`);

if (!nativeSectionCount || nativeSectionCount.length === 0) {
  console.log('✓ 所有原生 section 标签已替换为 BaseCard');
} else {
  console.log(`✗ 仍有 ${nativeSectionCount.length} 个原生 section 标签未替换`);
}

// 检查状态语义和交互态
console.log('\n=== StatusBadge 语义检查 ===\n');

const statusTypes = ['running', 'completed', 'error', 'pending', 'idle'];
let allStatusesPresent = true;
statusTypes.forEach(status => {
  const hasStatus = statusBadgeContent.includes(`"${status}"`) || statusBadgeContent.includes(`'${status}'`);
  console.log(`  ${hasStatus ? '✓' : '✗'} ${status} status`);
  if (!hasStatus) allStatusesPresent = false;
});

const hasSemanticColors = statusBadgeContent.includes('bg-sky-100') &&
                           statusBadgeContent.includes('bg-emerald-100') &&
                           statusBadgeContent.includes('bg-rose-100');
console.log(`  ${hasSemanticColors ? '✓' : '✗'} 语义色彩映射`);

const hasDisabledState = statusBadgeContent.includes('disabled') && statusBadgeContent.includes('opacity-60');
console.log(`  ${hasDisabledState ? '✓' : '✗'} disabled 状态`);

// 检查 SectionTitle 标题层级
console.log('\n=== SectionTitle 标题层级检查 ===\n');

const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
let allHeadingsPresent = true;
headingLevels.forEach(level => {
  const hasLevel = sectionTitleContent.includes(`'${level}'`) || sectionTitleContent.includes(`"${level}"`);
  console.log(`  ${hasLevel ? '✓' : '✗'} ${level}`);
  if (!hasLevel) allHeadingsPresent = false;
});

const hasUnifiedSpacing = sectionTitleContent.includes('spacing') && sectionTitleContent.includes('divider');
console.log(`  ${hasUnifiedSpacing ? '✓' : '✗'} 统一间距和分隔线`);

console.log('\n✅ 组件验证完成！');
