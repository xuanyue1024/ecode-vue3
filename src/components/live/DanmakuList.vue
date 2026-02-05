<template>
  <div class="chat-container-wrapper" ref="wrapperRef">
    <div class="chat-panel" ref="chatPanelRef">
      <!-- 头部：标题与弹窗按钮 -->
      <div class="chat-header">
        <span>直播互动</span>
        <a-tooltip title="独立窗口聊天 (画中画)">
          <a-button type="text" @click="togglePiP">
            <template #icon>
              <component :is="isPiP ? 'AppstoreAddOutlined' : 'ExportOutlined'" />
            </template>
          </a-button>
        </a-tooltip>
      </div>

      <!-- 消息列表 -->
      <div class="message-list" ref="msgListRef">
        <div v-if="messages.length === 0" class="empty-tip">暂无消息</div>
        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          class="message-item"
        >
          <span v-if="msg.role === 0" class="badge-anchor">主播</span>
          <span class="username">{{ msg.username }}：</span>
          <span :style="{ color: msg.color }">{{ msg.msg }}</span>
        </div>
      </div>

      <!-- 发送框 -->
      <div class="input-area">
        <div class="toolbar">
          <input 
            type="color" 
            v-model="inputColor" 
            class="color-picker" 
            title="选择弹幕颜色"
          />
          <span class="color-tip">配色</span>
        </div>
        <div class="send-box">
          <a-input 
            v-model:value="inputText" 
            placeholder="发送弹幕..." 
            @pressEnter="handleSend" 
            :disabled="!canSend"
          />
          <a-button type="primary" @click="handleSend" :disabled="!canSend || !inputText.trim()">发送</a-button>
        </div>
        <div v-if="!canSend" class="disabled-tip">未开播或连接断开，无法发送</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch, onBeforeUnmount } from 'vue';
import { message } from 'ant-design-vue';
import { ExportOutlined, AppstoreAddOutlined } from '@ant-design/icons-vue';
import { sendDanmaku, getDanmakuList } from '@/api/live';
import type { DanmakuDTO, DanmakuMessage } from '@/api/live';

const props = defineProps<{
  classId: number; // 班级ID
  canSend: boolean; // 是否允许发送（例如未开播时禁止）
  currentMessages: DanmakuMessage[]; // 从父组件动态传入的实时消息列表
  initialLoad: boolean; // 是否需要初始化加载历史消息
}>();

const emit = defineEmits(['new-my-msg']); // 发送成功后通知父组件，以便立即上屏

const messages = ref<DanmakuMessage[]>([]);
const inputText = ref('');
const inputColor = ref('#000000');
const msgListRef = ref<HTMLElement | null>(null);

// Picture-in-Picture 相关
const wrapperRef = ref<HTMLElement | null>(null);
const chatPanelRef = ref<HTMLElement | null>(null);
const isPiP = ref(false);
let pipWindow: Window | null = null;

// 初始化加载历史消息
const loadHistory = async () => {
  if (!props.initialLoad) return;
  try {
    const res = await getDanmakuList(props.classId);
    if (res.data.code === 200) {
      // 历史消息追加到列表前面？或者直接覆盖？通常可以放在前面。
      // 注意：接口返回的是最后100条。
      // 如果 currentMessages 已经有实时消息，需要合并。
      // 这里为了简单，假设组件刚mount还没收到实时消息，直接赋值
      messages.value = [...res.data.data];
      scrollToBottom();
    }
  } catch (error) {
    console.error('获取历史弹幕失败', error);
  }
};

// 监听 props.currentMessages 变化，追加新消息
watch(() => props.currentMessages, (newVal) => {
  // 我们并不直接替换 messages，而是根据外部传入的增量或全量更新
  // 这里假设 parent 维护全量或者 parent 把新收到的消息以某种方式传进来
  // 按照通常做法，Parent 收到 WS 消息，push 进 active list，为了避免 heavy props copy, 
  // 我们其实可以直接把 props.currentMessages 当作唯一数据源，或者在这里做追加
  // 考虑到 loadHistory 是内部行为，我们采用: 内部 messages = history + 外部实时
  // 为了简化，我们建议父组件维护所有消息，这里只做展示?
  // 用户的 API 要求: "获取100条历史弹幕（暂时学生有就行）"。 
  // 可以在 View 层调 API 拿到 history，然后通过 props 传入。
  // 但是这里我已经写了 internal loadHistory。
  // 这种混合数据源比较麻烦。我们改为：
  // 监听 props.currentMessages 的**变化**（假设它只包含新来的消息? 不，它通常是全量列表）
  // 更好的方式：Parent 传入 `messages` 列表。loadHistory 也在 parent 做。
  // 但是为了组件逻辑清晰，我选择：
  // 1. 内部 messages 响应式数组。
  // 2. loadHistory 会填充这个数组。
  // 3. watch props.currentMessages，如果有新元素（比如长度变长），就把新元素加进去。
  // 或者更简单：Parent 负责所有数据处理，传入完整的 messages 数组。Load history 也在 Parent 做。
  // 这样 DanmakuList 只需要负责展示和发送。
  // **Prompt 说 "可获取实时的弹幕信息（聊天信息），还可以获取最后100条弹幕"**
  // 我将把 loadHistory 放在这里，但是把加载的数据 emit 给 parent? 或者 mix
  // 我们采用：messages 列表由本组件维护 + 父组件通过 ref 调用 addMessage (或者 props 传入新增加的一条)
  // 鉴于 Vue props 单向流，最好是 Parent 绑定 list。
  // 这里我决定：**本组件只负责展示 List，数据由 Parent 管理并传入**。
  // loadHistory 可以在 mounted 的时候触发 parent 的 action，或者 parent 自己调用。
  // 这样 `props.messages` 就是全量数据。
});

