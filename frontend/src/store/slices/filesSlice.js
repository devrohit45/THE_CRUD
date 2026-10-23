import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiRequest, apiRequestWithCsrf } from '../../services/api'

const initialState = {
  items: [],
  pagination: { current_page: 1, last_page: 1, total: 0 },
  summary: { total: 0, images: 0, documents: 0 },
  filter: 'all',
  search: '',
  page: 1,
  status: 'idle',
  saving: false,
  error: '',
  notice: '',
}

export const fetchFiles = createAsyncThunk(
  'files/fetch',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { files } = getState()
      const params = new URLSearchParams({ page: String(files.page) })
      if (files.filter !== 'all') params.set('type', files.filter)
      if (files.search) params.set('search', files.search)
      const result = await apiRequest(`/files?${params}`)
      return result
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const saveFile = createAsyncThunk(
  'files/save',
  async ({ fileId, values, upload }, { getState, rejectWithValue }) => {
    try {
      const data = new FormData()
      data.set('title', values.title.trim())
      data.set('description', values.description.trim())
      if (upload) data.set('file', upload)
      if (fileId) {
        data.set('_method', 'PUT')
      } else {
        data.set('type', values.type)
      }

      const path = fileId ? `/files/${fileId}` : '/files'
      return await apiRequestWithCsrf(path, {
        method: 'POST',
        body: data,
      }, getState().auth.csrfToken)
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const deleteFile = createAsyncThunk(
  'files/delete',
  async (file, { getState, rejectWithValue }) => {
    try {
      await apiRequestWithCsrf(`/files/${file.id}`, {
        method: 'DELETE',
      }, getState().auth.csrfToken)
      return file.id
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

const filesSlice = createSlice({
  name: 'files',
  initialState,
  reducers: {
    setFilter(state, action) {
      state.filter = action.payload
      state.page = 1
    },
    setSearch(state, action) {
      state.search = action.payload
      state.page = 1
    },
    setPage(state, action) {
      state.page = action.payload
    },
    clearFilesError(state) {
      state.error = ''
    },
    clearFilesNotice(state) {
      state.notice = ''
    },
    resetFiles: () => initialState,
  },
  extraReducers(builder) {
    builder
      .addCase(fetchFiles.pending, (state) => {
        state.status = 'loading'
        state.error = ''
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.status = 'idle'
        state.items = action.payload.data
        state.pagination = action.payload.meta
        state.summary = action.payload.summary
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload || 'Could not load your files.'
      })
      .addCase(saveFile.pending, (state) => {
        state.saving = true
        state.error = ''
      })
      .addCase(saveFile.fulfilled, (state) => {
        state.saving = false
        state.notice = 'Your file changes have been saved.'
      })
      .addCase(saveFile.rejected, (state, action) => {
        state.saving = false
        state.error = action.payload || 'Could not save this file.'
      })
      .addCase(deleteFile.fulfilled, (state) => {
        state.notice = 'The file has been deleted.'
      })
      .addCase(deleteFile.rejected, (state, action) => {
        state.error = action.payload || 'Could not delete this file.'
      })
  },
})

export const {
  clearFilesError,
  clearFilesNotice,
  resetFiles,
  setFilter,
  setPage,
  setSearch,
} = filesSlice.actions

export default filesSlice.reducer
