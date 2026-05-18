import { useEffect } from 'react'
import axios from 'axios'

function App() {
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/admin/`)
      .then(() => {
        console.log("Backend conectado")
      })
      .catch(err => {
        console.log(err)
      })
  }, [])

  return (
    <h1>Frontend conectado</h1>
  )
}

export default App