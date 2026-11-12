import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { env, envWarnings } from './config/env'
import './styles/metamodern.css'

document.title = `${env.app.name} · Meta-Art Interface`
envWarnings.forEach((w) => console.warn('[RFR · config]', w))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
