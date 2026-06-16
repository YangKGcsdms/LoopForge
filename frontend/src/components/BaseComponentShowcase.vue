<script setup lang="ts">
import { ref } from "vue";
import BaseCard from "./BaseCard.vue";
import BaseButton from "./BaseButton.vue";
import BaseInput from "./BaseInput.vue";
import BaseSelect from "./BaseSelect.vue";
import StatusBadge from "./StatusBadge.vue";
import SectionTitle from "./SectionTitle.vue";

const inputValue = ref("");
const emailValue = ref("");
const numberValue = ref(10);
const passwordValue = ref("");
const selectValue = ref("option1");
</script>

<template>
  <div class="space-y-8">
    <!-- StatusBadge 展示 -->
    <BaseCard variant="default" size="lg">
      <h2 class="mb-4 text-lg font-semibold">StatusBadge 组件</h2>
      <p class="mb-6 text-sm text-slate-600">状态徽章：显示运行中/完成/错误等状态，支持多种语义色彩和交互态。</p>

      <div class="space-y-4">
        <!-- 状态类型 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">状态类型（status）</h3>
          <div class="flex flex-wrap gap-3">
            <StatusBadge status="running" />
            <StatusBadge status="completed" />
            <StatusBadge status="error" />
            <StatusBadge status="pending" />
            <StatusBadge status="idle" />
          </div>
        </div>

        <!-- 自定义标签 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">自定义标签（label）</h3>
          <div class="flex flex-wrap gap-3">
            <StatusBadge status="running" label="处理中..." />
            <StatusBadge status="completed" label="已完成 ✓" />
            <StatusBadge status="error" label="发生错误" />
          </div>
        </div>

        <!-- 紧凑尺寸 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">紧凑尺寸（compact）</h3>
          <div class="flex flex-wrap gap-3">
            <StatusBadge status="running" compact />
            <StatusBadge status="completed" compact />
            <StatusBadge status="error" compact />
          </div>
        </div>

        <!-- 禁用态 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">禁用态（disabled）</h3>
          <div class="flex flex-wrap gap-3">
            <StatusBadge status="running" disabled />
            <StatusBadge status="completed" disabled />
            <StatusBadge status="error" disabled />
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- SectionTitle 展示 -->
    <BaseCard variant="default" size="lg">
      <h2 class="mb-4 text-lg font-semibold">SectionTitle 组件</h2>
      <p class="mb-6 text-sm text-slate-600">章节标题：统一标题层级、副标题、分隔线和间距管理。</p>

      <div class="space-y-6">
        <!-- 标题层级 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">标题层级（level）</h3>
          <div class="space-y-4">
            <SectionTitle level="h1" title="Heading Level 1" divider />
            <SectionTitle level="h2" title="Heading Level 2" divider />
            <SectionTitle level="h3" title="Heading Level 3" divider />
            <SectionTitle level="h4" title="Heading Level 4" divider />
            <SectionTitle level="h5" title="Heading Level 5" divider />
            <SectionTitle level="h6" title="Heading Level 6" divider />
          </div>
        </div>

        <!-- 带副标题 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">带副标题（description）</h3>
          <SectionTitle
            title="章节标题"
            description="这是一个带有副标题的章节标题组件，通常用于分隔不同的内容区块。"
            divider
          />
        </div>

        <!-- 分隔线颜色 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">分隔线颜色（dividerColor）</h3>
          <div class="space-y-3">
            <SectionTitle title="中性分隔线" dividerColor="neutral" divider />
            <SectionTitle title="微妙分隔线" dividerColor="subtle" divider />
            <SectionTitle title="强调分隔线" dividerColor="accent" divider />
          </div>
        </div>

        <!-- 间距 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">间距（spacing）</h3>
          <div class="space-y-2">
            <SectionTitle title="小间距（sm）" spacing="sm" divider />
            <SectionTitle title="中间距（md）" spacing="md" divider />
            <SectionTitle title="大间距（lg）" spacing="lg" divider />
          </div>
        </div>

        <!-- 禁用态 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">禁用态（disabled）</h3>
          <SectionTitle
            title="禁用的标题"
            description="这个标题处于禁用状态，显示为灰色和降低的不透明度。"
            disabled
            divider
          />
        </div>

        <!-- 无分隔线 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">无分隔线（divider=false）</h3>
          <SectionTitle title="没有分隔线的标题" :divider="false" />
        </div>
      </div>
    </BaseCard>

    <!-- BaseButton 展示 -->
    <BaseCard variant="default" size="lg">
      <h2 class="mb-4 text-lg font-semibold">BaseButton 组件</h2>
      <p class="mb-6 text-sm text-slate-600">支持多种变体、尺寸和禁用态，统一焦点环样式。</p>

      <div class="space-y-4">
        <!-- 主要变体 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">变体（variant）</h3>
          <div class="flex flex-wrap gap-3">
            <BaseButton variant="primary">Primary Button</BaseButton>
            <BaseButton variant="secondary">Secondary Button</BaseButton>
            <BaseButton variant="danger">Danger Button</BaseButton>
            <BaseButton variant="ghost">Ghost Button</BaseButton>
          </div>
        </div>

        <!-- 尺寸 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">尺寸（size）</h3>
          <div class="flex flex-wrap items-center gap-3">
            <BaseButton variant="primary" size="sm">Small</BaseButton>
            <BaseButton variant="primary" size="md">Medium</BaseButton>
            <BaseButton variant="primary" size="lg">Large</BaseButton>
          </div>
        </div>

        <!-- 禁用态 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">禁用态（disabled）</h3>
          <div class="flex flex-wrap gap-3">
            <BaseButton variant="primary" disabled>Disabled Primary</BaseButton>
            <BaseButton variant="secondary" disabled>Disabled Secondary</BaseButton>
          </div>
        </div>

        <!-- 全宽 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">全宽（fullWidth）</h3>
          <BaseButton variant="primary" fullWidth>Full Width Button</BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- BaseInput 展示 -->
    <BaseCard variant="default" size="lg">
      <h2 class="mb-4 text-lg font-semibold">BaseInput 组件</h2>
      <p class="mb-6 text-sm text-slate-600">支持多种输入类型、尺寸和错误状态，统一焦点环样式。</p>

      <div class="space-y-4">
        <!-- 基本输入 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">基本输入（type="text"）</h3>
          <BaseInput v-model="inputValue" placeholder="输入文本..." fullWidth />
          <p class="mt-2 text-xs text-slate-500">当前值：{{ inputValue }}</p>
        </div>

        <!-- Email 输入 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">邮箱输入（type="email"）</h3>
          <BaseInput v-model="emailValue" type="email" placeholder="your@email.com" fullWidth />
          <p class="mt-2 text-xs text-slate-500">当前值：{{ emailValue }}</p>
        </div>

        <!-- 数字输入 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">数字输入（type="number"）</h3>
          <BaseInput v-model="numberValue" type="number" fullWidth />
          <p class="mt-2 text-xs text-slate-500">当前值：{{ numberValue }}</p>
        </div>

        <!-- 密码输入 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">密码输入（type="password"）</h3>
          <BaseInput v-model="passwordValue" type="password" placeholder="输入密码..." fullWidth />
        </div>

        <!-- 尺寸 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">尺寸（size）</h3>
          <div class="space-y-2">
            <BaseInput size="sm" placeholder="Small input" fullWidth />
            <BaseInput size="md" placeholder="Medium input (default)" fullWidth />
            <BaseInput size="lg" placeholder="Large input" fullWidth />
          </div>
        </div>

        <!-- 禁用态 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">禁用态（disabled）</h3>
          <BaseInput disabled placeholder="Disabled input" fullWidth />
        </div>

        <!-- 错误状态 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">错误状态（error）</h3>
          <BaseInput error placeholder="Error input" fullWidth />
          <p class="mt-2 text-xs text-rose-600">输入有误，请检查</p>
        </div>

        <!-- 变体 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">变体（variant）</h3>
          <div class="space-y-2">
            <BaseInput variant="default" placeholder="Default variant" fullWidth />
            <BaseInput variant="muted" placeholder="Muted variant" fullWidth />
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- BaseSelect 展示 -->
    <BaseCard variant="default" size="lg">
      <h2 class="mb-4 text-lg font-semibold">BaseSelect 组件</h2>
      <p class="mb-6 text-sm text-slate-600">支持多种尺寸和禁用态，统一焦点环样式。</p>

      <div class="space-y-4">
        <!-- 基本选择 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">基本选择</h3>
          <BaseSelect v-model="selectValue" fullWidth>
            <option value="option1">选项 1</option>
            <option value="option2">选项 2</option>
            <option value="option3">选项 3</option>
          </BaseSelect>
          <p class="mt-2 text-xs text-slate-500">当前值：{{ selectValue }}</p>
        </div>

        <!-- 尺寸 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">尺寸（size）</h3>
          <div class="space-y-2">
            <BaseSelect size="sm" fullWidth>
              <option>Small select</option>
            </BaseSelect>
            <BaseSelect size="md" fullWidth>
              <option>Medium select (default)</option>
            </BaseSelect>
            <BaseSelect size="lg" fullWidth>
              <option>Large select</option>
            </BaseSelect>
          </div>
        </div>

        <!-- 禁用态 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">禁用态（disabled）</h3>
          <BaseSelect disabled fullWidth>
            <option>Disabled select</option>
          </BaseSelect>
        </div>
      </div>
    </BaseCard>

    <!-- BaseCard 展示 -->
    <BaseCard variant="default" size="lg">
      <h2 class="mb-4 text-lg font-semibold">BaseCard 组件</h2>
      <p class="mb-6 text-sm text-slate-600">支持多种样式、尺寸和背景色调。</p>

      <div class="space-y-4">
        <!-- 基础变体 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">变体（variant）</h3>
          <div class="space-y-2">
            <BaseCard variant="default">
              <p class="font-medium">Default Card</p>
              <p class="text-sm text-slate-600">标准白色背景，细边框，轻微阴影。</p>
            </BaseCard>
            <BaseCard variant="elevated">
              <p class="font-medium">Elevated Card</p>
              <p class="text-sm text-slate-600">白色背景，明显阴影，呈现提升效果。</p>
            </BaseCard>
            <BaseCard variant="outlined">
              <p class="font-medium">Outlined Card</p>
              <p class="text-sm text-slate-600">白色背景，较粗边框，无阴影。</p>
            </BaseCard>
          </div>
        </div>

        <!-- 尺寸 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">尺寸（size）</h3>
          <div class="space-y-2">
            <BaseCard size="sm">
              <p class="text-sm font-medium">Small Card</p>
            </BaseCard>
            <BaseCard size="md">
              <p class="font-medium">Medium Card (default)</p>
            </BaseCard>
            <BaseCard size="lg">
              <p class="text-lg font-semibold">Large Card</p>
            </BaseCard>
          </div>
        </div>

        <!-- 色调 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">背景色调（tone）</h3>
          <div class="space-y-2">
            <BaseCard tone="neutral">
              <p class="font-medium">Neutral Tone</p>
              <p class="text-sm text-slate-600">默认中性灰色调。</p>
            </BaseCard>
            <BaseCard tone="success">
              <p class="font-medium text-emerald-700">Success Tone</p>
              <p class="text-sm text-emerald-600">用于成功/完成的绿色调。</p>
            </BaseCard>
            <BaseCard tone="warning">
              <p class="font-medium text-amber-700">Warning Tone</p>
              <p class="text-sm text-amber-600">用于警告的黄色调。</p>
            </BaseCard>
            <BaseCard tone="error">
              <p class="font-medium text-rose-700">Error Tone</p>
              <p class="text-sm text-rose-600">用于错误的红色调。</p>
            </BaseCard>
            <BaseCard tone="info">
              <p class="font-medium text-sky-700">Info Tone</p>
              <p class="text-sm text-sky-600">用于信息提示的蓝色调。</p>
            </BaseCard>
          </div>
        </div>

        <!-- 交互模式 -->
        <div>
          <h3 class="mb-3 text-sm font-medium text-slate-700">交互模式（interactive）</h3>
          <BaseCard interactive>
            <p class="font-medium">Interactive Card</p>
            <p class="text-sm text-slate-600">可悬停，呈现可点击的视觉反馈。</p>
          </BaseCard>
        </div>
      </div>
    </BaseCard>

    <!-- 组合示例 -->
    <BaseCard variant="elevated" size="lg" tone="info">
      <h2 class="mb-4 text-lg font-semibold text-sky-900">组合示例：表单</h2>
      <div class="space-y-4">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">用户名</label>
          <BaseInput placeholder="输入用户名" fullWidth />
        </div>
        <div>
          <label class="mb-1.5 block text-sm font-medium text-slate-700">密码</label>
          <BaseInput type="password" placeholder="输入密码" fullWidth />
        </div>
        <div class="flex gap-3 pt-2">
          <BaseButton variant="primary" fullWidth>登录</BaseButton>
          <BaseButton variant="secondary" fullWidth>重置</BaseButton>
        </div>
      </div>
    </BaseCard>
  </div>
</template>
