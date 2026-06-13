import { useState, useMemo } from 'react'
import {
  Layout, Tabs, Statistic, Row, Col, Card, Tag, Button, Input, Table, Drawer,
  Descriptions, Space, Progress, Badge, Modal, Select, List, message, DatePicker,
  Radio, Empty, Tooltip, Divider, Alert
} from 'antd'
import {
  BellOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, SendOutlined, FilterOutlined, UserOutlined,
  MailOutlined, TeamOutlined
} from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useTaskStore } from '../store/tasks'
import type { Task, TaskStatus, NotificationStatus, NotificationPriority, Notification } from '../types'

const { Header, Content } = Layout
const { TextArea } = Input

const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'default', running: 'processing', success: 'success', failed: 'error', retry: 'warning'
}

const NOTIF_STATUS_COLORS: Record<NotificationStatus, string> = {
  sent: 'processing', confirmed: 'success', rejected: 'error'
}

const NOTIF_STATUS_LABELS: Record<NotificationStatus, string> = {
  sent: '待确认', confirmed: '已确认', rejected: '已驳回'
}

const PRIORITY_COLORS: Record<NotificationPriority, string> = {
  high: 'red', medium: 'gold', low: 'blue'
}

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  high: '高', medium: '中', low: '低'
}

const PRIORITY_ICONS: Record<NotificationPriority, React.ReactNode> = {
  high: <ExclamationCircleOutlined />,
  medium: <ClockCircleOutlined />,
  low: <ClockCircleOutlined />
}

const OWNERS = ['zhangsan', 'lisi', 'wangwu', 'zhaoliu']

function formatDateTime(v?: string) {
  return v ? new Date(v).toLocaleString() : '-'
}

function isOverdue(deadline?: string) {
  if (!deadline) return false
  return new Date(deadline).getTime() < Date.now()
}

function daysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

