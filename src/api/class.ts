import { postRequest, getRequest, putRequest, deleteRequest, deleteRequestForm } from '@/utils/request'

// 教师端接口
// 增加班级
export const addClass = (name: string) => {
  return postRequest('/api/teacher/class?name=' + encodeURIComponent(name), null)
}

// 修改班级信息
export const updateClass = (data: any) =>
  putRequest('/api/teacher/class', data)

// 批量删除班级
export const deleteClasses = (ids: number[]) => {
  return deleteRequestForm('/api/teacher/class', {
    ids: ids.join(',')
  })
}

// 班级分页查询
export const getClassPage = (params: any) =>
  getRequest(`/api/teacher/class/page?pageNo=${params.pageNo}&pageSize=${params.pageSize}&name=${params.name || ''}&isAsc=${params.isAsc || false}&sortBy=${params.sortBy || ''}`)

// 班级增加题目
export const addProblemToClass = (data: any) =>
  postRequest('/api/teacher/class/problem', data)

// 批量移除班级题目
export const removeProblemFromClass = (data: any) =>
  deleteRequest('/api/teacher/class/problem', data)

// 班级题目分页查询
export const getClassProblemPage = (params: any) =>
  getRequest(`/api/teacher/class/problem/page?classId=${params.classId}&pageNo=${params.pageNo}&pageSize=${params.pageSize}&name=${params.name || ''}&isAsc=${params.isAsc || false}&sortBy=${params.sortBy || ''}`)

// 获取班级题目通过率排行榜
export const getClassProblemPassRate = (classId: number) =>
  getRequest(`/api/teacher/statistic/classProblemPassRate/${classId}`)

// 获取班级学生成绩排名
export const getClassStudentRank = (classId: number) =>
  getRequest(`/api/teacher/statistic/classStudentRank/${classId}`)

// 获取班级题目难度分布 - 教师
export const getTeacherClassProblemDifficultyNum = (classId: number) =>
  getRequest(`/api/teacher/statistic/classProblemDifficultyNum/${classId}`)

// 获取班级题目标签分布 - 教师
export const getTeacherClassProblemTagNum = (classId: number) =>
  getRequest(`/api/teacher/statistic/classProblemTagNum/${classId}`)

// 教师端获取班级成员
export const getTeacherClassMembers = (params: any) =>
  getRequest(`/api/teacher/class/members/page?classId=${params.classId}&pageNo=${params.pageNo}&pageSize=${params.pageSize}&name=${params.name || ''}&isAsc=${params.isAsc || false}&sortBy=${params.sortBy || ''}`)

// 获取班级单个题目的做题详细信息
export const getTeacherClassProblemInfo = (classProblemId: number, studentId: number) =>
  getRequest(`/api/teacher/class/problem/info/${classProblemId}/${studentId}`)

// 学生端接口
// 加入班级
export const joinClass = (invitationCode: string) =>
  getRequest(`/api/student/class?invitationCode=${invitationCode}`)

// 退出班级
export const quitClass = (ids: number[]) => {
  return deleteRequestForm('/api/student/class', {
    ids: ids.join(',')
  })
}

// 获取学生班级分页列表
export const getStudentClassPage = (params: any) => {
  return getRequest(`/api/student/class/page?pageNo=${params.pageNo}&pageSize=${params.pageSize}&name=${params.name || ''}&isAsc=${params.isAsc || false}&sortBy=${params.sortBy || ''}`)
}

// 获取班级成员列表
export const getClassMembers = (params: any) => {
  return getRequest(`/api/student/class/members/page?classId=${params.classId}&pageNo=${params.pageNo}&pageSize=${params.pageSize}&name=${params.name || ''}&isAsc=${params.isAsc || false}&sortBy=${params.sortBy || ''}`)
}

// 获取学生班级题目列表
export const getStudentClassProblemPage = (params: any) => {
  return getRequest(`/api/student/class/problem/page?classId=${params.classId}&pageNo=${params.pageNo}&pageSize=${params.pageSize}&name=${params.name || ''}&isAsc=${params.isAsc || false}&sortBy=${params.sortBy || ''}`)
}

// 获取班级题目详情信息
export const getClassProblemInfo = (classProblemId: string) => {
  return getRequest(`/api/student/class/problem/info/${classProblemId}`)
}

// 获取班级题目难度分布
export const getStudentClassProblemDifficultyNum = (classId: string) => {
  return getRequest(`/api/student/statistic/classProblemDifficultyNum/${classId}`)
}

// 获取班级题目标签分布
export const getStudentClassProblemTagNum = (classId: string) => {
  return getRequest(`/api/student/statistic/classProblemTagNum/${classId}`)
}
