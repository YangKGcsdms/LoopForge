<script setup lang="ts">
/**
 * 顶层壳 —— 只做「浏览器版 / H5 版」的设备识别与分发，二者共存。
 * 运行态(useRun)与表单态(useWorkflowForm)在这里创建并下发，
 * 因此两版共享同一份数据，切换（自动或手动）不丢运行进度与已填内容。
 */
import { onUnmounted } from "vue";
import DesktopApp from "./layouts/DesktopApp.vue";
import MobileApp from "./mobile/MobileApp.vue";
import { useRun } from "./composables/useRun";
import { useWorkflowForm } from "./composables/useWorkflowForm";
import { useDevice } from "./composables/useDevice";

const runState = useRun();
const formState = useWorkflowForm();
const { isMobile, mode, autoIsMobile, setMode } = useDevice();

onUnmounted(runState.cleanup);
</script>

<template>
  <component
    :is="isMobile ? MobileApp : DesktopApp"
    :run-state="runState"
    :form-state="formState"
    :mode="mode"
    :auto-is-mobile="autoIsMobile"
    @set-mode="setMode"
  />
</template>
