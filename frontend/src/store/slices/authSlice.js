import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiRequest, apiRequestWithCsrf, getCsrfToken } from '../../services/api'

export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const csrfToken = await getCsrfToken()
      try {
        const result = await apiRequest('/auth/user')
        return { csrfToken, user: result.user }
      } catch (error) {
        if (error.status === 401) return { csrfToken, user: null }
        throw error
      }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const signIn = createAsyncThunk(
  'auth/signIn',
  async (credentials, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState()
      const result = await apiRequestWithCsrf('/auth/login', {
        method: 'POST',
        body: credentials,
      }, auth.csrfToken)
      return { user: result.user, csrfToken: auth.csrfToken || await getCsrfToken() }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const registerAccount = createAsyncThunk(
  'auth/register',
  async (account, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState()
      const result = await apiRequestWithCsrf('/auth/register', {
        method: 'POST',
        body: account,
      }, auth.csrfToken)
      return { user: result.user, csrfToken: auth.csrfToken || await getCsrfToken() }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { getState, rejectWithValue }) => {
    try {
      await apiRequestWithCsrf('/auth/logout', { method: 'POST' }, getState().auth.csrfToken)
      const csrfToken = await getCsrfToken()
      return { csrfToken }
    } catch (error) {
      return rejectWithValue(error.message)
    }
  },
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    csrfToken: '',
    status: 'checking',
    error: '',
  },
  reducers: {
    clearAuthError(state) {
      state.error = ''
    },
  },
  extraReducers(builder) {
    builder
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.csrfToken = action.payload.csrfToken
        state.status = action.payload.user ? 'authenticated' : 'unauthenticated'
        state.error = ''
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.status = 'unauthenticated'
        state.error = action.payload || 'Could not check your session.'
      })
      .addCase(signIn.pending, (state) => {
        state.status = 'loading'
        state.error = ''
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.csrfToken = action.payload.csrfToken
        state.status = 'authenticated'
      })
      .addCase(signIn.rejected, (state, action) => {
        state.status = 'unauthenticated'
        state.error = action.payload || 'Could not sign in.'
      })
      .addCase(registerAccount.pending, (state) => {
        state.status = 'loading'
        state.error = ''
      })
      .addCase(registerAccount.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.csrfToken = action.payload.csrfToken
        state.status = 'authenticated'
      })
      .addCase(registerAccount.rejected, (state, action) => {
        state.status = 'unauthenticated'
        state.error = action.payload || 'Could not create your account.'
      })
      .addCase(signOut.fulfilled, (state, action) => {
        state.user = null
        state.csrfToken = action.payload.csrfToken
        state.status = 'unauthenticated'
        state.error = ''
      })
      .addCase(signOut.rejected, (state, action) => {
        state.error = action.payload || 'Could not sign out.'
      })
  },
})

export const { clearAuthError } = authSlice.actions
export default authSlice.reducer
