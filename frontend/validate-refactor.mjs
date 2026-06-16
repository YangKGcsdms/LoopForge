#!/usr/bin/env node
/**
 * 验证 WorkflowResults 重构的关键指标
 */
import { readFileSync } from 'fs';

const wfResults = readFileSync('src/components/WorkflowResults.vue', 'utf-8');

const validations = [
  // 基础组件使用
  {
    name: '使用 BaseCard 包装整个结果区',
    check: () => wfResults.match(/<BaseCard[^>]*variant="default"[^>]*size="lg"/) !== null,
  },
  {
    name: '使用 SectionTitle 显示标题',
    check: () => wfResults.includes('<SectionTitle'),
  },
  {
    name: '使用 StatusBadge 显示节点状态',
    check: () => wfResults.includes('<StatusBadge'),
  },

  // 布局和留白
  {
    name: '难度区有 mb-6 间距',
    check: () => wfResults.includes('class="mb-6"') && wfResults.includes('难度指标'),
  },
  {
    name: '路由方案使用栅栏布局',
    check: () => wfResults.includes('grid gap-3 sm:grid-cols-2'),
  },
  {
    name: '动态内容流有 space-y-4 间距',
    check: () => wfResults.includes('class="space-y-4"'),
  },

  // 节点元素
  {
    name: '难度徽章使用 diffClass',
    check: () => wfResults.includes('diffClass(props.useRunState.difficulty.value.value)'),
  },
  {
    name: '节点类型徽章使用 kindClass',
    check: () => wfResults.includes('kindClass((item as any).nodeKind)'),
  },
  {
    name: '节点卡片包含打字机效果',
    check: () => wfResults.includes('animate-pulse') && wfResults.includes('▋'),
  },

  // 内容保留
  {
    name: '保留了 TODO ID（S1、S2等）',
    check: () => wfResults.includes('{{ s.id }}'),
  },
  {
    name: '保留了 TODO 标题',
    check: () => wfResults.includes('{{ s.title }}'),
  },
  {
    name: '保留了工时估计',
    check: () => wfResults.includes('{{ s.estimateHours }}h'),
  },
  {
    name: '保留了 TODO 验收标准',
    check: () => wfResults.includes('{{ s.acceptance }}'),
  },
  {
    name: '保留了节点 ID',
    check: () => wfResults.includes('{{ (item as any).id }}'),
  },
  {
    name: '保留了节点类型',
    check: () => wfResults.includes('{{ (item as any).nodeKind }}'),
  },
  {
    name: '保留了迭代次数',
    check: () => wfResults.includes('第 {{ (item as any).iteration }} 轮'),
  },
  {
    name: '保留了节点输出',
    check: () => wfResults.includes('{{ (item as any).typed }}'),
  },
  {
    name: '保留了最终完成信息',
    check: () => wfResults.includes('finalDone.value'),
  },

  // 设计原则
  {
    name: '使用 rounded-sm 和 rounded-md（遵循设计 token）',
    check: () => wfResults.includes('rounded-sm') || wfResults.includes('rounded-md'),
  },
  {
    name: '使用 font-mono 用于代码和 ID',
    check: () => wfResults.includes('font-mono'),
  },
  {
    name: '颜色使用设计 token（slate、emerald、sky等）',
    check: () => (
      wfResults.includes('text-slate') ||
      wfResults.includes('bg-slate') ||
      wfResults.includes('text-emerald')
    ),
  },
];

let passed = 0;
let failed = 0;

console.log('=== WorkflowResults 重构验证 ===\n');

validations.forEach(({ name, check }) => {
  const result = check();
  const symbol = result ? '✓' : '✗';
  console.log(`${symbol} ${name}`);
  if (result) passed++;
  else failed++;
});

console.log(`\n结果: ${passed}/${validations.length} 通过`);

if (failed === 0) {
  console.log('\n✓ 重构验证成功！所有关键指标都满足。');
  process.exit(0);
} else {
  console.log(`\n✗ 有 ${failed} 个问题需要修复`);
  process.exit(1);
}
