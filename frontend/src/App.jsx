import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import FileLibraryPage from './pages/FileLibraryPage'
import { GuestOnly, RequireAuth } from './components/RouteGuards'
import { initializeAuth } from './store/slices/authSlice'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import './App.css'

function HomeRedirect() {
  const status = useSelector((state) => state.auth.status)
  return <Navigate replace to={status === 'authenticated' ? '/files' : '/login'} />
}

export default function App() {
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(initializeAuth())
  }, [dispatch])

  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/files" element={<FileLibraryPage />} />
      </Route>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
