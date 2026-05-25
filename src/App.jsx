import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const POLLING_MS = 3000

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
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const api = useMemo(() => axios.create({ baseURL: API_URL }), [])

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const { data } = await api.get('/api/v1/dashboard/')
        if (!active) return
        setDashboard(data)
        setError('')
      } catch {
        if (!active) return
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
  }, [api])

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
        <div className={`status-pill status-${estado}`}>
          <span />
          {statusLabels[estado] || estado}
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
