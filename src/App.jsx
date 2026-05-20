import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL
const TOKEN_KEY = 'caudal_auth_token'

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
  })
  const [loading, setLoading] = useState(Boolean(token))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const api = useMemo(() => {
    return axios.create({
      baseURL: API_URL,
      headers: token ? { Authorization: `Token ${token}` } : {},
    })
  }, [token])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    api.get('/api/auth/me/')
      .then(({ data }) => {
        setUser(data.user)
        setError('')
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
        setError('Tu sesion expiro. Ingresa nuevamente.')
      })
      .finally(() => setLoading(false))
  }, [api, token])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { data } = await axios.post(`${API_URL}/api/auth/login/`, {
        username: form.username,
        password: form.password,
      })
      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setUser(data.user)
      resetForm()
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos iniciar sesion.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const { data } = await axios.post(`${API_URL}/api/auth/register/`, form)
      resetForm()
      setIsRegistering(false)
      setSuccess(data.detail)
    } catch (err) {
      setError(err.response?.data?.detail || 'No pudimos crear la cuenta.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setForm({
      username: '',
      password: '',
      email: '',
      first_name: '',
      last_name: '',
    })
  }

  const toggleMode = () => {
    setIsRegistering((currentValue) => !currentValue)
    setError('')
    setSuccess('')
    resetForm()
  }

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout/')
    } catch {
      // If the backend token already expired, clear the frontend session anyway.
    } finally {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      setError('')
    }
  }

  if (loading) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Caudal</p>
          <h1>Cargando sesion...</h1>
        </section>
      </main>
    )
  }

  if (user) {
    return (
      <main className="home-page">
        <nav className="topbar">
          <strong>Caudal</strong>
          <button className="ghost-button" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </nav>

        <section className="welcome">
          <p className="eyebrow">Inicio</p>
          <h1>Bienvenido, {user.display_name}</h1>
          <p>
            Has iniciado sesion correctamente con el usuario{' '}
            <strong>{user.username}</strong>.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div>
          <p className="eyebrow">Caudal</p>
          <h1>{isRegistering ? 'Crea tu cuenta' : 'Inicia sesion'}</h1>
          <p className="muted">
            {isRegistering
              ? 'El administrador revisara tu cuenta antes de darte acceso.'
              : 'Ingresa tus credenciales para acceder al panel de control de mediciones.'}
          </p>
        </div>

        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="login-form">
          {isRegistering && (
            <div className="name-grid">
              <label>
                Nombre
                <input
                  autoComplete="given-name"
                  name="first_name"
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  type="text"
                  value={form.first_name}
                />
              </label>

              <label>
                Apellido
                <input
                  autoComplete="family-name"
                  name="last_name"
                  onChange={handleChange}
                  placeholder="Tu apellido"
                  type="text"
                  value={form.last_name}
                />
              </label>
            </div>
          )}

          <label>
            Usuario
            <input
              autoComplete="username"
              name="username"
              onChange={handleChange}
              placeholder="Tu nombre de usuario"
              type="text"
              value={form.username}
            />
          </label>

          {isRegistering && (
            <label>
              Correo
              <input
                autoComplete="email"
                name="email"
                onChange={handleChange}
                placeholder="correo@ejemplo.com"
                type="email"
                value={form.email}
              />
            </label>
          )}

          <label>
            Contrasena
            <input
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              name="password"
              onChange={handleChange}
              placeholder="Tu contrasena"
              type="password"
              value={form.password}
            />
          </label>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}

          <button disabled={submitting} type="submit">
            {submitting
              ? isRegistering ? 'Creando...' : 'Ingresando...'
              : isRegistering ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <button className="link-button" onClick={toggleMode} type="button">
          {isRegistering ? 'Ya tengo una cuenta' : 'No tengo cuenta, crear una'}
        </button>
      </section>
    </main>
  )
}

export default App
