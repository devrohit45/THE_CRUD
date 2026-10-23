import { Navigate, Outlet } from 'react-router-dom'
import { useSelector } from 'react-redux'

export function RequireAuth() {
  const status = useSelector((state) => state.auth.status)

  if (status === 'checking') {
    return <main className="auth-loading"><span className="loader" /> Checking your session...</main>
  }

  return status === 'authenticated' ? <Outlet /> : <Navigate replace to="/login" />
}

export function GuestOnly() {
  const status = useSelector((state) => state.auth.status)

  if (status === 'checking') {
    return <main className="auth-loading"><span className="loader" /> Checking your session...</main>
  }

  return status === 'authenticated' ? <Navigate replace to="/files" /> : <Outlet />
}
