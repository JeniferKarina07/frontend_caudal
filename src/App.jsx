import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const POLLING_MS = 3000
const TOKEN_KEY = 'caudal_auth_token'

const statusLabels = {
  seco: 'Seco',
  normal: 'Normal',
  exceso: 'Exceso',
  error: 'Error',
  desconectado: 'Desconectado',
}

function formatDate(value) {
  if (!value) return 'Sin datos'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function numberValue(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function buildSeries(readings) {
  return [...readings].reverse().map((reading) => ({
    label: new Date(reading.fecha).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    value: numberValue(reading.caudal_entrada),
  }))
}

function Sparkline({ data, color = '#176b87' }) {
  const width = 640
  const height = 180
  const padding = 18
  const max = Math.max(...data.map((item) => item.value), 1)
  const points = data.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1)
    const y = height - padding - (item.value / max) * (height - padding * 2)
    return `${x},${y}`
  })

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafica de caudal">
      <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      <line x1={padding} x2={padding} y1={padding} y2={height - padding} />
      {data.length > 0 && (
        <>
          <polyline fill="none" points={points.join(' ')} stroke={color} strokeWidth="4" />
          {points.map((point) => {
            const [cx, cy] = point.split(',')
            return <circle cx={cx} cy={cy} fill={color} key={point} r="4" />
          })}
        </>
      )}
    </svg>
  )
}

