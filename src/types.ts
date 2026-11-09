export type OrderStatus = 'new' | 'in_progress' | 'done' | 'cancelled'
export type TaskType = 'measurement' | 'delivery' | 'assembly' | 'complaint'

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  jobRole?: 'manager' | 'assembler' | 'measurer'
  jobRoles?: ('manager' | 'assembler' | 'measurer')[]
  accentColor?: string
  active: boolean
  avatarUrl?: string | null
  canEdit?: boolean
  createdAt?: string
}

export interface Client {
  id: string
  name: string
  callSign: string | null
  email: string | null
  phone: string | null
  notes: string | null
  createdAt: string
}

export interface Order {
  id: string
  number: number
  title: string
  description: string | null
  address: string | null
  addressLat: number | null
  addressLng: number | null
  priceListId: string | null
  status: OrderStatus
  amount: number
  advanceAmount: number
  assemblyAmount: number | null
  nearestDeadline: string | null
  clientId: string
  client: Client
  creatorId: string
  creator: User
  members: User[]
  createdAt: string
  updatedAt: string
  taskTotal?: number
  taskDone?: number
  imageCount?: number
}

export interface Task {
  id: string
  title?: string
  taskType: TaskType
  dueDate: string
  completed: boolean
  createdBy: string
  createdAt: string
  assignees: User[]
}

export interface CalendarTask extends Task {
  orderId: string
  orderTitle: string
  orderNumber: number
}

export interface OrderImage {
  id: string
  originalName: string
  mimeType: string
  size: number
  uploadedBy: string
  createdAt: string
}

export interface OrderDetails extends Order {
  tasks: Task[]
  images: OrderImage[]
  priceList: PriceList | null
  priceTotal: number
}

export interface MessageReaction {
  emoji: string
  count: number
  reacted: boolean
}

export interface Message {
  id: string
  body: string
  createdAt: string
  orderId: string | null
  recipientId: string | null
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>
  readBy: Pick<User, 'id' | 'name'>[]
  reactions: MessageReaction[]
  attachmentUrl?: string | null
  attachmentName?: string | null
  attachmentMime?: string | null
  attachmentDuration?: number | null
  attachmentSize?: number | null
  transcript?: string | null
}

export interface Conversation {
  type: 'direct' | 'order'
  id: string
  title: string
  subtitle: string
  avatarUrl?: string | null
  unreadCount: number
  lastMessage: { body: string; createdAt: string; senderName: string } | null
}

export interface Notifications {
  count: number
  items: {
    id: string
    body: string
    createdAt: string
    orderId: string | null
    recipientId: string | null
    sender: Pick<User, 'id' | 'name' | 'avatarUrl'>
    conversationTitle: string
  }[]
}

export interface Stats {
  total: number
  new: number
  inProgress: number
  done: number
  cancelled: number
  created: number
  amount: number
  tasks: { total: number; completed: number }
  monthly: { month: string; orders: number; done: number }[]
  upcoming: CalendarTask[]
}

export interface OrderInput {
  title: string
  description: string
  address: string
  addressLat: number | null
  addressLng: number | null
  status: OrderStatus
  amount: number
  advanceAmount: number
  assemblyAmount: number | null
  clientId: string
  memberIds: string[]
  editorIds: string[]
}

export interface PriceItem {
  id: string
  kind?: 'service' | 'divider'
  category: string
  name: string
  price: number
  position: number
  completed?: boolean
}

export interface PriceList {
  id: string
  title: string
  printTitle: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: PriceItem[]
}

export interface OrderActivity {
  id: string
  action: string
  body: string
  createdAt: string
  user: Pick<User, 'id' | 'name' | 'avatarUrl'> | null
}

export interface AssemblerAvailability {
  id: string
  name: string
  avatarUrl: string | null
  days: { date: string; busy: boolean }[]
}

export interface UnavailableDay {
  date: string
  reason: string | null
}
