<template>
  <div class="passkey-container">
    <a-card :bordered="false" class="main-card">
      <template #title>
        <a-space>
          <KeyOutlined />
          <span>通行密钥管理</span>
        </a-space>
      </template>
      <template #extra>
        <a-button type="primary" @click="openRegisterModal">
          <template #icon><PlusOutlined /></template>
          注册 Passkey
        </a-button>
      </template>

      <a-table 
        :data-source="passkeyList" 
        :columns="columns"
        :pagination="false"
        :row-key="(record) => record.credential.credentialId"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">
            {{ index + 1 }}
          </template>
          <template v-if="column.key === 'action'">
            <a-popconfirm
              title="确定要移除该密钥吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="deletePasskeyItem(record.credential.credentialId)"
            >
              <a-button type="link" danger size="small">移除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="registerModalVisible"
      title="注册新密钥"
      @ok="handleRegister"
      :confirmLoading="registering"
    >
      <a-form layout="vertical">
        <a-form-item label="密钥名称" required>
          <a-input 
            v-model:value="newPasskeyName" 
            placeholder="给你的密钥起个名字，例如：我的 MacBook" 
            @pressEnter="handleRegister"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { KeyOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { getPasskeyList, deletePasskey, getPasskeyRegistration, passkeyRegistration } from '@/api/user'
import { create, parseCreationOptionsFromJSON } from "@github/webauthn-json/browser-ponyfill"

const passkeyList = ref([])
const registerModalVisible = ref(false)
const newPasskeyName = ref('')
const registering = ref(false)

const columns = [
  {
    title: '序号',
    key: 'index',
    width: 80,
    align: 'center'
  },
  {
    title: '名称',
    dataIndex: 'credentialNickname',
    key: 'credentialNickname',
    width: 150,
  },
  {
    title: '凭证 ID',
    dataIndex: ['credential', 'credentialId'],
    key: 'credentialId',
    ellipsis: true
  },
  {
    title: '使用次数',
    dataIndex: ['credential', 'signatureCount'],
    key: 'signatureCount',
    width: 120,
    align: 'center',
    sorter: (a: any, b: any) => a.credential.signatureCount - b.credential.signatureCount,
    defaultSortOrder: 'descend'
  },
  {
    title: '最后使用时间',
    dataIndex: 'useTime',
    key: 'useTime',
    width: 180,
  },
  {
    title: '注册时间',
    dataIndex: 'registrationTime',
    key: 'registrationTime',
    width: 180,
  },
  {
    title: '操作',
    key: 'action',
    fixed: 'right',
    width: 100,
    align: 'center'
  },
]

const getPasskeyListData = async () => {
  try {
    const res = await getPasskeyList()
    if (res.data.code === 200) {
      passkeyList.value = res.data.data
    } else {
      message.error(res.data.msg)
    }
  } catch (error) {
    console.error(error)
  }
}

const deletePasskeyItem = async (id: string) => {
  try {
    const res = await deletePasskey(id)
    if (res.data.code === 200) {
      message.success('删除成功')
      getPasskeyListData()
    } else {
      message.error('删除失败')
    }
  } catch (error) {
    console.error(error)
    message.error('删除失败')
  }
}

const openRegisterModal = () => {
  newPasskeyName.value = ''
  registerModalVisible.value = true
}

const handleRegister = async () => {
  if (!newPasskeyName.value) {
    message.warning('请输入密钥名称')
    return
  }
  
  registering.value = true
  try {
    const res = await getPasskeyRegistration()
    if (res.data.code === 200) {
      const publicKeyOptions = parseCreationOptionsFromJSON(res.data.data)
      const credential = await create(publicKeyOptions)
      console.log('Credential created:', credential)
      
      const data = {
        credential: JSON.stringify(credential),
        name: newPasskeyName.value
      }
      console.log('Sending registration data:', data)
      
      const regRes = await passkeyRegistration(data)
      if (regRes.data.code === 200) {
        message.success('注册成功🎉🎉🎉')
        getPasskeyListData()
        registerModalVisible.value = false
      } else {
        message.error(regRes.data.msg)
      }
    }
  } catch (error) {
    console.error('注册失败:', error)
    message.error('密钥注册失败')
  } finally {
    registering.value = false
  }
}

onMounted(() => {
  getPasskeyListData()
})
</script>

<style scoped>
.passkey-container {
  padding: 24px;
  background: #f0f2f5;
  min-height: 100%;
}

.main-card {
  border-radius: 8px;
}
</style>
