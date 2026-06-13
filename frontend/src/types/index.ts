export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'retry'
export type NodeType = 'scheduler' | 'worker'
export type NotificationStatus = 'sent' | 'confirmed' | 'rejected'
export type NotificationPriority = 'high' | 'medium' | 'low'

export interface Task {
  id: string
  name: string
  status: TaskStatus
  node: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  retries: number
  maxRetries: number
  duration?: number
  logs: string[]
  owner?: string
  notificationStatus?: NotificationStatus
}

export interface ClusterNode {
  id: string
  name: string
  type: NodeType
  status: 'online' | 'offline' | 'overloaded'
  cpu: number
  memory: number
  tasks: number
  uptime: number
}

export interface MetricsSnapshot {
  time: number
  totalTasks: number
  runningTasks: number
  successRate: number
  avgLatency: number
  nodeCount: number
}

export interface Notification {
  id: string
  taskId: string
  taskName: string
  owner: string
  status: NotificationStatus
  sentAt: string
  confirmedAt?: string
  message?: string
  priority?: NotificationPriority
  deadline?: string
  resultSummary?: string
  rejectReason?: string
  confirmRemark?: string
  externalContacts?: string[]
  ccList?: string[]
}

export interface NotificationStats {
  total: number
  pending: number
  confirmed: number
  rejected: number
  highPriorityPending: number
}

export interface CreateNotificationParams {
  taskId: string
  taskName: string
  owner: string
  message?: string
  priority?: NotificationPriority
  deadline?: string
  resultSummary?: string
  externalContacts?: string[]
  ccList?: string[]
}