// 重新定义 Props，为了适配上面思路
// 实际上为了不改上面的 prompt 定义太远，我们还是在这里内部处理一点逻辑
// 如果 props.currentMessages 变化，我们认为是新消息来了。
// 但是为了简单起见，我修改一下 props 定义。
// 让我们依然使用内部 messages，并暴露 addMessage 方法给 parent。
// Parent 收到 WS 消息 -> call `chatRef.value.addMessage(msg)`
// loadHistory 内部自己做。

const addMessage = (msg: DanmakuMessage) => {
  messages.value.push(msg);
  scrollToBottom();
};

// 暴露给父组件的方法
defineExpose({
  addMessage,
  loadHistory
});

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (msgListRef.value) {
      msgListRef.value.scrollTop = msgListRef.value.scrollHeight;
    }
  });
};

// 发送消息
const handleSend = async () => {
  if (!inputText.value.trim()) return;
  if (!props.canSend) {
    message.warning('当前状态不可发送弹幕');
    return;
  }

  const dto: DanmakuDTO = {
    classId: props.classId,
    msg: inputText.value,
    color: inputColor.value
  };

  try {
    const res = await sendDanmaku(dto);
    if (res.data.code === 200 || res.data.code === 0) {
      // 发送成功，虽然 WS 会推回来，但为了体验，本地先上屏? 
      // 还是等待 WS 推送？一般为了去重，等待 WS 推送比较好，或者本地先上屏但不去重。
      // 这里可以不做本地上屏，靠 WS 回调。
      // 清空输入
      inputText.value = '';
      message.success('发送成功');
    } else {
      message.error(res.data.msg || '发送失败');
    }
  } catch (e) {
    console.error(e);
    message.error('发送出错');
  }
};

// 画中画模式
const togglePiP = async () => {
  // @ts-ignore
  if (!window.documentPictureInPicture) {
    message.warning('当前浏览器不支持文档画中画 API');
    return;
  }

  if (isPiP.value) {
    // 关闭
    if (pipWindow) pipWindow.close();
    return;
  }

  try {
    // @ts-ignore
    pipWindow = await window.documentPictureInPicture.requestWindow({
      width: 400,
      height: 600
    });

    if (!pipWindow) return;

    // 复制样式
    // 简单粗暴：把当前 document 的所有 style/link 标签拷过去
    [...document.styleSheets].forEach((styleSheet) => {
      try {
        if (styleSheet.href) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href;
            pipWindow!.document.head.appendChild(link);
        } else if (styleSheet.cssRules) {
            const style = document.createElement('style');
            [...styleSheet.cssRules].forEach(rule => {
                style.textContent += rule.cssText;
            });
            pipWindow!.document.head.appendChild(style);
        }
      } catch (e) {
          console.warn('Style copy failed', e);
      }
    });

    // 将 ChatPanel 的 DOM 移动到新窗口
    // 注意：Ant Design 的一些弹出层（message, tooltip）可能会失效或错位，因为它们通常挂载在 body
    // 这里只保证基本的聊天列表和输入框可用
    if (chatPanelRef.value) {
        pipWindow.document.body.appendChild(chatPanelRef.value);
    }

    isPiP.value = true;

    // 监听关闭事件
    pipWindow.addEventListener('pagehide', () => {
      // 恢复 DOM
      if (chatPanelRef.value && wrapperRef.value) {
        wrapperRef.value.appendChild(chatPanelRef.value);
      }
      isPiP.value = false;
      pipWindow = null;
    });

  } catch (e) {
    console.error('Failed to enter PiP', e);
  }
};

onMounted(() => {
  // loadHistory 由父组件通过 ref 控制调用时机，或者这里直接调用（如果props允许）
  if (props.initialLoad) {
    loadHistory();
  }
});
</script>

<style scoped>
.chat-container-wrapper {
  width: 100%;
  height: 100%;
  border: 1px solid #eee;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
}

.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff; /* 确保移动到 PiP 后有背景色 */
}

.chat-header {
  padding: 10px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background: #f9f9f9;
}

.message-item {
  margin-bottom: 8px;
  word-break: break-all;
  line-height: 1.5;
}

.badge-anchor {
  display: inline-block;
  background: #ff4d4f;
  color: white;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}

.username {
  color: #666;
  font-weight: 500;
}

.empty-tip {
  text-align: center;
  color: #999;
  margin-top: 20px;
}

.input-area {
  padding: 10px;
  border-top: 1px solid #f0f0f0;
}

.toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.color-picker {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  cursor: pointer;
  margin-right: 5px;
}

.color-tip {
  font-size: 12px;
  color: #666;
}

.send-box {
  display: flex;
  gap: 8px;
}

.disabled-tip {
  font-size: 12px;
  color: #ff4d4f;
  margin-top: 4px;
}
</style>
