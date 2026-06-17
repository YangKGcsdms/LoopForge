<script setup lang="ts">
import { onUnmounted } from "vue";
import { useRun } from "../composables/useRun";
import { useWorkflowForm } from "../composables/useWorkflowForm";
import WorkflowForm from "./WorkflowForm.vue";
import WorkflowResults from "./WorkflowResults.vue";

const runState = useRun();
const formState = useWorkflowForm();

onUnmounted(runState.cleanup);
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <!-- 左栏：运行表单 -->
    <div class="min-h-screen">
      <WorkflowForm :use-run-state="runState" :form-state="formState" />
    </div>

    <!-- 右栏：结果容器 -->
    <div class="min-h-screen">
      <WorkflowResults :use-run-state="runState" />
    </div>
  </div>
</template>
