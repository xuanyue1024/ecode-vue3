<template>
  <div class="danmaku-overlay" v-show="visible">
    <div
      v-for="item in activeDanmakus"
      :key="item.id"
      class="danmaku-item"
      :class="{ 'is-host': item.role === 0 }"
      :style="item.style"
      @animationend="removeDanmaku(item.id)"
    >
      {{ item.msg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, defineProps } from 'vue';
import type { DanmakuMessage } from '@/api/live';

interface ActiveDanmaku extends DanmakuMessage {
  id: string;
  style: any;
}

const props = defineProps<{
  messages: DanmakuMessage[]; // 接收到的新消息列表
  visible: boolean;
}>();

const activeDanmakus = ref<ActiveDanmaku[]>([]);
const trackCount = 10; // 弹幕轨道数量

// 监听新的消息
watch(() => props.messages, (newMessages) => {
  if (!props.visible) return;
  // 只处理新增加的消息，这里假设父组件会不断推入新消息，
  // 实际更好的做法是父组件只传入“最新收到的一条”或通过expose函数调用
  // 但为了配合 Reactivity，这里假设 props.messages 是流式更新的
  // 简单起见，我们假设父组件调用 addDanmaku 方法，或者如果是全量列表更新，我们需要diff
  // 为了方便，改为 expose 一个 add 方法供父组件调用
});

// 定义 expose 方法供父组件直接调用添加弹幕
const addDanmaku = (message: DanmakuMessage) => {
  if (!props.visible) return;

  const trackIndex = Math.floor(Math.random() * trackCount);
  const top = `${(trackIndex * 10) % 80 + 5}%`; // 随机轨道位置，留出上下空间
  const duration = Math.random() * 5 + 5; // 5-10s 动画时间
  
  const id = Date.now().toString() + Math.random().toString().slice(2);
  
  const style = {
    top: top,
    color: message.color || '#ffffff',
    fontSize: message.size ? `${message.size}px` : '14px',
    animationDuration: `${duration}s`,
    border: message.role === 0 ? '2px solid #ff0000' : 'none',
    backgroundColor: message.role === 0 ? 'rgba(255,0,0,0.2)' : 'transparent',
    padding: message.role === 0 ? '2px 8px' : '0',
    borderRadius: '4px',
    fontWeight: 'bold',
    textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
  };

  activeDanmakus.value.push({
    ...message,
    id,
    style
  });
};

const removeDanmaku = (id: string) => {
  const index = activeDanmakus.value.findIndex(d => d.id === id);
  if (index !== -1) {
    activeDanmakus.value.splice(index, 1);
  }
};

defineExpose({
  addDanmaku
});
</script>

<style scoped>
.danmaku-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none; /* 只需要展示，不阻挡鼠标事件 */
  z-index: 10;
}

.danmaku-item {
  position: absolute;
  white-space: nowrap;
  font-size: 20px;
  will-change: left, transform;
  animation-name: danmaku-move;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

@keyframes danmaku-move {
  from {
    left: 100%;
    transform: translateX(0);
  }
  to {
    left: 0;
    transform: translateX(-100%);
  }
}
</style>
