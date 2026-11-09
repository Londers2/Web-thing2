import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
  UserCircleIcon,
} from '@heroicons/react/16/solid'
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { api } from '../api'
import { useAuth } from '../auth'
import { useTheme, type Theme } from '../theme'
import type { Notifications } from '../types'
import { formatDateTime } from '../utils'
import { UserAvatar } from './UserAvatar'
import { Badge } from './catalyst/badge'
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem, DropdownLabel, DropdownMenu } from './catalyst/dropdown'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from './catalyst/navbar'
import { Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarHeading, SidebarItem, SidebarLabel, SidebarSection } from './catalyst/sidebar'
import { SidebarLayout } from './catalyst/sidebar-layout'

function Brand() {
  return <><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 dark:bg-white"><span className="flex h-4 w-4 flex-col justify-between py-0.5"><span className="h-0.5 rounded bg-white dark:bg-zinc-900" /><span className="h-0.5 rounded bg-white dark:bg-zinc-900" /><span className="h-0.5 w-2.5 rounded bg-white dark:bg-zinc-900" /></span></span><SidebarLabel>Порядок</SidebarLabel></>
}

export function ApplicationLayout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [notifications, setNotifications] = useState<Notifications>({ count: 0, items: [] })

  const loadNotifications = useCallback(async () => {
    try { setNotifications(await api<Notifications>('/notifications')) } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    void loadNotifications()
    const socket = io({ withCredentials: true })
    socket.on('message:new', () => void loadNotifications())
    window.addEventListener('messages:read', loadNotifications)
    return () => {
      socket.disconnect()
      window.removeEventListener('messages:read', loadNotifications)
    }
  }, [user, loadNotifications])

  if (!user) return null

  const themeOptions: Record<Theme, { label: string; icon: typeof SunIcon; next: Theme }> = {
    light: { label: 'Светлая', icon: SunIcon, next: 'dark' },
    dark: { label: 'Тёмная', icon: MoonIcon, next: 'system' },
    system: { label: 'Как в системе', icon: ComputerDesktopIcon, next: 'light' },
  }
  const themeOption = themeOptions[theme]
  const ThemeIcon = themeOption.icon

  const accountMenu = (anchor: 'top start' | 'bottom end') => (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/profile"><UserCircleIcon /><DropdownLabel>Мой профиль</DropdownLabel></DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={() => setTheme(themeOption.next)}><ThemeIcon /><DropdownLabel>Тема: {themeOption.label}</DropdownLabel></DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={() => void logout()}><ArrowRightStartOnRectangleIcon /><DropdownLabel>Выйти</DropdownLabel></DropdownItem>
    </DropdownMenu>
  )

  const notificationMenu = (anchor: 'bottom end' | 'bottom start') => (
    <DropdownMenu className="min-w-80" anchor={anchor}>
      <div className="px-3 py-2 text-sm font-semibold">Уведомления{notifications.count > 0 ? ` · ${notifications.count}` : ''}</div>
      <DropdownDivider />
      {notifications.items.length === 0 ? <div className="px-3 py-6 text-center text-sm text-zinc-500">Новых сообщений нет</div> : notifications.items.map((item) => (
        <DropdownItem key={item.id} href={item.orderId ? `/messenger?type=order&id=${item.orderId}` : `/messenger?type=direct&id=${item.sender.id}`}>
          <span className="flex min-w-0 items-center gap-2 py-1"><UserAvatar user={item.sender} className="size-7 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{item.sender.name} · {item.conversationTitle}</span><span className="block truncate text-xs text-zinc-500">{item.body}</span><span className="block text-xs text-zinc-400">{formatDateTime(item.createdAt)}</span></span></span>
        </DropdownItem>
      ))}
    </DropdownMenu>
  )

  const navigation = [
    { href: '/', label: 'Календарь', icon: CalendarDaysIcon, exact: true },
    { href: '/orders', label: 'Заказы', icon: ClipboardDocumentListIcon },
    { href: '/clients', label: 'Клиенты', icon: UserGroupIcon },
    { href: '/price-lists', label: 'Прайс-листы', icon: ClipboardDocumentListIcon },
    { href: '/messenger', label: 'Мессенджер', icon: ChatBubbleLeftRightIcon },
  ]

  return (
    <SidebarLayout
      navbar={<Navbar><NavbarSpacer /><NavbarSection><Dropdown><DropdownButton as={NavbarItem} className="relative" aria-label="Уведомления"><BellIcon />{notifications.count > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-red-500" />}</DropdownButton>{notificationMenu('bottom end')}</Dropdown><Dropdown><DropdownButton as={NavbarItem} aria-label="Меню пользователя"><UserAvatar user={user} square /></DropdownButton>{accountMenu('bottom end')}</Dropdown></NavbarSection></Navbar>}
      sidebar={<Sidebar>
        <SidebarHeader><div className="flex items-center gap-1"><div className="min-w-0 flex-1"><SidebarItem href="/"><Brand /><ChevronDownIcon className="opacity-0" /></SidebarItem></div><Dropdown><DropdownButton as={SidebarItem} className="relative" aria-label="Уведомления"><BellIcon />{notifications.count > 0 && <Badge color="red" className="absolute -top-1 -right-1 px-1.5">{notifications.count}</Badge>}</DropdownButton>{notificationMenu('bottom start')}</Dropdown></div></SidebarHeader>
        <SidebarBody><SidebarSection>{navigation.map(({ href, label, icon: Icon, exact }) => <SidebarItem key={href} href={href} current={exact ? location.pathname === href : location.pathname.startsWith(href)}><Icon /><SidebarLabel>{label}</SidebarLabel>{href === '/messenger' && notifications.count > 0 && <Badge color="red" className="ml-auto">{notifications.count}</Badge>}</SidebarItem>)}</SidebarSection>{user.role === 'admin' && <SidebarSection className="mt-6"><SidebarHeading>Администрирование</SidebarHeading><SidebarItem href="/users" current={location.pathname.startsWith('/users')}><UsersIcon /><SidebarLabel>Пользователи</SidebarLabel></SidebarItem><SidebarItem href="/settings" current={location.pathname.startsWith('/settings')}><Cog6ToothIcon /><SidebarLabel>Настройки сайта</SidebarLabel></SidebarItem></SidebarSection>}</SidebarBody>
        <SidebarFooter className="max-lg:hidden"><Dropdown><DropdownButton as={SidebarItem}><span className="flex min-w-0 items-center gap-3"><UserAvatar user={user} className="size-10" square /><span className="min-w-0"><span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">{user.name}</span><span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">{user.email}</span></span></span><ChevronUpIcon /></DropdownButton>{accountMenu('top start')}</Dropdown></SidebarFooter>
      </Sidebar>}
    >
      <Outlet />
    </SidebarLayout>
  )
}
