import { getRequest, deleteRequest, postRequest } from '@/utils/request'

// 获取新的chatId
export function createChatId(type: string) {
  return getRequest(`/api/user/ai/creat?type=${type}`)
}

// 获取会话列表
export function getChatHistory(type: string) {
  return getRequest(`/api/user/ai/history/${type}`)
}

// 获取单个会话历史记录
export function getChatMessages(type: string, chatId: string) {
  return getRequest(`/api/user/ai/history/${type}/${chatId}`)
}

// 删除会话
export function deleteChatHistory(type: string, chatId: string) {
  return deleteRequest(`/api/user/ai/history/${type}/${chatId}`, null)
}

// 检查PDF是否存在
export function checkPdfExists(classId: string) {
  return getRequest(`/api/teacher/ai/pdf/file/${classId}`)
}

// 上传PDF
export function uploadPdf(classId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return postRequest(`/api/teacher/ai/pdf/upload/${classId}`, formData)
}

// 删除PDF
export function deletePdf(classId: string) {
  return deleteRequest(`/api/teacher/ai/pdf/delete/${classId}`, null)
}

// 获取PDF URL
export function getKnowledgeBasePdfUrl(classId: string) {
    return `/api/teacher/ai/pdf/file/${classId}`
}
