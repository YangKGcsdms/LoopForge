#!/usr/bin/env node
import { createApp } from 'vue';
import BaseCard from './src/components/BaseCard.vue';
import BaseButton from './src/components/BaseButton.vue';
import BaseInput from './src/components/BaseInput.vue';
import BaseSelect from './src/components/BaseSelect.vue';

console.log('=== 组件挂载验证 ===\n');

// 验证所有组件都可以被正确导入
const components = [
  { name: 'BaseCard', component: BaseCard },
  { name: 'BaseButton', component: BaseButton },
  { name: 'BaseInput', component: BaseInput },
  { name: 'BaseSelect', component: BaseSelect }
];

let allPassed = true;

components.forEach(({ name, component }) => {
  if (component && component.__name) {
    console.log(`✓ ${name} - 正确导入`);
  } else {
    console.log(`✗ ${name} - 导入失败`);
    allPassed = false;
  }
});

// 验证 props 接口
console.log('\n=== Props 接口检查 ===\n');

const propChecks = [
  { name: 'BaseCard', props: ['variant', 'size', 'tone', 'interactive'] },
  { name: 'BaseButton', props: ['variant', 'size', 'disabled', 'fullWidth', 'type'] },
  { name: 'BaseInput', props: ['type', 'variant', 'size', 'disabled', 'error', 'fullWidth', 'placeholder', 'modelValue'] },
  { name: 'BaseSelect', props: ['modelValue', 'disabled', 'fullWidth', 'size'] }
];

propChecks.forEach(({ name, props }) => {
  const component = components.find(c => c.name === name).component;
  if (component && component.props) {
    const hasProps = props.every(p => p in component.props);
    console.log(`${hasProps ? '✓' : '✗'} ${name}: ${props.join(', ')}`);
  } else {
    console.log(`✗ ${name}: 无法读取 props`);
  }
});

// 验证 emits
console.log('\n=== Emits 检查 ===\n');

const emitChecks = [
  { name: 'BaseButton', emits: ['click'] },
  { name: 'BaseInput', emits: ['update:modelValue', 'input', 'change', 'focus', 'blur'] },
  { name: 'BaseSelect', emits: ['update:modelValue', 'change'] }
];

emitChecks.forEach(({ name, emits }) => {
  const component = components.find(c => c.name === name).component;
  if (component && component.emits) {
    const hasEmits = emits.every(e => e in component.emits);
    console.log(`${hasEmits ? '✓' : '✗'} ${name}: ${emits.join(', ')}`);
  } else {
    console.log(`✗ ${name}: 无法读取 emits`);
  }
});

console.log('\n✅ 组件挂载验证完成！');
process.exit(allPassed ? 0 : 1);
