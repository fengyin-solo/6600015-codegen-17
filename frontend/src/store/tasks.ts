import { create } from 'zustand'
import type { Task, ClusterNode, MetricsSnapshot, TaskStatus, Notification, NotificationStatus, NotificationPriority, CreateNotificationParams, NotificationStats } from '../types'

function mockNodes(): ClusterNode[] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `node-${i + 1}`,
    name: i === 0 ? 'scheduler-main' : `worker-${i}`,
    type: i === 0 ? 'scheduler' as const : 'worker' as const,
    status: Math.random() > 0.1 ? 'online' as const : 'overloaded' as const,
    cpu: 20 + Math.random() * 60,
    memory: 30 + Math.random() * 50,
    tasks: Math.floor(Math.random() * 8),
    uptime: 3600 + Math.floor(Math.random() * 86400),
  }))
}

const OWNERS = ['zhangsan', 'lisi', 'wangwu', 'zhaoliu']
const PRIORITIES: NotificationPriority[] = ['high', 'medium', 'low']

function mockTasks(nodes: ClusterNode[]): Task[] {
  const names = ['data_sync', 'email_batch', 'report_gen', 'cache_warm', 'log_rotate', 'db_backup', 'index_rebuild', 'health_check']
  return Array.from({ length: 12 }, (_, i) => {
    const status: TaskStatus[] = ['pending', 'running', 'success', 'failed']
    const s = status[Math.floor(Math.random() * 4)]
    const node = nodes[Math.floor(Math.random() * nodes.length)]
    const owner = OWNERS[i % OWNERS.length]
    const notifStatuses: (NotificationStatus | undefined)[] = [undefined, 'sent', 'confirmed', 'rejected']
    const notifStatus = s === 'success' ? notifStatuses[Math.floor(Math.random() * 4)] : undefined
    return {
      id: `task-${1000 + i}`,
      name: names[i % names.length],
      status: s,
      node: node.name,
      createdAt: Date.now() - Math.floor(Math.random() * 600000),
      startedAt: s !== 'pending' ? Date.now() - Math.floor(Math.random() * 300000) : undefined,
      completedAt: (s === 'success' || s === 'failed') ? Date.now() - Math.floor(Math.random() * 60000) : undefined,
      retries: s === 'failed' ? Math.floor(Math.random() * 3) : 0,
      maxRetries: 3,
      duration: s === 'success' ? 1000 + Math.floor(Math.random() * 30000) : undefined,
      logs: [`[INFO] Task ${names[i % names.length]} started`, `[INFO] Processing on ${node.name}`],
      owner,
      notificationStatus: notifStatus,
    }
  })
}

function mockNotifications(tasks: Task[]): Notification[] {
  const notifTasks = tasks.filter(t => t.notificationStatus === 'sent' || t.notificationStatus === 'confirmed' || t.notificationStatus === 'rejected')
  const seed: Notification[] = [
    {
      id: 'notif-seed-1',
      taskId: 'task-1001',
      taskName: 'data_sync',
      owner: 'zhangsan',
      status: 'sent',
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      deadline: new Date(Date.now() + 24 * 3600000).toISOString(),
      message: 'Task data_sync (task-1001) completed successfully, please confirm the result.',
      priority: 'high',
      resultSummary: 'Processed 1,500 records, success rate 97%. 2 fields need business review.',
      externalContacts: ['external_vendor@partner.com'],
      ccList: ['pm_team@company.com'],
    },
    {
      id: 'notif-seed-2',
      taskId: 'task-1002',
      taskName: 'email_batch',
      owner: 'lisi',
      status: 'confirmed',
      sentAt: new Date(Date.now() - 7200000).toISOString(),
      confirmedAt: new Date(Date.now() - 5400000).toISOString(),
      message: 'Task email_batch (task-1002) completed, please confirm delivery result.',
      priority: 'medium',
      resultSummary: 'Sent 5,000 emails, delivered 4,980, bounced 20.',
      confirmRemark: 'Delivery rate meets the SLA, approved.',
      ccList: ['marketing@company.com'],
    },
    {
      id: 'notif-seed-3',
      taskId: 'task-1003',
      taskName: 'report_gen',
      owner: 'wangwu',
      status: 'rejected',
      sentAt: new Date(Date.now() - 10800000).toISOString(),
      confirmedAt: new Date(Date.now() - 9000000).toISOString(),
      message: 'Weekly sales report generated, please verify data.',
      priority: 'low',
      resultSummary: 'Report generated with 12 pages and 6 charts.',
      rejectReason: 'Q3 figures do not match the source ERP system. Please re-extract and re-generate.',
      ccList: ['finance@company.com'],
    },
  ]
  const generated = notifTasks
    .filter(t => !seed.find(s => s.taskId === t.id))
    .map((t, i) => ({
      id: `notif-${i + 100}`,
      taskId: t.id,
      taskName: t.name,
      owner: t.owner || '',
      status: t.notificationStatus!,
      priority: PRIORITIES[i % 3],
      sentAt: new Date(t.createdAt + 60000).toISOString(),
      confirmedAt: t.notificationStatus !== 'sent' ? new Date(t.createdAt + 120000).toISOString() : undefined,
      deadline: t.notificationStatus === 'sent' ? new Date(t.createdAt + 48 * 3600000).toISOString() : undefined,
      message: `Task ${t.name} (${t.id}) completed, please confirm the result.`,
      resultSummary: `Processed ${1000 + i * 200} records successfully.`,
      confirmRemark: t.notificationStatus === 'confirmed' ? 'Data looks correct, approved.' : undefined,
      rejectReason: t.notificationStatus === 'rejected' ? 'Please re-check the data calculation logic.' : undefined,
    }))
  return [...seed, ...generated]
}

