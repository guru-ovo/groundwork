import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import Landing from './landing/Landing.jsx'
import { useMotionGate } from './hooks/useMotionGate'
import './App.css'
import './print.css'

/**
 * `/` is the marketing landing; `/start` is the product.
 *
 * The motion gate is mounted once here rather than per page: it is a
 * document-level fact ("a frame has run"), and every entrance animation on
 * either route is held behind it.
 */
function Root() {
  useMotionGate()

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/start" element={<App />} />
      {/* Anything else is the landing rather than a dead end. */}
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
)