export default function Dashboard() {
  const store = useTaskStore()
  const [newTaskName, setNewTaskName] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)
  const [notifDetailOpen, setNotifDetailOpen] = useState(false)
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null)

  const [notifyModalOpen, setNotifyModalOpen] = useState(false)
  const [notifyTaskId, setNotifyTaskId] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<string | undefined>(undefined)
  const [notifyMessage, setNotifyMessage] = useState('')
  const [notifyPriority, setNotifyPriority] = useState<NotificationPriority>('medium')
  const [notifyDeadline, setNotifyDeadline] = useState<number | null>(null)
  const [notifyResultSummary, setNotifyResultSummary] = useState('')
  const [notifyExternalContacts, setNotifyExternalContacts] = useState('')
  const [notifyCcList, setNotifyCcList] = useState('')

  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmNotifId, setConfirmNotifId] = useState<string | null>(null)
  const [confirmRemark, setConfirmRemark] = useState('')

  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectNotifId, setRejectNotifId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [filterStatus, setFilterStatus] = useState<NotificationStatus | undefined>(undefined)
  const [filterOwner, setFilterOwner] = useState<string | undefined>(undefined)
  const [filterPriority, setFilterPriority] = useState<NotificationPriority | undefined>(undefined)

  const notifStats = store.getNotificationStats()
  const pendingCount = notifStats.pending
  const highPriorityPending = notifStats.highPriorityPending

  const filteredNotifications = useMemo(() => {
    return store.notifications.filter(n => {
      if (filterStatus && n.status !== filterStatus) return false
      if (filterOwner && n.owner !== filterOwner) return false
      if (filterPriority && n.priority !== filterPriority) return false
      return true
    })
  }, [store.notifications, filterStatus, filterOwner, filterPriority])

  const handleOpenNotify = (taskId: string) => {
    const task = store.tasks.find(t => t.id === taskId)
    setNotifyTaskId(taskId)
    setNotifyModalOpen(true)
    setSelectedOwner(task?.owner)
    setNotifyPriority('medium')
    setNotifyDeadline(daysFromNow(1).getTime())
    setNotifyResultSummary(task ? `Task ${task.name} completed successfully on node ${task.node}.` : '')
    setNotifyMessage('')
    setNotifyExternalContacts('')
    setNotifyCcList('')
  }

  const handleNotify = () => {
    if (!notifyTaskId || !selectedOwner) {
      message.warning('请选择业务负责人')
      return
    }
    const task = store.tasks.find(t => t.id === notifyTaskId)
    if (!task) return
    const externalArr = notifyExternalContacts ? notifyExternalContacts.split(/[,，\s]+/).filter(Boolean) : []
    const ccArr = notifyCcList ? notifyCcList.split(/[,，\s]+/).filter(Boolean) : []
    store.notifyTask({
      taskId: notifyTaskId,
      taskName: task.name,
      owner: selectedOwner,
      message: notifyMessage || undefined,
      priority: notifyPriority,
      deadline: notifyDeadline ? new Date(notifyDeadline).toISOString() : undefined,
      resultSummary: notifyResultSummary || undefined,
      externalContacts: externalArr.length ? externalArr : undefined,
      ccList: ccArr.length ? ccArr : undefined,
    })
    message.success(`已通知 ${selectedOwner}（优先级：${PRIORITY_LABELS[notifyPriority]}）`)
    resetNotifyModal()
  }

  const resetNotifyModal = () => {
    setNotifyModalOpen(false)
    setNotifyTaskId(null)
    setSelectedOwner(undefined)
    setNotifyMessage('')
    setNotifyPriority('medium')
    setNotifyDeadline(null)
    setNotifyResultSummary('')
    setNotifyExternalContacts('')
    setNotifyCcList('')
  }

  const openConfirmModal = (notifId: string) => {
    setConfirmNotifId(notifId)
    setConfirmRemark('')
    setConfirmModalOpen(true)
  }

  const handleConfirm = () => {
    if (!confirmNotifId) return
    store.confirmNotification(confirmNotifId, confirmRemark || undefined)
    message.success('已确认通知结果')
    setConfirmModalOpen(false)
    setConfirmNotifId(null)
    setConfirmRemark('')
  }

  const openRejectModal = (notifId: string) => {
    setRejectNotifId(notifId)
    setRejectReason('')
    setRejectModalOpen(true)
  }

  const handleReject = () => {
    if (!rejectNotifId) return
    if (!rejectReason.trim()) {
      message.warning('请填写驳回原因')
      return
    }
    store.rejectNotification(rejectNotifId, rejectReason)
    message.warning('已驳回通知结果')
    setRejectModalOpen(false)
    setRejectNotifId(null)
    setRejectReason('')
  }

  const openNotifDetail = (notif: Notification) => {
    setSelectedNotif(notif)
    setNotifDetailOpen(true)
  }

  const taskColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: TaskStatus) => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: '节点', dataIndex: 'node', key: 'node' },
    { title: '重试', key: 'retries', render: (_: any, r: Task) => `${r.retries}/${r.maxRetries}` },
    { title: '耗时', key: 'duration', render: (_: any, r: Task) => r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '-' },
    { title: '通知状态', key: 'notificationStatus', render: (_: any, r: Task) =>
      r.notificationStatus ? <Tag color={NOTIF_STATUS_COLORS[r.notificationStatus]}>{NOTIF_STATUS_LABELS[r.notificationStatus]}</Tag> : <Tag>-</Tag>
    },
    { title: '操作', key: 'actions', width: 220, render: (_: any, r: Task) => (
      <Space>
        {r.status === 'failed' && <Button size="small" type="primary" onClick={() => store.retryTask(r.id)}>重试</Button>}
        {r.status === 'running' && <Button size="small" danger onClick={() => store.cancelTask(r.id)}>取消</Button>}
        {r.status === 'success' && !r.notificationStatus && (
          <Button size="small" type="dashed" icon={<SendOutlined />} onClick={() => handleOpenNotify(r.id)}>
            通知负责人
          </Button>
        )}
        {r.status === 'success' && r.notificationStatus === 'sent' && (
          <Tooltip title="等待业务负责人确认">
            <Tag color="processing" icon={<ClockCircleOutlined />}>待确认</Tag>
          </Tooltip>
        )}
        {r.notificationStatus === 'confirmed' && <Tag color="success" icon={<CheckCircleOutlined />}>已确认</Tag>}
        {r.notificationStatus === 'rejected' && <Tag color="error" icon={<CloseCircleOutlined />}>已驳回</Tag>}
        <Button size="small" onClick={() => { store.selectTask(r); setDrawerOpen(true) }}>详情</Button>
      </Space>
    )},
  ]

  const successCount = store.tasks.filter(t => t.status === 'success').length
  const failedCount = store.tasks.filter(t => t.status === 'failed').length
  const runningCount = store.tasks.filter(t => t.status === 'running').length

  const notifColumns = [
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (p?: NotificationPriority) => p ? (
        <Tag color={PRIORITY_COLORS[p]} icon={PRIORITY_ICONS[p]}>{PRIORITY_LABELS[p]}</Tag>
      ) : '-',
      sorter: (a: Notification, b: Notification) => {
        const order = { high: 3, medium: 2, low: 1 } as const
        return (order[a.priority || 'low'] || 0) - (order[b.priority || 'low'] || 0)
      }
    },
    { title: '通知ID', dataIndex: 'id', key: 'id', width: 140 },
    {
      title: '任务',
      key: 'task',
      render: (_: any, r: Notification) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{r.taskName}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{r.taskId}</span>
        </Space>
      )
    },
    { title: '业务负责人', dataIndex: 'owner', key: 'owner', width: 110, render: (o: string) => <Space><UserOutlined />{o}</Space> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s: NotificationStatus, r: Notification) => (
        <Space>
          <Tag color={NOTIF_STATUS_COLORS[s]}>{NOTIF_STATUS_LABELS[s]}</Tag>
          {s === 'sent' && r.deadline && isOverdue(r.deadline) && (
            <Tooltip title="已超过确认截止时间">
              <Tag color="red">已逾期</Tag>
            </Tooltip>
          )}
        </Space>
      )
    },
    { title: '发送时间', dataIndex: 'sentAt', key: 'sentAt', width: 170, render: (v: string) => formatDateTime(v) },
    {
      title: '确认截止',
      dataIndex: 'deadline',
      key: 'deadline',
      width: 170,
      render: (v: string | undefined, r: Notification) => v ? (
        <Space>
          <span style={{ color: isOverdue(v) && r.status === 'sent' ? '#ff4d4f' : undefined }}>
            {formatDateTime(v)}
          </span>
        </Space>
      ) : '-'
    },
    { title: '确认时间', dataIndex: 'confirmedAt', key: 'confirmedAt', width: 170, render: (v?: string) => formatDateTime(v) },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, r: Notification) => (
        <Space>
          {r.status === 'sent' && (
            <>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openConfirmModal(r.id)}>确认</Button>
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => openRejectModal(r.id)}>驳回</Button>
            </>
          )}
          <Button size="small" onClick={() => openNotifDetail(r)}>查看</Button>
        </Space>
      )
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ color: 'white', margin: 0, fontSize: 18 }}>🔧 分布式任务调度与监控平台</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input placeholder="任务名称" value={newTaskName} onChange={e => setNewTaskName(e.target.value)} style={{ width: 160 }} />
          <Button type="primary" onClick={() => { if (newTaskName) { store.addTask(newTaskName); setNewTaskName('') } }}>
            添加任务
          </Button>
          <Badge count={pendingCount} size="small" offset={[0, 2]}>
            <Tooltip title={`${pendingCount} 条待确认${highPriorityPending > 0 ? `（${highPriorityPending} 条高优先级）` : ''}`}>
              <Button
                type="text"
                icon={<BellOutlined style={{ color: 'white', fontSize: 18 }} />}
                onClick={() => setNotifDrawerOpen(true)}
              />
            </Tooltip>
          </Badge>
        </div>
      </Header>
      <Content style={{ padding: 16 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="总任务" value={store.tasks.length} /></Card></Col>
          <Col span={6}><Card><Statistic title="运行中" value={runningCount} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="成功" value={successCount} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="失败" value={failedCount} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={<Space><MailOutlined />协作通知总数</Space>}
                value={notifStats.total}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={<Space><ClockCircleOutlined />待确认</Space>}
                value={notifStats.pending}
                valueStyle={{ color: '#1890ff' }}
                suffix={highPriorityPending > 0 ? <Tag color="red" style={{ marginLeft: 8 }}>{highPriorityPending} 高优</Tag> : undefined}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={<Space><CheckCircleOutlined />已确认</Space>}
                value={notifStats.confirmed}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title={<Space><CloseCircleOutlined />已驳回</Space>}
                value={notifStats.rejected}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        {highPriorityPending > 0 && (
          <Alert
            style={{ marginBottom: 16 }}
            message={`您有 ${highPriorityPending} 条高优先级的协作通知等待确认，请及时处理`}
            type="warning"
            showIcon
            action={
              <Button size="small" type="primary" onClick={() => {
                setFilterPriority('high')
                setFilterStatus('sent')
              }}>
                查看
              </Button>
            }
          />
        )}

        <Tabs items={[
          { key: 'metrics', label: '监控指标', children: (
            <Row gutter={16}>
              <Col span={12}>
                <Card title="运行中任务数">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis fontSize={10} />
                      <RTooltip labelFormatter={t => new Date(t as number).toLocaleString()} />
                      <Area type="monotone" dataKey="runningTasks" stroke="#1890ff" fill="#1890ff" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="成功率 %">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis domain={[0, 100]} fontSize={10} />
                      <RTooltip labelFormatter={t => new Date(t as number).toLocaleString()} />
                      <Line type="monotone" dataKey="successRate" stroke="#52c41a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={24} style={{ marginTop: 16 }}>
                <Card title="平均延迟 (ms)">
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={store.metrics}>
                      <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleTimeString()} fontSize={10} />
                      <YAxis fontSize={10} />
                      <RTooltip />
                      <Area type="monotone" dataKey="avgLatency" stroke="#faad14" fill="#faad14" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )},
          { key: 'tasks', label: '任务列表', children: (
            <Table dataSource={store.tasks} columns={taskColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
          )},
          {
            key: 'notifications',
            label: (
              <Space>
                协作通知
                {pendingCount > 0 && <Badge count={pendingCount} size="small" />}
              </Space>
            ),
            children: (
              <>
                <Card
                  title={<Space><FilterOutlined />筛选条件</Space>}
                  size="small"
                  style={{ marginBottom: 16 }}
                >
                  <Row gutter={16}>
                    <Col span={6}>
                      <div style={{ marginBottom: 4 }}>状态：</div>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="全部状态"
                        allowClear
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={[
                          { label: '待确认', value: 'sent' },
                          { label: '已确认', value: 'confirmed' },
                          { label: '已驳回', value: 'rejected' },
                        ]}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ marginBottom: 4 }}>负责人：</div>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="全部负责人"
                        allowClear
                        value={filterOwner}
                        onChange={setFilterOwner}
                        options={OWNERS.map(o => ({ label: o, value: o }))}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ marginBottom: 4 }}>优先级：</div>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="全部优先级"
                        allowClear
                        value={filterPriority}
                        onChange={setFilterPriority}
                        options={[
                          { label: PRIORITY_LABELS.high, value: 'high' },
                          { label: PRIORITY_LABELS.medium, value: 'medium' },
                          { label: PRIORITY_LABELS.low, value: 'low' },
                        ]}
                      />
                    </Col>
                    <Col span={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <Button onClick={() => { setFilterStatus(undefined); setFilterOwner(undefined); setFilterPriority(undefined) }}>
                        重置筛选
                      </Button>
                    </Col>
                  </Row>
                </Card>
                <Card title={`外部协作通知列表（共 ${filteredNotifications.length} 条）`}>
                  <Table
                    dataSource={filteredNotifications}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                    columns={notifColumns}
                    scroll={{ x: 1300 }}
                    locale={{
                      emptyText: (
                        <Empty
                          description={
                            store.notifications.length === 0
                              ? '暂无协作通知，任务完成后可通知业务负责人确认'
                              : '当前筛选条件下暂无数据'
                          }
                        />
                      )
                    }}
                  />
                </Card>
              </>
            )
          },
          { key: 'nodes', label: '集群节点', children: (
            <Row gutter={16}>
              {store.nodes.map(node => (
                <Col span={8} key={node.id} style={{ marginBottom: 16 }}>
                  <Card title={<span>{node.type === 'scheduler' ? '🎯' : '⚙️'} {node.name}</span>}
                    extra={<Tag color={node.status === 'online' ? 'green' : node.status === 'overloaded' ? 'orange' : 'red'}>{node.status}</Tag>}>
                    <Progress percent={Math.round(node.cpu)} strokeColor={node.cpu > 80 ? '#ff4d4f' : '#1890ff'} format={v => `CPU ${v}%`} />
                    <Progress percent={Math.round(node.memory)} strokeColor={node.memory > 80 ? '#ff4d4f' : '#52c41a'} format={v => `MEM ${v}%`} />
                    <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                      任务数: {node.tasks} | 运行时间: {Math.floor(node.uptime / 3600)}h
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )},
        ]} />

        {/* 任务详情抽屉 */}
        <Drawer title="任务详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={480}>
          {store.selectedTask && (
            <>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="ID">{store.selectedTask.id}</Descriptions.Item>
                <Descriptions.Item label="名称">{store.selectedTask.name}</Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={STATUS_COLORS[store.selectedTask.status]}>{store.selectedTask.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="执行节点">{store.selectedTask.node}</Descriptions.Item>
                <Descriptions.Item label="重试次数">{store.selectedTask.retries}/{store.selectedTask.maxRetries}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{new Date(store.selectedTask.createdAt).toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="耗时">{store.selectedTask.duration ? `${(store.selectedTask.duration / 1000).toFixed(1)}s` : '-'}</Descriptions.Item>
                <Descriptions.Item label="业务负责人">{store.selectedTask.owner || '-'}</Descriptions.Item>
                <Descriptions.Item label="通知状态">
                  {store.selectedTask.notificationStatus
                    ? <Tag color={NOTIF_STATUS_COLORS[store.selectedTask.notificationStatus]}>{NOTIF_STATUS_LABELS[store.selectedTask.notificationStatus]}</Tag>
                    : '-'
                  }
                </Descriptions.Item>
              </Descriptions>

              {store.selectedTask.status === 'success' && !store.selectedTask.notificationStatus && (
                <Button
                  block
                  type="primary"
                  icon={<SendOutlined />}
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    handleOpenNotify(store.selectedTask!.id)
                    setDrawerOpen(false)
                  }}
                >
                  通知业务负责人确认结果
                </Button>
              )}

              <h4 style={{ marginTop: 16 }}>执行日志</h4>
              <pre style={{ background: '#1f1f1f', padding: 12, borderRadius: 8, fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                {store.selectedTask.logs.join('\n')}
              </pre>
            </>
          )}
        </Drawer>

        {/* 通知中心抽屉 */}
        <Drawer
          title={
            <Space>
              <BellOutlined />
              外部协作通知中心
              <Tag color="processing">{pendingCount} 待确认</Tag>
              {highPriorityPending > 0 && <Tag color="red">{highPriorityPending} 高优</Tag>}
            </Space>
          }
          open={notifDrawerOpen}
          onClose={() => setNotifDrawerOpen(false)}
          width={520}
        >
          {store.notifications.length === 0 ? (
            <Empty description="暂无协作通知" />
          ) : (
            <List
              dataSource={store.notifications}
              renderItem={(item) => {
                const overdue = item.status === 'sent' && item.deadline && isOverdue(item.deadline)
                return (
                  <List.Item
                    style={{
                      background: item.priority === 'high' && item.status === 'sent' ? 'rgba(255,77,79,0.06)' : undefined,
                      padding: 12,
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                    actions={item.status === 'sent' ? [
                      <Button key="confirm" size="small" type="primary" onClick={() => { setNotifDrawerOpen(false); openConfirmModal(item.id) }}>确认</Button>,
                      <Button key="reject" size="small" danger onClick={() => { setNotifDrawerOpen(false); openRejectModal(item.id) }}>驳回</Button>,
                    ] : undefined}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge dot color={PRIORITY_COLORS[item.priority || 'medium']} offset={[2, 2]}>
                          <div
                            style={{
                              width: 40, height: 40, borderRadius: 8,
                              background: item.priority === 'high' ? '#fff1f0' : item.priority === 'medium' ? '#fffbe6' : '#e6f4ff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: PRIORITY_COLORS[item.priority || 'medium'],
                              fontSize: 20
                            }}
                          >
                            {PRIORITY_ICONS[item.priority || 'medium']}
                          </div>
                        </Badge>
                      }
                      title={
                        <Space>
                          <span style={{ fontWeight: 600 }}>{item.taskName}</span>
                          <Tag color={NOTIF_STATUS_COLORS[item.status]}>{NOTIF_STATUS_LABELS[item.status]}</Tag>
                          {item.priority && <Tag color={PRIORITY_COLORS[item.priority]}>{PRIORITY_LABELS[item.priority]}优先级</Tag>}
                          {overdue && <Tag color="red">已逾期</Tag>}
                          <Button type="link" size="small" onClick={() => { setNotifDrawerOpen(false); openNotifDetail(item) }}>详情</Button>
                        </Space>
                      }
                      description={
                        <div style={{ fontSize: 12 }}>
                          <div style={{ color: '#bbb', marginBottom: 4 }}>
                            <Space>
                              <UserOutlined /> 负责人: {item.owner}
                              <MailOutlined /> 发送: {formatDateTime(item.sentAt)}
                            </Space>
                          </div>
                          {item.deadline && (
                            <div style={{ color: overdue ? '#ff4d4f' : '#999', marginBottom: 4 }}>
                              截止确认: {formatDateTime(item.deadline)}
                            </div>
                          )}
                          {item.resultSummary && (
                            <div style={{ background: 'rgba(255,255,255,0.04)', padding: 8, borderRadius: 4, margin: '4px 0' }}>
                              📊 {item.resultSummary}
                            </div>
                          )}
                          {item.message && (
                            <div style={{ color: '#aaa', marginTop: 4 }}>💬 {item.message}</div>
                          )}
                          {item.rejectReason && (
                            <Alert style={{ marginTop: 8 }} type="error" showIcon message={item.rejectReason} />
                          )}
                          {item.confirmRemark && (
                            <Alert style={{ marginTop: 8 }} type="success" showIcon message={item.confirmRemark} />
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )
              }}
            />
          )}
        </Drawer>

        {/* 通知详情抽屉 */}
        <Drawer
          title={
            <Space>
              <SendOutlined />
              协作通知详情
              {selectedNotif?.priority && (
                <Tag color={PRIORITY_COLORS[selectedNotif.priority]}>
                  {PRIORITY_LABELS[selectedNotif.priority]}优先级
                </Tag>
              )}
              {selectedNotif?.status && (
                <Tag color={NOTIF_STATUS_COLORS[selectedNotif.status]}>
                  {NOTIF_STATUS_LABELS[selectedNotif.status]}
                </Tag>
              )}
            </Space>
          }
          open={notifDetailOpen}
          onClose={() => { setNotifDetailOpen(false); setSelectedNotif(null) }}
          width={560}
          footer={
            selectedNotif?.status === 'sent' ? (
              <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
                <Button danger onClick={() => { setNotifDetailOpen(false); openRejectModal(selectedNotif.id) }}>驳回结果</Button>
                <Button type="primary" onClick={() => { setNotifDetailOpen(false); openConfirmModal(selectedNotif.id) }}>确认结果</Button>
              </Space>
            ) : undefined
          }
        >
          {selectedNotif && (
            <>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="通知ID">{selectedNotif.id}</Descriptions.Item>
                <Descriptions.Item label="任务名称">{selectedNotif.taskName}</Descriptions.Item>
                <Descriptions.Item label="任务ID">{selectedNotif.taskId}</Descriptions.Item>
                <Descriptions.Item label="业务负责人"><Space><UserOutlined />{selectedNotif.owner}</Space></Descriptions.Item>
                <Descriptions.Item label="通知状态">
                  <Space>
                    <Tag color={NOTIF_STATUS_COLORS[selectedNotif.status]}>{NOTIF_STATUS_LABELS[selectedNotif.status]}</Tag>
                    {selectedNotif.status === 'sent' && selectedNotif.deadline && isOverdue(selectedNotif.deadline) && (
                      <Tag color="red">已逾期</Tag>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="发送时间">{formatDateTime(selectedNotif.sentAt)}</Descriptions.Item>
                <Descriptions.Item label="确认截止">{formatDateTime(selectedNotif.deadline)}</Descriptions.Item>
                <Descriptions.Item label="确认时间">{formatDateTime(selectedNotif.confirmedAt)}</Descriptions.Item>
                {selectedNotif.externalContacts && selectedNotif.externalContacts.length > 0 && (
                  <Descriptions.Item label="外部协作人">
                    <Space wrap>
                      {selectedNotif.externalContacts.map((c, i) => (
                        <Tag key={i} color="purple" icon={<TeamOutlined />}>{c}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
                {selectedNotif.ccList && selectedNotif.ccList.length > 0 && (
                  <Descriptions.Item label="抄送">
                    <Space wrap>
                      {selectedNotif.ccList.map((c, i) => (
                        <Tag key={i}>{c}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>

              {selectedNotif.resultSummary && (
                <>
                  <Divider orientation="left">📊 执行结果摘要</Divider>
                  <div style={{
                    background: 'rgba(82,196,26,0.1)',
                    padding: 16,
                    borderRadius: 8,
                    border: '1px solid rgba(82,196,26,0.2)',
                    lineHeight: 1.6
                  }}>
                    {selectedNotif.resultSummary}
                  </div>
                </>
              )}

              {selectedNotif.message && (
                <>
                  <Divider orientation="left">💬 附加说明</Divider>
                  <div style={{
                    background: 'rgba(24,144,255,0.1)',
                    padding: 16,
                    borderRadius: 8,
                    border: '1px solid rgba(24,144,255,0.2)',
                    lineHeight: 1.6
                  }}>
                    {selectedNotif.message}
                  </div>
                </>
              )}

              {selectedNotif.confirmRemark && (
                <>
                  <Divider orientation="left">✅ 确认备注</Divider>
                  <Alert
                    type="success"
                    showIcon
                    message="业务负责人确认"
                    description={
                      <div>
                        <div style={{ marginBottom: 4 }}>时间: {formatDateTime(selectedNotif.confirmedAt)}</div>
                        <div>备注: {selectedNotif.confirmRemark}</div>
                      </div>
                    }
                  />
                </>
              )}

              {selectedNotif.rejectReason && (
                <>
                  <Divider orientation="left">❌ 驳回原因</Divider>
                  <Alert
                    type="error"
                    showIcon
                    message="业务负责人驳回"
                    description={
                      <div>
                        <div style={{ marginBottom: 4 }}>时间: {formatDateTime(selectedNotif.confirmedAt)}</div>
                        <div>原因: {selectedNotif.rejectReason}</div>
                      </div>
                    }
                  />
                </>
              )}
            </>
          )}
        </Drawer>

        {/* 通知发送弹窗 */}
        <Modal
          title={
            <Space>
              <SendOutlined />
              通知业务负责人确认结果
            </Space>
          }
          open={notifyModalOpen}
          onOk={handleNotify}
          onCancel={resetNotifyModal}
          okButtonProps={{ disabled: !selectedOwner }}
          okText="发送通知"
          width={640}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {notifyTaskId && (() => {
              const task = store.tasks.find(t => t.id === notifyTaskId)
              if (!task) return null
              return (
                <Alert
                  type="info"
                  showIcon
                  message={`任务: ${task.name}`}
                  description={
                    <div>
                      <div>ID: {task.id} | 节点: {task.node} | 耗时: {task.duration ? `${(task.duration / 1000).toFixed(1)}s` : '-'}</div>
                    </div>
                  }
                />
              )
            })()}

            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <UserOutlined /> 业务负责人 <span style={{ color: '#ff4d4f' }}>*</span>
                </div>
                <Select
                  style={{ width: '100%' }}
                  placeholder="请选择业务负责人"
                  value={selectedOwner}
                  onChange={setSelectedOwner}
                  options={OWNERS.map(o => ({ label: o, value: o }))}
                />
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <ExclamationCircleOutlined /> 优先级
                </div>
                <Radio.Group
                  value={notifyPriority}
                  onChange={e => setNotifyPriority(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  style={{ width: '100%' }}
                >
                  <Radio.Button value="high" style={{ color: notifyPriority === 'high' ? 'white' : '#ff4d4f', borderColor: '#ff4d4f40' }}>高</Radio.Button>
                  <Radio.Button value="medium" style={{ color: notifyPriority === 'medium' ? 'white' : '#faad14', borderColor: '#faad1440' }}>中</Radio.Button>
                  <Radio.Button value="low" style={{ color: notifyPriority === 'low' ? 'white' : '#1890ff', borderColor: '#1890ff40' }}>低</Radio.Button>
                </Radio.Group>
              </Col>
            </Row>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                <ClockCircleOutlined /> 确认截止时间
              </div>
              <Radio.Group value={notifyDeadline} onChange={e => setNotifyDeadline(e.target.value)}>
                <Radio.Button value={daysFromNow(1).getTime()}>1天内</Radio.Button>
                <Radio.Button value={daysFromNow(2).getTime()}>2天内</Radio.Button>
                <Radio.Button value={daysFromNow(7).getTime()}>1周内</Radio.Button>
                <Radio.Button value={null}>不设限</Radio.Button>
              </Radio.Group>
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>📊 执行结果摘要</div>
              <TextArea
                rows={3}
                value={notifyResultSummary}
                onChange={e => setNotifyResultSummary(e.target.value)}
                placeholder="请输入任务执行结果摘要，如：处理了多少数据、成功率、关键指标等..."
              />
            </div>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>💬 附加说明（可选）</div>
              <TextArea
                rows={3}
                value={notifyMessage}
                onChange={e => setNotifyMessage(e.target.value)}
                placeholder="请输入需要业务负责人特别关注的内容..."
              />
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <TeamOutlined /> 外部协作联系人
                </div>
                <Input
                  value={notifyExternalContacts}
                  onChange={e => setNotifyExternalContacts(e.target.value)}
                  placeholder="多个邮箱用逗号分隔"
                />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>会同步通知外部合作方</div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  <MailOutlined /> 抄送（CC）
                </div>
                <Input
                  value={notifyCcList}
                  onChange={e => setNotifyCcList(e.target.value)}
                  placeholder="多个邮箱用逗号分隔"
                />
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>抄送给相关干系人</div>
              </Col>
            </Row>
          </Space>
        </Modal>

        {/* 确认弹窗 */}
        <Modal
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              确认任务结果
            </Space>
          }
          open={confirmModalOpen}
          onOk={handleConfirm}
          onCancel={() => { setConfirmModalOpen(false); setConfirmNotifId(null); setConfirmRemark('') }}
          okText="确认通过"
          okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
        >
          <div style={{ marginBottom: 16 }}>
            请确认您已审核任务执行结果，确认后将标记为已完成。
          </div>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>确认备注（可选）</div>
            <TextArea
              rows={3}
              value={confirmRemark}
              onChange={e => setConfirmRemark(e.target.value)}
              placeholder="请输入确认说明，如：数据校验无误，可以进入下一流程..."
            />
          </div>
        </Modal>

        {/* 驳回弹窗 */}
        <Modal
          title={
            <Space>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              驳回任务结果
            </Space>
          }
          open={rejectModalOpen}
          onOk={handleReject}
          onCancel={() => { setRejectModalOpen(false); setRejectNotifId(null); setRejectReason('') }}
          okText="确认驳回"
          okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        >
          <Alert
            style={{ marginBottom: 16 }}
            type="warning"
            showIcon
            message="驳回后将通知任务创建者"
            description="请详细说明驳回原因，便于相关人员定位问题并重新处理。"
          />
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>
              驳回原因 <span style={{ color: '#ff4d4f' }}>*</span>
            </div>
            <TextArea
              rows={4}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="请详细描述驳回原因，如：数据存在异常、格式不符合要求、缺少必要字段等..."
            />
          </div>
        </Modal>
      </Content>
    </Layout>
  )
}