const initialNodes = mockNodes()
const initialTasks = mockTasks(initialNodes)

interface TaskStore {
  tasks: Task[]
  nodes: ClusterNode[]
  metrics: MetricsSnapshot[]
  selectedTask: Task | null
  notifications: Notification[]
  notificationFilters: { status?: NotificationStatus; owner?: string; priority?: NotificationPriority }
  addTask: (name: string) => void
  retryTask: (id: string) => void
  cancelTask: (id: string) => void
  selectTask: (t: Task | null) => void
  refreshNodes: () => void
  addMetric: () => void
  notifyTask: (params: CreateNotificationParams) => void
  confirmNotification: (notifId: string, remark?: string) => void
  rejectNotification: (notifId: string, reason?: string) => void
  setNotificationFilters: (filters: Partial<{ status: NotificationStatus; owner: string; priority: NotificationPriority }>) => void
  getNotificationStats: () => NotificationStats
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: initialTasks,
  nodes: initialNodes,
  metrics: Array.from({ length: 20 }, (_, i) => ({
    time: Date.now() - (20 - i) * 5000,
    totalTasks: 100 + i * 2,
    runningTasks: 3 + Math.floor(Math.random() * 5),
    successRate: 85 + Math.random() * 14,
    avgLatency: 500 + Math.random() * 2000,
    nodeCount: 5,
  })),
  selectedTask: null,
  notifications: mockNotifications(initialTasks),
  notificationFilters: {},
  addTask: (name) => {
    const task: Task = {
      id: `task-${Date.now()}`,
      name, status: 'pending',
      node: get().nodes[Math.floor(Math.random() * get().nodes.length)].name,
      createdAt: Date.now(), retries: 0, maxRetries: 3, logs: [`[INFO] Task ${name} queued`],
    }
    set({ tasks: [task, ...get().tasks] })
  },
  retryTask: (id) => set({
    tasks: get().tasks.map(t => t.id === id ? { ...t, status: 'pending', retries: t.retries + 1, logs: [...t.logs, '[INFO] Retrying...'] } : t)
  }),
  cancelTask: (id) => set({
    tasks: get().tasks.map(t => t.id === id ? { ...t, status: 'failed' as TaskStatus, logs: [...t.logs, '[WARN] Cancelled by user'] } : t)
  }),
  selectTask: (t) => set({ selectedTask: t }),
  refreshNodes: () => set({ nodes: mockNodes() }),
  addMetric: () => {
    const m: MetricsSnapshot = {
      time: Date.now(),
      totalTasks: get().tasks.length,
      runningTasks: get().tasks.filter(t => t.status === 'running').length,
      successRate: (get().tasks.filter(t => t.status === 'success').length / Math.max(get().tasks.length, 1)) * 100,
      avgLatency: 500 + Math.random() * 2000,
      nodeCount: get().nodes.filter(n => n.status !== 'offline').length,
    }
    set({ metrics: [...get().metrics.slice(-30), m] })
  },
  notifyTask: (params) => {
    const { taskId, taskName, owner, message, priority, deadline, resultSummary, externalContacts, ccList } = params
    const tasks = get().tasks.map(t =>
      t.id === taskId && t.status === 'success'
        ? { ...t, owner, notificationStatus: 'sent' as NotificationStatus, logs: [...t.logs, `[INFO] Notification sent to ${owner} (priority: ${priority || 'medium'})`] }
        : t
    )
    const notification: Notification = {
      id: `notif-${Date.now()}`,
      taskId,
      taskName,
      owner,
      status: 'sent',
      sentAt: new Date().toISOString(),
      deadline,
      priority: priority || 'medium',
      message: message || `Task ${taskName} (${taskId}) completed, please confirm the result.`,
      resultSummary,
      externalContacts: externalContacts || [],
      ccList: ccList || [],
    }
    set({ tasks, notifications: [notification, ...get().notifications] })
  },
  confirmNotification: (notifId, remark) => {
    const notif = get().notifications.find(n => n.id === notifId)
    if (!notif) return
    const notifications = get().notifications.map(n =>
      n.id === notifId ? { ...n, status: 'confirmed' as NotificationStatus, confirmedAt: new Date().toISOString(), confirmRemark: remark, rejectReason: undefined } : n
    )
    const tasks = get().tasks.map(t =>
      t.id === notif.taskId ? { ...t, notificationStatus: 'confirmed' as NotificationStatus, logs: [...t.logs, `[INFO] Business owner confirmed the result${remark ? `: ${remark}` : ''}`] } : t
    )
    set({ notifications, tasks })
  },
  rejectNotification: (notifId, reason) => {
    const notif = get().notifications.find(n => n.id === notifId)
    if (!notif) return
    const notifications = get().notifications.map(n =>
      n.id === notifId ? { ...n, status: 'rejected' as NotificationStatus, confirmedAt: new Date().toISOString(), rejectReason: reason, confirmRemark: undefined } : n
    )
    const tasks = get().tasks.map(t =>
      t.id === notif.taskId ? { ...t, notificationStatus: 'rejected' as NotificationStatus, logs: [...t.logs, `[INFO] Business owner rejected the result${reason ? `: ${reason}` : ''}`] } : t
    )
    set({ notifications, tasks })
  },
  setNotificationFilters: (filters) => {
    set({ notificationFilters: { ...get().notificationFilters, ...filters } })
  },
  getNotificationStats: () => {
    const ns = get().notifications
    return {
      total: ns.length,
      pending: ns.filter(n => n.status === 'sent').length,
      confirmed: ns.filter(n => n.status === 'confirmed').length,
      rejected: ns.filter(n => n.status === 'rejected').length,
      highPriorityPending: ns.filter(n => n.status === 'sent' && n.priority === 'high').length,
    }
  },
}))
