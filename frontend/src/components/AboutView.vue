<script setup lang="ts">
const features = [
  { num: "01", title: "SK 配置", desc: "选择 Cursor / Claude Agent 引擎，安全保存与校验 Secret Key。" },
  { num: "02", title: "路由池", desc: "按用途（出方案 / 执行 / 评审 / 测试）将模型分级路由，两套引擎各一策略。" },
  { num: "03", title: "自驱运行", desc: "难度评估 → 出方案 → 拆解 TODO → 每个任务自循环开发，全程流式回传。" },
];
</script>

<template>
  <div class="px-5 py-6">
    <h2 class="font-serif text-2xl font-normal tracking-tight text-slate-900">关于 LoopForge</h2>
    <p class="mt-2 text-sm leading-relaxed text-slate-600">
      面向 Cursor / Claude 的节点·Loop 自驱编排工具。把"需求 → 方案 → 拆解 → 自循环开发"压成一条可观测的流水线。
    </p>

    <div class="mt-6 space-y-1">
      <div
        v-for="f in features"
        :key="f.num"
        class="list-row flex items-baseline justify-between gap-4 border-t border-slate-200 py-4 first:border-t-0"
      >
        <div class="flex items-baseline gap-3">
          <span class="num text-base italic text-slate-400">{{ f.num }}</span>
          <div>
            <h3 class="text-sm font-semibold text-slate-900">{{ f.title }}</h3>
            <p class="mt-1 text-xs leading-relaxed text-slate-600">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p class="label-caps">安全</p>
      <p class="mt-1.5 text-xs leading-relaxed text-slate-600">
        Secret Key 仅发送到本地后端并落盘于 <span class="font-mono">backend/.data</span>，不经任何第三方。
      </p>
    </div>

    <p class="mt-6 text-center font-mono text-[10px] uppercase tracking-widest text-slate-400">
      LoopForge · H5 · v0.1
    </p>
  </div>
</template>
