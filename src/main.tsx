import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import {initWebPwa} from './lib/webPwa'
import './styles.css'
import './styles/auth-refresh.css'
import './styles/appearance.css'
import './styles/optical-glass.css'
import './styles/navigation-slider.css'
import './styles/settings-hub.css'
import './styles/calendar-quick-jump.css'
import './styles/android-window.css'
import './styles/web-liquid-dock.css'

initWebPwa()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
