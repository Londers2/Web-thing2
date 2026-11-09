import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BanknotesIcon, CalendarIcon, ChatBubbleLeftRightIcon, ChevronLeftIcon, ClockIcon, DocumentTextIcon, InformationCircleIcon, MapPinIcon, PencilSquareIcon, PrinterIcon, TrashIcon, UserIcon } from '@heroicons/react/16/solid'
import { api, jsonBody } from '../api'
import { useAuth } from '../auth'
import type { OrderActivity, OrderDetails, PriceList, User } from '../types'
import { formatDate, formatDateTime, formatMoney, statusColors, statusLabels } from '../utils'
import { Badge } from '../components/catalyst/badge'
import { Button } from '../components/catalyst/button'
import { Checkbox } from '../components/catalyst/checkbox'
import { DescriptionDetails, DescriptionList, DescriptionTerm } from '../components/catalyst/description-list'
import { Dialog, DialogBody, DialogTitle } from '../components/catalyst/dialog'
import { Divider } from '../components/catalyst/divider'
import { Heading, Subheading } from '../components/catalyst/heading'
import { Link } from '../components/catalyst/link'
import { Select } from '../components/catalyst/select'
import { ChatBox } from '../components/ChatBox'
import { ImageGallery } from '../components/ImageGallery'
import { ErrorAlert, Loading } from '../components/Loading'
import { OrderFormDialog } from '../components/OrderFormDialog'
import { PriceListDocument } from '../components/PriceListDocument'
import { SidePanel } from '../components/SidePanel'
import { TaskList } from '../components/TaskList'
import { UserAvatar } from '../components/UserAvatar'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [activities, setActivities] = useState<OrderActivity[]>([])
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [activitiesOpen, setActivitiesOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [pricePreviewOpen, setPricePreviewOpen] = useState(false)

  useEffect(() => {
    Promise.all([api<OrderDetails>(`/orders/${id}`), api<User[]>('/users'), api<PriceList[]>('/price-lists')]).then(([orderData, userData, priceData]) => {
      setOrder(orderData)
      setUsers(userData)
      setPriceLists(priceData)
    }).catch((reason) => setError(reason.message))
  }, [id])

  if (error) return <><Link href="/orders" className="text-sm text-zinc-500">← Заказы</Link><ErrorAlert>{error}</ErrorAlert></>
  if (!order) return <Loading label="Загружаем заказ…" />

  const canEdit = order.creatorId === user?.id || order.members.some((member) => member.id === user?.id && member.canEdit)
  const addressQuery = encodeURIComponent(order.address || '')
  const mapPreview = order.addressLat !== null && order.addressLng !== null
    ? `https://yandex.ru/map-widget/v1/?pt=${order.addressLng},${order.addressLat},pm2rdm&z=16`
    : `https://yandex.ru/map-widget/v1/?text=${addressQuery}&z=16`
  const groupedActivities = activities.reduce<(OrderActivity & { count: number })[]>((groups, activity) => {
    const previous = groups[groups.length - 1]
    if (previous && previous.body === activity.body && previous.user?.id === activity.user?.id) previous.count += 1
    else groups.push({ ...activity, count: 1 })
    return groups
  }, [])
  const maps = [
    { label: 'Яндекс', url: `https://yandex.ru/maps/?text=${addressQuery}` },
    { label: 'Google', url: `https://www.google.com/maps/search/?api=1&query=${addressQuery}` },
    { label: '2ГИС', url: `https://2gis.ru/search/${addressQuery}` },
  ]

  async function removeOrder() {
    if (!window.confirm(`Удалить заказ «${order!.title}»? Задачи, сообщения и изображения также будут удалены.`)) return
    try {
      await api(`/orders/${order!.id}`, { method: 'DELETE' })
      navigate('/orders')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить заказ') }
  }

  async function attachPriceList(priceListId: string | null) {
    const result = await api<Pick<OrderDetails, 'priceList' | 'priceTotal'>>(`/orders/${order!.id}/price-list`, { method: 'PATCH', body: jsonBody({ priceListId }) })
    setOrder({ ...order!, ...result, priceListId })
  }

  async function togglePriceItem(itemId: string, completed: boolean) {
    const result = await api<Pick<OrderDetails, 'priceList' | 'priceTotal'>>(`/orders/${order!.id}/price-items/${itemId}`, { method: 'PATCH', body: jsonBody({ completed }) })
    setOrder({ ...order!, ...result })
  }

  async function openActivities() {
    setActivitiesOpen(true)
    setActivities(await api<OrderActivity[]>(`/orders/${order!.id}/activities`))
  }

  return (
    <>
      <div className="max-lg:hidden"><Link href="/orders" className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400"><ChevronLeftIcon className="size-4 fill-zinc-400" />Заказы</Link></div>
      <div className="mt-4 lg:mt-8">
        <div className="flex flex-wrap items-center gap-4"><Heading>{order.title}</Heading><Badge color={statusColors[order.status]}>{statusLabels[order.status]}</Badge></div>
        <div className="isolate mt-4 flex flex-wrap justify-between gap-x-6 gap-y-4">
          <div className="flex flex-wrap gap-x-8 gap-y-4 py-1.5"><span className="flex items-center gap-3 text-sm/6"><BanknotesIcon className="size-4 fill-zinc-400" />Общая: {formatMoney(order.amount)}</span><span className="text-sm/6 text-zinc-500">Аванс: {formatMoney(order.advanceAmount)}</span><span className="text-sm/6 text-zinc-500">Доплата: {formatMoney(Math.max(0, order.amount - order.advanceAmount))}</span><span className="text-sm/6 text-zinc-500">Сборка: {formatMoney(order.assemblyAmount ?? order.amount * 0.1)}</span><span className="flex items-center gap-3 text-sm/6"><UserIcon className="size-4 fill-zinc-400" />{order.client.name}{order.client.callSign ? ` · ${order.client.callSign}` : ''}</span><span className="flex items-center gap-3 text-sm/6"><CalendarIcon className="size-4 fill-zinc-400" />{order.nearestDeadline ? formatDate(order.nearestDeadline) : 'Задач нет'}</span></div>
          <div className="flex flex-wrap gap-3"><Button outline onClick={() => setInfoOpen(true)}><InformationCircleIcon />Информация</Button><Button outline onClick={() => setChatOpen(true)}><ChatBubbleLeftRightIcon />Чат</Button><Button outline onClick={() => void openActivities()}><ClockIcon />История</Button><Button outline onClick={() => setPriceOpen(true)}><DocumentTextIcon />Прайс-лист</Button>{canEdit && <Button outline onClick={() => setEditing(true)}><PencilSquareIcon />Изменить</Button>}{order.creatorId === user?.id && <Button plain aria-label="Удалить заказ" onClick={() => void removeOrder()}><TrashIcon /></Button>}</div>
        </div>
      </div>
      <ErrorAlert>{error}</ErrorAlert>

      {order.address && <section className="mt-12"><Subheading>Адрес</Subheading><Divider className="mt-4 mb-6" /><div className="flex flex-wrap items-center gap-3 text-sm"><MapPinIcon className="size-5 text-zinc-400" /><span className="font-medium">{order.address}</span><span className="flex flex-wrap gap-2">{maps.map((map) => <a key={map.label} href={map.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-zinc-950/10 px-3 py-2 font-medium text-zinc-950 shadow-sm hover:bg-zinc-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5"><MapPinIcon className="size-4 text-blue-500" />{map.label}</a>)}</span></div><iframe title="Карта с адресом заказа" src={mapPreview} className="mt-4 h-80 w-full rounded-xl border-0 ring-1 ring-zinc-950/10 dark:ring-white/10" loading="lazy" allowFullScreen /></section>}

      <section className="mt-12"><Subheading>Задачи</Subheading><Divider className="mt-4 mb-6" /><TaskList orderId={order.id} tasks={order.tasks} users={order.members} onChange={(tasks) => setOrder({ ...order, tasks })} /></section>

      <SidePanel open={priceOpen} onClose={() => setPriceOpen(false)} title="Прайс-лист" subtitle={order.title}>
        <div className="mb-6 flex flex-wrap gap-3">{order.priceList && <><Button outline onClick={() => setPricePreviewOpen(true)}><DocumentTextIcon />Предпросмотр</Button><Button outline onClick={() => window.print()}><PrinterIcon />Печать</Button></>}</div>
        {canEdit && <div className="mb-6 flex flex-wrap gap-3"><Select aria-label="Прикрепить прайс-лист" className="max-w-md" value={order.priceListId || ''} onChange={(e) => void attachPriceList(e.target.value || null)}><option value="">Не прикреплён</option>{priceLists.map((list) => <option key={list.id} value={list.id}>{list.title}</option>)}</Select><Link href="/price-lists" className="self-center text-sm text-zinc-500">Управление списками →</Link></div>}
        {order.priceList ? <><h3 className="text-sm font-semibold">{order.priceList.title}</h3><div className="mt-4 divide-y divide-zinc-950/5 dark:divide-white/5">{order.priceList.items.filter((item) => item.kind !== 'divider').map((item) => <label key={item.id} className="flex items-center gap-3 py-3 text-sm"><Checkbox checked={Boolean(item.completed)} onChange={(checked) => void togglePriceItem(item.id, checked)} /><span className="min-w-0 flex-1"><span className={item.completed ? 'line-through opacity-60' : ''}>{item.name}</span><span className="block text-xs text-zinc-500">{item.category}</span></span><span className="shrink-0">{formatMoney(item.price)}</span></label>)}</div><div className="mt-4 flex justify-end text-lg font-semibold">Итого: {formatMoney(order.priceTotal)}</div></> : <p className="text-sm text-zinc-500">Прайс-лист не прикреплён.</p>}
      </SidePanel>
      <Dialog open={pricePreviewOpen} onClose={() => setPricePreviewOpen(false)} size="4xl" zIndex={70}><DialogTitle>Предпросмотр печати</DialogTitle><DialogBody>{order.priceList && <PriceListDocument title={order.priceList.printTitle || order.priceList.title} notes={order.priceList.notes} items={order.priceList.items} completedOnly />}</DialogBody></Dialog>

      <section className="mt-12"><Subheading>Изображения</Subheading><Divider className="mt-4 mb-6" /><ImageGallery orderId={order.id} creatorId={order.creatorId} images={order.images} onChange={(images) => setOrder({ ...order, images })} /></section>

      <SidePanel open={infoOpen} onClose={() => setInfoOpen(false)} title={order.title} subtitle="Подробная информация"><DescriptionList>
        <DescriptionTerm>Описание</DescriptionTerm><DescriptionDetails className="whitespace-pre-wrap">{order.description || 'Описание не добавлено'}</DescriptionDetails>
        {order.address && <><DescriptionTerm>Адрес</DescriptionTerm><DescriptionDetails>{order.address}</DescriptionDetails></>}
        <DescriptionTerm>Клиент</DescriptionTerm><DescriptionDetails>{order.client.name}{order.client.callSign ? ` · ${order.client.callSign}` : ''}<span className="mt-1 block text-xs text-zinc-500">{[order.client.email, order.client.phone].filter(Boolean).join(' · ')}</span></DescriptionDetails>
        <DescriptionTerm>Создатель</DescriptionTerm><DescriptionDetails>{order.creator.name}</DescriptionDetails>
        <DescriptionTerm>Участники</DescriptionTerm><DescriptionDetails><div className="flex flex-wrap gap-2">{order.members.map((member) => <span key={member.id} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 py-1 pr-3 pl-1 text-xs dark:bg-zinc-800"><UserAvatar user={member} className="size-5" />{member.name}</span>)}</div></DescriptionDetails>
        <DescriptionTerm>Создан</DescriptionTerm><DescriptionDetails>{formatDate(order.createdAt)}</DescriptionDetails>
      </DescriptionList></SidePanel>
      <SidePanel open={chatOpen} onClose={() => setChatOpen(false)} title={`Чат · ${order.title}`} subtitle="Сообщения и файлы заказа" scroll={false}><ChatBox orderId={order.id} /></SidePanel>
      <SidePanel open={activitiesOpen} onClose={() => setActivitiesOpen(false)} title="История заказа" subtitle={order.title}><div className="relative ml-2 space-y-6 before:absolute before:inset-y-2 before:left-3 before:w-px before:bg-zinc-200 dark:before:bg-zinc-700">{groupedActivities.length === 0 ? <p className="pl-10 text-sm text-zinc-500">Действий пока нет.</p> : groupedActivities.map((activity) => <div key={activity.id} className="relative flex gap-4"><span className="z-10 mt-1">{activity.user ? <UserAvatar user={activity.user} className="size-7" /> : <span className="block size-7 rounded-full bg-zinc-300" />}</span><div className="min-w-0 flex-1 rounded-lg border border-zinc-950/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900"><div className="text-sm"><span className="font-medium">{activity.user?.name || 'Система'}</span> {activity.body}{activity.count > 1 && <Badge color="zinc" className="ml-2">×{activity.count}</Badge>}</div><div className="mt-1 text-xs text-zinc-500">{formatDateTime(activity.createdAt)}</div></div></div>)}</div></SidePanel>
      <OrderFormDialog open={editing} onClose={() => setEditing(false)} order={order} users={users} onSaved={(updated) => setOrder({ ...order, ...updated })} />
    </>
  )
}
