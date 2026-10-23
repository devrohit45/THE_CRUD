import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { registerAccount, signIn } from '../store/slices/authSlice'

const initialForm = { name: '', email: '', password: '', password_confirmation: '' }

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { error, status } = useSelector((state) => state.auth)
  const [form, setForm] = useState(initialForm)
  const isSubmitting = status === 'loading'

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      if (isRegister) {
        await dispatch(registerAccount(form)).unwrap()
      } else {
        await dispatch(signIn({ email: form.email, password: form.password })).unwrap()
      }
      navigate('/files', { replace: true })
    } catch {
      // The rejected async thunk stores the API error in the auth slice for display.
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" to="/" aria-label="FileNest home">
          <span className="brand-mark" aria-hidden="true">F</span><span>filenest</span>
        </Link>
        <p className="eyebrow">{isRegister ? 'CREATE YOUR ACCOUNT' : 'YOUR PRIVATE LIBRARY'}</p>
        <h1>{isRegister ? 'Make room for what matters.' : 'Welcome back.'}</h1>
        <p className="auth-subtitle">
          {isRegister
            ? 'Create an account to keep your files safe and organized.'
            : 'Sign in to continue to your images and documents.'}
        </p>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <form className="file-form auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              Name
              <input
                autoComplete="name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
          )}
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength="8"
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              type="password"
              value={form.password}
            />
          </label>
          {isRegister && (
            <label>
              Confirm password
              <input
                autoComplete="new-password"
                onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })}
                required
                type="password"
                value={form.password_confirmation}
              />
            </label>
          )}
          <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? 'Already have an account?' : 'New to FileNest?'}
          {isRegister
            ? <Link to="/login">Sign in</Link>
            : <Link to="/register">Create an account</Link>}
        </p>
      </section>
    </main>
  )
}
