import { useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyForm = { title: '', description: '', type: 'image', file: null }

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

async function readError(response) {
  const body = await response.json().catch(() => ({}))
  const validationMessage = body.errors
    ? Object.values(body.errors).flat().join(' ')
    : null
  return validationMessage || body.message || 'The request could not be completed.'
}

function App() {
  const [files, setFiles] = useState([])
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [summary, setSummary] = useState({ total: 0, images: 0, documents: 0 })
  const [filter, setFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)
  const [csrfToken, setCsrfToken] = useState('')
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page) })
    if (filter !== 'all') params.set('type', filter)
    if (search) params.set('search', search)
    return params.toString()
  }, [filter, page, search])

  async function refreshCsrfToken() {
    const response = await fetch('/api/auth/csrf-token', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(await readError(response))
    const result = await response.json()
    setCsrfToken(result.csrf_token)
    return result.csrf_token
  }

  useEffect(() => {
    const controller = new AbortController()

    async function loadSession() {
      try {
        const csrfResponse = await fetch('/api/auth/csrf-token', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!csrfResponse.ok) throw new Error(await readError(csrfResponse))
        const csrf = await csrfResponse.json()
        setCsrfToken(csrf.csrf_token)

        const response = await fetch('/api/auth/user', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (response.ok) {
          const result = await response.json()
          setUser(result.user)
        } else if (response.status !== 401) {
          throw new Error(await readError(response))
        }
      } catch (sessionError) {
        if (!controller.signal.aborted) setError(sessionError.message)
      } finally {
        if (!controller.signal.aborted) setAuthReady(true)
      }
    }

    loadSession()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchFiles() {
      if (!authReady || !user) return

      try {
        const response = await fetch(`/api/files?${query}`, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(await readError(response))
        const result = await response.json()
        setError('')
        setFiles(result.data)
        setPagination(result.meta)
        setSummary(result.summary)
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchFiles()
    return () => controller.abort()
  }, [authReady, query, refreshToken, user])

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const token = csrfToken || await refreshCsrfToken()
      const response = await fetch(`/api/auth/${authMode}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': token,
        },
        body: JSON.stringify(authForm),
      })
      if (!response.ok) throw new Error(await readError(response))
      const result = await response.json()
      setUser(result.user)
      setAuthForm({ name: '', email: '', password: '', password_confirmation: '' })
      setNotice(authMode === 'register' ? 'Your account is ready.' : 'Welcome back.')
      setLoading(true)
      setRefreshToken((current) => current + 1)
    } catch (authError) {
      setError(authError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setError('')
    try {
      const token = csrfToken || await refreshCsrfToken()
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token },
      })
      if (!response.ok) throw new Error(await readError(response))
      setUser(null)
      setFiles([])
      setSummary({ total: 0, images: 0, documents: 0 })
      setNotice('')
      await refreshCsrfToken()
    } catch (logoutError) {
      setError(logoutError.message)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setIsModalOpen(true)
    setError('')
    setNotice('')
  }

  function openEdit(file) {
    setEditing(file)
    setIsModalOpen(true)
    setForm({
      title: file.title,
      description: file.description || '',
      type: file.type,
      file: null,
    })
    setError('')
    setNotice('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const data = new FormData()
    data.set('title', form.title.trim())
    data.set('description', form.description.trim())
    if (form.file) data.set('file', form.file)
    if (!editing) {
      data.set('type', form.type)
    } else {
      // Laravel uses this field to route a multipart POST through its update endpoint.
      data.set('_method', 'PUT')
    }

    try {
      const url = editing ? `/api/files/${editing.id}` : '/api/files'
      const token = csrfToken || await refreshCsrfToken()
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': token },
        body: data,
      })
      if (!response.ok) throw new Error(await readError(response))
      setEditing(null)
      setForm(emptyForm)
      setIsModalOpen(false)
      setNotice(editing ? 'Your changes have been saved.' : 'Your file has been added.')
      setLoading(true)
      setRefreshToken((token) => token + 1)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(file) {
    if (!window.confirm(`Delete "${file.title}" and its uploaded file?`)) return

    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrfToken },
      })
      if (!response.ok) throw new Error(await readError(response))
      setNotice('The file has been deleted.')
      setLoading(true)
      setRefreshToken((token) => token + 1)
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    setLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
  }

  if (!authReady) {
    return <main className="auth-loading"><span className="loader" /> Checking your session...</main>
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <a className="brand auth-brand" href="/" aria-label="FileNest home">
            <span className="brand-mark" aria-hidden="true">F</span><span>filenest</span>
          </a>
          <p className="eyebrow">{authMode === 'register' ? 'CREATE YOUR ACCOUNT' : 'YOUR PRIVATE LIBRARY'}</p>
          <h1>{authMode === 'register' ? 'Make room for what matters.' : 'Welcome back.'}</h1>
          <p className="auth-subtitle">
            {authMode === 'register'
              ? 'Create an account to keep your files safe and organized.'
              : 'Sign in to continue to your images and documents.'}
          </p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form className="file-form auth-form" onSubmit={handleAuthSubmit}>
            {authMode === 'register' && (
              <label>
                Name
                <input autoComplete="name" onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required value={authForm.name} />
              </label>
            )}
            <label>
              Email
              <input autoComplete="email" onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required type="email" value={authForm.email} />
            </label>
            <label>
              Password
              <input autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength="8" onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required type="password" value={authForm.password} />
            </label>
            {authMode === 'register' && (
              <label>
                Confirm password
                <input autoComplete="new-password" onChange={(event) => setAuthForm({ ...authForm, password_confirmation: event.target.value })} required type="password" value={authForm.password_confirmation} />
              </label>
            )}
            <button className="button button-primary auth-submit" disabled={saving} type="submit">
              {saving ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <p className="auth-switch">
            {authMode === 'register' ? 'Already have an account?' : 'New to FileNest?'}
            <button onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setError('') }} type="button">
              {authMode === 'register' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FileNest home">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>filenest</span>
        </a>
        <span className="topbar-caption">Workspace / File library</span>
        <div className="account-menu">
          <span className="account-name">{user.name}</span>
          <button className="signout-button" onClick={handleLogout} type="button">Sign out</button>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>File library</h1>
          <p className="subtitle">Keep your images and important documents in one tidy place.</p>
        </div>
        <button className="button button-primary" onClick={openCreate} type="button">
          <span aria-hidden="true">＋</span> Add a file
        </button>
      </section>

      <section className="summary-row" aria-label="Library summary">
        <div className="summary-card">
          <span className="summary-icon icon-purple" aria-hidden="true">▧</span>
          <div><span className="summary-label">All files</span><strong>{summary.total}</strong></div>
        </div>
        <div className="summary-card">
          <span className="summary-icon icon-peach" aria-hidden="true">▣</span>
          <div><span className="summary-label">Images</span><strong>{summary.images}</strong></div>
        </div>
        <div className="summary-card summary-note">
          <span className="note-sparkle" aria-hidden="true">✦</span>
          <div><strong>Ready for a fresh start?</strong><span className="summary-label">Upload an image or document to get going.</span></div>
        </div>
      </section>

      <section className="library-panel" aria-label="Files">
        <div className="library-header">
          <div>
            <h2>All your files <span className="count-badge">{pagination.total}</span></h2>
            <p>Browse, update, and download your uploads.</p>
          </div>
          <form className="search-form" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="file-search">Search files</label>
            <span aria-hidden="true">⌕</span>
            <input
              id="file-search"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search files..."
              value={searchInput}
            />
            <button type="submit" aria-label="Submit search">Search</button>
          </form>
        </div>

        <div className="toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter files">
            {[
              ['all', 'All files'],
              ['image', 'Images'],
              ['document', 'Documents'],
            ].map(([value, label]) => (
              <button
                aria-pressed={filter === value}
                className={filter === value ? 'filter-tab selected' : 'filter-tab'}
                key={value}
                onClick={() => { setLoading(true); setFilter(value); setPage(1) }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <span className="sort-label">Newest first <span aria-hidden="true">⌄</span></span>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}

        {loading ? (
          <div className="empty-state"><span className="loader" /> Loading your files...</div>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">▤</span>
            <h3>{search ? 'No matching files' : 'Nothing here just yet'}</h3>
            <p>{search ? 'Try another search or clear the filter.' : 'Add your first image or document to start building your library.'}</p>
            {!search && <button className="button button-primary" onClick={openCreate} type="button">Add a file</button>}
          </div>
        ) : (
          <div className="file-grid">
            {files.map((file) => (
              <article className="file-card" key={file.id}>
                <div className={`file-preview ${file.type === 'image' ? 'image-preview' : 'document-preview'}`}>
                  {file.type === 'image' ? (
                    <img alt={file.title} loading="lazy" src={file.content_url} />
                  ) : (
                    <span className="document-art" aria-hidden="true">
                      <span className="document-fold" />
                      <span className="document-lines" />
                      <span className="document-extension">{file.original_name.split('.').pop().toUpperCase()}</span>
                    </span>
                  )}
                  <span className={`type-chip ${file.type}`}>{file.type === 'image' ? 'Image' : 'Document'}</span>
                </div>
                <div className="file-details">
                  <div className="file-title-row">
                    <h3 title={file.title}>{file.title}</h3>
                    <span className="more-mark" aria-hidden="true">•••</span>
                  </div>
                  <p className="file-description">{file.description || file.original_name}</p>
                  <div className="file-meta">
                    <span>{formatBytes(file.size)}</span><span className="meta-dot">·</span>
                    <time dateTime={file.created_at}>{new Date(file.created_at).toLocaleDateString()}</time>
                  </div>
                  <div className="file-actions">
                    <a className="text-action" href={file.download_url}>Download <span aria-hidden="true">↓</span></a>
                    <button className="icon-action" onClick={() => openEdit(file)} type="button" aria-label={`Edit ${file.title}`}>Edit</button>
                    <button className="icon-action delete-action" onClick={() => handleDelete(file)} type="button" aria-label={`Delete ${file.title}`}>Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {pagination.last_page > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button disabled={page <= 1} onClick={() => { setLoading(true); setPage(page - 1) }} type="button">← Previous</button>
            <span>Page {pagination.current_page} of {pagination.last_page}</span>
            <button disabled={page >= pagination.last_page} onClick={() => { setLoading(true); setPage(page + 1) }} type="button">Next →</button>
          </nav>
        )}
      </section>
      <footer className="page-footer">A quieter place for the files that matter.</footer>

      {isModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) {
            setEditing(null)
            setForm(emptyForm)
            setIsModalOpen(false)
          }
        }}>
          <section aria-labelledby="modal-title" aria-modal="true" className="modal" role="dialog">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">{editing ? 'FILE DETAILS' : 'NEW UPLOAD'}</p>
                <h2 id="modal-title">{editing ? 'Edit file' : 'Add a file'}</h2>
              </div>
              <button className="close-button" onClick={() => { setEditing(null); setForm(emptyForm); setIsModalOpen(false) }} type="button" aria-label="Close dialog">×</button>
            </div>
            <form className="file-form" onSubmit={handleSubmit}>
              <label>
                Title
                <input
                  maxLength="150"
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Give this file a name"
                  required
                  value={form.title}
                />
              </label>
              <label>
                Description <span className="optional-label">Optional</span>
                <textarea
                  maxLength="2000"
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Add a note about this file"
                  rows="3"
                  value={form.description}
                />
              </label>
              {!editing && (
                <label>
                  File type
                  <select onChange={(event) => setForm({ ...form, type: event.target.value, file: null })} value={form.type}>
                    <option value="image">Image</option>
                    <option value="document">Document</option>
                  </select>
                </label>
              )}
              <label className="upload-label">
                {editing ? 'Replace file' : 'Choose file'}
                {editing && <span className="optional-label">Optional</span>}
                <input
                  accept={form.type === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'}
                  onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })}
                  required={!editing}
                  type="file"
                />
                <span className="upload-hint">
                  {form.file ? form.file.name : form.type === 'image' ? 'JPG, PNG, WEBP or GIF · up to 10 MB' : 'PDF, Office, TXT or CSV · up to 20 MB'}
                </span>
              </label>
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <div className="modal-actions">
                <button className="button button-quiet" onClick={() => { setEditing(null); setForm(emptyForm); setIsModalOpen(false) }} type="button">Cancel</button>
                <button className="button button-primary" disabled={saving} type="submit">
                  {saving ? 'Saving...' : editing ? 'Save changes' : 'Upload file'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
