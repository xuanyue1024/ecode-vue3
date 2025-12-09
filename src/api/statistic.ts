import { getRequest, getRequestForm } from '@/utils/request'

// 获取学生统计数据
export function getStudentStatistic(classId: string) {
  return getRequestForm('/api/student/statistic/dateCreateUser', { classId })
}
