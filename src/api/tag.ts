import { postRequest, getRequest, getRequestForm } from '@/utils/request'

// 搜索标签
export const searchTags = (name: string) => {
  return getRequest(`/api/teacher/tag?name=${name}`)
}

// 新增标签
export const addTag = (name: string) => {
  return postRequest(`/api/teacher/tag/${name}`, {})
}

// 批量新增标签
export const batchAddTags = (names: string[]) => {
  return postRequest('/api/teacher/tag/batch', names)
}

// 根据ID获取标签列表
export const getTagsByIds = (ids: string[]) => {
  return getRequest(`/api/teacher/tag/getByIds?ids=${ids.join(',')}`)
}

// 学生端根据id集合获取标签
export const getStudentTagsByIds = (ids: string[]) =>
  getRequest(`/api/student/tag/getByIds?ids=${ids.join(',')}`)
