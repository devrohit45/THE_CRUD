import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  clearFilesError,
  clearFilesNotice,
  deleteFile,
  fetchFiles,
  resetFiles,
  saveFile,
  setFilter,
  setPage,
  setSearch,
} from '../store/slices/filesSlice'
import { signOut } from '../store/slices/authSlice'

const emptyForm = { title: '', description: '', type: 'image', file: null }

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function FileCard({ file, onEdit, onDelete }) {
  return (
    <article className="file-card">
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
          <button className="icon-action" onClick={() => onEdit(file)} type="button" aria-label={`Edit ${file.title}`}>Edit</button>
          <button className="icon-action delete-action" onClick={() => onDelete(file)} type="button" aria-label={`Delete ${file.title}`}>Delete</button>
        </div>
      </div>
    </article>
  )
}

function FileFormModal({ editing, form, saving, error, onChange, onClose, onSubmit }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <section aria-labelledby="modal-title" aria-modal="true" className="modal" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{editing ? 'FILE DETAILS' : 'NEW UPLOAD'}</p>
            <h2 id="modal-title">{editing ? 'Edit file' : 'Add a file'}</h2>
          </div>
          <button className="close-button" onClick={onClose} type="button" aria-label="Close dialog">×</button>
        </div>
        <form className="file-form" onSubmit={onSubmit}>
          <label>
            Title
            <input
              maxLength="150"
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="Give this file a name"
              required
              value={form.title}
            />
          </label>
          <label>
            Description <span className="optional-label">Optional</span>
            <textarea
              maxLength="2000"
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder="Add a note about this file"
              rows="3"
              value={form.description}
            />
          </label>
          {!editing && (
            <label>
              File type
              <select onChange={(event) => onChange({ ...form, type: event.target.value, file: null })} value={form.type}>
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
              onChange={(event) => onChange({ ...form, file: event.target.files?.[0] || null })}
              required={!editing}
              type="file"
            />
            <span className="upload-hint">
              {form.file ? form.file.name : form.type === 'image' ? 'JPG, PNG, WEBP or GIF · up to 10 MB' : 'PDF, Office, TXT or CSV · up to 20 MB'}
            </span>
          </label>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="modal-actions">
            <button className="button button-quiet" onClick={onClose} type="button">Cancel</button>
            <button className="button button-primary" disabled={saving} type="submit">
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Upload file'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default function FileLibraryPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const authError = useSelector((state) => state.auth.error)
  const {
    items,
    pagination,
    summary,
    filter,
    search,
    page,
    status,
    saving,
    error,
    notice,
  } = useSelector((state) => state.files)
  const [searchInput, setSearchInput] = useState(search)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchFiles())
  }, [dispatch, filter, page, search])

  function openCreate() {
    dispatch(clearFilesError())
    dispatch(clearFilesNotice())
    setEditing(null)
    setForm(emptyForm)
    setIsModalOpen(true)
  }

  function openEdit(file) {
    dispatch(clearFilesError())
    dispatch(clearFilesNotice())
    setEditing(file)
    setForm({
      title: file.title,
      description: file.description || '',
      type: file.type,
      file: null,
    })
    setIsModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const { file, ...values } = form
    try {
      await dispatch(saveFile({ fileId: editing?.id, values, upload: file })).unwrap()
      setIsModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
      dispatch(fetchFiles())
    } catch {
      // The rejected async thunk stores the API error in the files slice.
    }
  }

  async function handleDelete(file) {
    if (!window.confirm(`Delete "${file.title}" and its uploaded file?`)) return
    dispatch(clearFilesError())
    dispatch(clearFilesNotice())
    try {
      await dispatch(deleteFile(file)).unwrap()
      dispatch(fetchFiles())
    } catch {
      // The rejected async thunk stores the API error in the files slice.
    }
  }

  async function handleSignOut() {
    try {
      await dispatch(signOut()).unwrap()
      dispatch(resetFiles())
      navigate('/login', { replace: true })
    } catch {
      // The rejected async thunk stores the API error in the auth slice.
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    dispatch(setSearch(searchInput.trim()))
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="FileNest home">
          <span className="brand-mark" aria-hidden="true">F</span><span>filenest</span>
        </Link>
        <span className="topbar-caption">Workspace / File library</span>
        <div className="account-menu">
          <span className="account-name">{user?.name}</span>
          <button className="signout-button" onClick={handleSignOut} type="button">Sign out</button>
        </div>
      </header>

      {(error || authError) && <div className="alert alert-error page-alert" role="alert">{error || authError}</div>}
      {notice && <div className="alert alert-success page-alert" role="status">{notice}</div>}

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
                onClick={() => dispatch(setFilter(value))}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <span className="sort-label">Newest first <span aria-hidden="true">⌄</span></span>
        </div>

        {status === 'loading' ? (
          <div className="empty-state"><span className="loader" /> Loading your files...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">▤</span>
            <h3>{search ? 'No matching files' : 'Nothing here just yet'}</h3>
            <p>{search ? 'Try another search or clear the filter.' : 'Add your first image or document to start building your library.'}</p>
            {!search && <button className="button button-primary" onClick={openCreate} type="button">Add a file</button>}
          </div>
        ) : (
          <div className="file-grid">
            {items.map((file) => (
              <FileCard file={file} key={file.id} onDelete={handleDelete} onEdit={openEdit} />
            ))}
          </div>
        )}

        {pagination.last_page > 1 && (
          <nav className="pagination" aria-label="Pagination">
            <button disabled={page <= 1} onClick={() => dispatch(setPage(page - 1))} type="button">← Previous</button>
            <span>Page {pagination.current_page} of {pagination.last_page}</span>
            <button disabled={page >= pagination.last_page} onClick={() => dispatch(setPage(page + 1))} type="button">Next →</button>
          </nav>
        )}
      </section>
      <footer className="page-footer">A quieter place for the files that matter.</footer>

      {isModalOpen && (
        <FileFormModal
          editing={editing}
          error={error}
          form={form}
          onChange={setForm}
          onClose={() => { setIsModalOpen(false); setEditing(null); dispatch(clearFilesError()) }}
          onSubmit={handleSubmit}
          saving={saving}
        />
      )}
    </main>
  )
}
