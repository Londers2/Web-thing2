import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { ApplicationLayout } from './components/ApplicationLayout'
import { Loading } from './components/Loading'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ClientsPage } from './pages/ClientsPage'
import { ChatPage } from './pages/ChatPage'
import { ProfilePage } from './pages/ProfilePage'
import { UsersPage } from './pages/UsersPage'
import { PriceListsPage } from './pages/PriceListsPage'
import { AdminSettingsPage } from './pages/AdminSettingsPage'

function ProtectedApp() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex min-h-svh items-center justify-center"><Loading label="Открываем рабочее пространство…" /></div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <Routes>
      <Route element={<ApplicationLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="price-lists" element={<PriceListsPage />} />
        <Route path="messenger" element={<ChatPage />} />
        <Route path="chat" element={<Navigate to="/messenger" replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="users" element={user.role === 'admin' ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="settings" element={user.role === 'admin' ? <AdminSettingsPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