function StatCard({ label, value, helper }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

function App() {
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(Boolean(authToken))
  const [authMode, setAuthMode] = useState('login')
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
  })
  const [registerError, setRegisterError] = useState('')
  const [registerSuccess, setRegisterSuccess] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const api = useMemo(() => axios.create({ baseURL: API_URL }), [])
  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Token ${authToken}` } : {}),
    [authToken],
  )

  useEffect(() => {
    let active = true

    async function validateSession() {
      if (!authToken) {
        setCheckingSession(false)
        setLoading(false)
        return
      }

      try {
        const { data } = await api.get('/api/auth/me/', { headers: authHeaders })
        if (!active) return

        if (!data.user?.is_staff) {
          window.localStorage.removeItem(TOKEN_KEY)
          setAuthToken('')
          setUser(null)
          setLoginError('Tu cuenta no tiene permisos de administrador.')
          return
        }

        setUser(data.user)
      } catch {
        if (!active) return
        window.localStorage.removeItem(TOKEN_KEY)
        setAuthToken('')
        setUser(null)
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    validateSession()

    return () => {
      active = false
    }
  }, [api, authHeaders, authToken])

  useEffect(() => {
    if (!authToken || !user?.is_staff) return undefined

    let active = true

    async function loadDashboard() {
      try {
        const { data } = await api.get('/api/v1/dashboard/', { headers: authHeaders })
        if (!active) return
        setDashboard(data)
        setError('')
      } catch (requestError) {
        if (!active) return
        if (requestError.response?.status === 401 || requestError.response?.status === 403) {
          window.localStorage.removeItem(TOKEN_KEY)
          setAuthToken('')
          setUser(null)
          setDashboard(null)
          setError('')
          setLoginError('Debes iniciar sesion con una cuenta de administrador.')
          return
        }
        setError('No fue posible conectar con la API Django.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    const timer = window.setInterval(loadDashboard, POLLING_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [api, authHeaders, authToken, user])

  async function handleLogin(event) {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const { data } = await api.post('/api/auth/login/', loginForm)

      if (!data.user?.is_staff) {
        setLoginError('Tu cuenta no tiene permisos de administrador.')
        return
      }

      window.localStorage.setItem(TOKEN_KEY, data.token)
      setAuthToken(data.token)
      setUser(data.user)
      setLoginForm({ username: '', password: '' })
      setDashboard(null)
      setLoading(true)
    } catch (requestError) {
      setLoginError(requestError.response?.data?.detail || 'No fue posible iniciar sesion.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleRegister(event) {
    event.preventDefault()
    setRegisterError('')
    setRegisterSuccess('')
    setRegisterLoading(true)

    try {
      const { data } = await api.post('/api/auth/register/', registerForm)
      setRegisterSuccess(data.detail || 'Cuenta creada. Un administrador debe aprobar tu acceso.')
      setRegisterForm({
        username: '',
        password: '',
        email: '',
        first_name: '',
        last_name: '',
      })
      setLoginForm((current) => ({
        ...current,
        username: registerForm.username,
        password: '',
      }))
      setAuthMode('login')
    } catch (requestError) {
      setRegisterError(requestError.response?.data?.detail || 'No fue posible crear la cuenta.')
    } finally {
      setRegisterLoading(false)
    }
  }

  async function handleLogout() {
    try {
      if (authToken) {
        await api.post('/api/auth/logout/', null, { headers: authHeaders })
      }
    } catch {
      // La sesion local se cierra aunque el token ya no exista en el servidor.
    } finally {
      window.localStorage.removeItem(TOKEN_KEY)
      setAuthToken('')
      setUser(null)
      setDashboard(null)
      setError('')
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Acueducto veredal</p>
          <h1>Validando acceso</h1>
          <p>Estamos comprobando tu sesion.</p>
        </section>
      </main>
    )
  }

  if (!authToken || !user?.is_staff) {
    const isLogin = authMode === 'login'

    return (
      <main className="auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Acueducto veredal</p>
          <h1>{isLogin ? 'Ingreso administrativo' : 'Crear cuenta'}</h1>
          <p>
            {isLogin
              ? 'Inicia sesion con una cuenta aprobada para ver el dashboard.'
              : 'Solicita una cuenta. Un administrador debe aprobarla antes de entrar.'}
          </p>

          <div className="auth-switch" role="tablist" aria-label="Opciones de acceso">
            <button
              aria-selected={isLogin}
              className={isLogin ? 'active' : ''}
              onClick={() => {
                setAuthMode('login')
                setLoginError('')
              }}
              role="tab"
              type="button"
            >
              Ingresar
            </button>
            <button
              aria-selected={!isLogin}
              className={!isLogin ? 'active' : ''}
              onClick={() => {
                setAuthMode('register')
                setRegisterError('')
                setRegisterSuccess('')
              }}
              role="tab"
              type="button"
            >
              Crear cuenta
            </button>
          </div>

          {isLogin ? (
            <form className="login-form" onSubmit={handleLogin}>
              <label>
                Usuario
                <input
                  autoComplete="username"
                  name="username"
                  onChange={(event) => setLoginForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))}
                  required
                  type="text"
                  value={loginForm.username}
                />
              </label>
              <label>
                Contrasena
                <input
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => setLoginForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))}
                  required
                  type="password"
                  value={loginForm.password}
                />
              </label>
              {registerSuccess && <div className="success-banner">{registerSuccess}</div>}
              {loginError && <div className="alert-banner">{loginError}</div>}
              <button disabled={loginLoading} type="submit">
                {loginLoading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleRegister}>
              <label>
                Usuario
                <input
                  autoComplete="username"
                  name="username"
                  onChange={(event) => setRegisterForm((current) => ({
                    ...current,
                    username: event.target.value,
                  }))}
                  required
                  type="text"
                  value={registerForm.username}
                />
              </label>
              <label>
                Correo
                <input
                  autoComplete="email"
                  name="email"
                  onChange={(event) => setRegisterForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))}
                  type="email"
                  value={registerForm.email}
                />
              </label>
              <div className="form-row">
                <label>
                  Nombre
                  <input
                    autoComplete="given-name"
                    name="first_name"
                    onChange={(event) => setRegisterForm((current) => ({
                      ...current,
                      first_name: event.target.value,
                    }))}
                    type="text"
                    value={registerForm.first_name}
                  />
                </label>
                <label>
                  Apellido
                  <input
                    autoComplete="family-name"
                    name="last_name"
                    onChange={(event) => setRegisterForm((current) => ({
                      ...current,
                      last_name: event.target.value,
                    }))}
                    type="text"
                    value={registerForm.last_name}
                  />
                </label>
              </div>
              <label>
                Contrasena
                <input
                  autoComplete="new-password"
                  minLength="8"
                  name="password"
                  onChange={(event) => setRegisterForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))}
                  required
                  type="password"
                  value={registerForm.password}
                />
              </label>
              {registerError && <div className="alert-banner">{registerError}</div>}
              <button disabled={registerLoading} type="submit">
                {registerLoading ? 'Creando...' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </section>
      </main>
    )
  }

  const latest = dashboard?.latest?.reading
  const estado = dashboard?.latest?.estado || 'desconectado'
  const alerta = dashboard?.latest?.alerta
  const readings = dashboard?.recent_readings || []
  const series = buildSeries(readings.slice(0, 20))
  const daily = dashboard?.stats?.daily || {}
  const monthly = dashboard?.stats?.monthly || {}
  const currentFlow = latest ? numberValue(latest.caudal_entrada).toFixed(2) : '0.00'

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Acueducto veredal</p>
          <h1>Monitoreo hidrico IoT</h1>
          <p>Sensor de flujo conectado a ESP32 con envio HTTP cada 3 segundos.</p>
        </div>
        <div className="header-actions">
          <div className={`status-pill status-${estado}`}>
            <span />
            {statusLabels[estado] || estado}
          </div>
          <button className="logout-button" onClick={handleLogout} type="button">
            Salir
          </button>
        </div>
      </header>

      {error && <section className="alert-banner">{error}</section>}
      {alerta && <section className="alert-banner">{alerta}</section>}

      <section className="metric-grid">
        <StatCard label="Caudal actual" value={`${currentFlow} L/min`} helper="Entrada principal" />
        <StatCard label="Ultima actualizacion" value={formatDate(latest?.fecha)} helper="Datos historicos persistidos" />
        <StatCard label="Lecturas hoy" value={daily.total_lecturas || 0} helper={`Promedio ${daily.promedio_caudal || 0} L/min`} />
        <StatCard label="Lecturas mes" value={monthly.total_lecturas || 0} helper={`Maximo ${monthly.maximo_caudal || 0} L/min`} />
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Tiempo real</p>
              <h2>Comportamiento instantaneo del caudal</h2>
            </div>
            <small>Autoactualiza cada 3 s</small>
          </div>
          <Sparkline data={series} />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Diaria</p>
              <h2>Estadisticas del dia</h2>
            </div>
          </div>
          <dl className="stats-list">
            <div><dt>Promedio</dt><dd>{daily.promedio_caudal || 0} L/min</dd></div>
            <div><dt>Maximo</dt><dd>{daily.maximo_caudal || 0} L/min</dd></div>
            <div><dt>Minimo</dt><dd>{daily.minimo_caudal || 0} L/min</dd></div>
          </dl>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mensual</p>
              <h2>Historico mensual</h2>
            </div>
          </div>
          <Sparkline data={series} color="#6f5f90" />
          <p className="panel-note">{monthly.total_lecturas || 0} lecturas almacenadas este mes.</p>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Alertas</p>
              <h2>Eventos recientes</h2>
            </div>
          </div>
          <div className="alert-list">
            {(dashboard?.active_alerts || []).length === 0 && <p>No hay alertas activas.</p>}
            {(dashboard?.active_alerts || []).map((item) => (
              <div className="alert-item" key={item.id}>
                <strong>{statusLabels[item.estado] || item.estado}</strong>
                <span>{item.alerta}</span>
                <small>{formatDate(item.fecha)}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel panel-wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Historial</p>
              <h2>Lecturas recibidas</h2>
            </div>
            {loading && <small>Cargando...</small>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Sensor</th>
                  <th>Caudal</th>
                  <th>Estado</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading.id}>
                    <td>{formatDate(reading.fecha)}</td>
                    <td>{reading.sensor_id}</td>
                    <td>{numberValue(reading.caudal_entrada).toFixed(2)} L/min</td>
                    <td><span className={`table-status status-${reading.estado}`}>{statusLabels[reading.estado]}</span></td>
                    <td>{reading.origen_dato}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
