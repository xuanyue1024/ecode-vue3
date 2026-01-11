<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
  <!-- 全局验证码挂载点，TAC 会将验证码渲染到此处 -->
  <div id="captcha-box" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 99999;"></div>
</template>

<style scoped>
</style>
