import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const AVAILABLE_VIDEOS = [
  'Love you so much.mp4',
  'glow stick.mp4',
  'helado.mp4',
  'oldies.mp4',
  'pop.mp4',
  'rosa.mp4',
  'tiktok.mp4',
  'wink wink.mp4'
]

const AVAILABLE_IMAGES = [
  'Glow Stick.webp',
  'Ice Cream Cone.webp',
  'Love you so much.webp',
  'Oldies.webp',
  'Pop.webp',
  'TikTok.webp',
  'Wink wink.webp',
  'rose.webp'
]

const GIFT_CHOICES = [
  { name: 'rose', label: 'Rose (Rosa)' },
  { name: 'ice cream cone', label: 'Ice Cream Cone (Helado)' },
  { name: 'wink wink', label: 'Wink Wink' },
  { name: 'glow stick', label: 'Glow Stick' },
  { name: 'tiktok', label: 'TikTok Logo' },
  { name: 'pop', label: 'Pop' },
  { name: 'oldies', label: 'Oldies' },
  { name: 'love you so much', label: 'Love You So Much' }
]

export default function Admin() {
  const [alerts, setAlerts] = useState([])
  const [tiktokUser, setTiktokUser] = useState('')
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, username: '' })
  const [activeTab, setActiveTab] = useState('regalos')
  const [recentEvents, setRecentEvents] = useState([])
  const [toast, setToast] = useState({ show: false, text: '', isError: false })
  
  // Modal Edit State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState(null)
  const [modalVideoUrl, setModalVideoUrl] = useState('')
  const [modalImageUrl, setModalImageUrl] = useState('')

  // Simulator tab state
  const [simFollowUser, setSimFollowUser] = useState('espectador_VIP')
  const [simChatMessage, setSimChatMessage] = useState('')

  // Overlay link reference
  const overlayUrlRef = useRef(null)

  const showToast = (text, isError = false) => {
    setToast({ show: true, text, isError })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 3500)
  }

  // Socket IO setup
  useEffect(() => {
    const socketServerUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('github.io')
      ? 'http://localhost:3000'
      : window.location.origin;

    const socket = io(socketServerUrl)

    socket.on('connect', () => {
      logEvent('Panel conectado con éxito al servidor local.', 'info')
    })

    socket.on('server_status', (data) => {
      setConnectionStatus({
        connected: data.connected,
        username: data.tiktokUsername || ''
      })
    })

    socket.on('chat', (data) => {
      logEvent(`💬 <strong>@${data.username}</strong>: "${data.comment}"`, 'chat')
    })

    socket.on('gift', (data) => {
      logEvent(`🎁 <strong>@${data.username}</strong> envió ${data.repeatCount}x <strong>${data.giftName}</strong>`, 'gift')
    })

    socket.on('follow', (data) => {
      logEvent(`👤 <strong>@${data.username}</strong> te comenzó a seguir!`, 'follow')
    })

    socket.on('share', (data) => {
      logEvent(`🔗 <strong>@${data.username}</strong> compartió la transmisión!`, 'share')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Initial Load
  useEffect(() => {
    fetchAlertsConfig()
    fetchTikTokUser()
  }, [])

  const logEvent = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const entry = { id: Math.random().toString(), time, text, type }
    setRecentEvents(prev => [entry, ...prev].slice(0, 30))
  }

  const fetchAlertsConfig = async () => {
    try {
      const res = await fetch('/api/alerts-config')
      if (res.ok) {
        const data = await res.json()
        setAlerts(data)
      } else {
        showToast('Error cargando la configuración de alertas', true)
      }
    } catch (e) {
      showToast('Error cargando la configuración de alertas', true)
    }
  }

  const fetchTikTokUser = async () => {
    try {
      const res = await fetch('/api/tiktok-username')
      if (res.ok) {
        const data = await res.json()
        setTiktokUser(data.tiktokUsername || '')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveTikTokUser = async () => {
    if (!tiktokUser.trim()) {
      showToast('El nombre de usuario no puede estar vacío', true)
      return
    }
    try {
      const res = await fetch('/api/tiktok-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tiktokUser })
      })
      if (res.ok) {
        showToast(`Usuario actualizado a @${tiktokUser}. Intentando conectar...`)
      } else {
        showToast('Fallo al actualizar el usuario', true)
      }
    } catch (e) {
      showToast('Error de conexión', true)
    }
  }

  const handleAddNewGift = () => {
    const select = document.getElementById('giftAddSelect')
    if (!select) return
    const giftName = select.value

    const exists = alerts.some(a => a.giftName.toLowerCase() === giftName.toLowerCase())
    if (exists) {
      showToast(`La alerta para "${giftName}" ya está configurada.`, true)
      return
    }

    // Default assets map
    let videoUrl = 'gifts/videos/rosa.mp4'
    let imageUrl = 'gifts/img/rose.webp'

    if (giftName === 'rose') {
      videoUrl = 'gifts/videos/rosa.mp4'
      imageUrl = 'gifts/img/rose.webp'
    } else if (giftName === 'ice cream cone') {
      videoUrl = 'gifts/videos/helado.mp4'
      imageUrl = 'gifts/img/Ice Cream Cone.webp'
    } else if (giftName === 'wink wink') {
      videoUrl = 'gifts/videos/wink wink.mp4'
      imageUrl = 'gifts/img/Wink wink.webp'
    } else if (giftName === 'glow stick') {
      videoUrl = 'gifts/videos/glow stick.mp4'
      imageUrl = 'gifts/img/glow stick.webp'
    } else if (giftName === 'tiktok') {
      videoUrl = 'gifts/videos/tiktok.mp4'
      imageUrl = 'gifts/img/TikTok.webp'
    } else if (giftName === 'pop') {
      videoUrl = 'gifts/videos/pop.mp4'
      imageUrl = 'gifts/img/Pop.webp'
    } else if (giftName === 'oldies') {
      videoUrl = 'gifts/videos/oldies.mp4'
      imageUrl = 'gifts/img/Oldies.webp'
    } else if (giftName === 'love you so much') {
      videoUrl = 'gifts/videos/Love you so much.mp4'
      imageUrl = 'gifts/img/Love you so much.webp'
    }

    const newAlert = {
      id: String(Date.now()),
      giftName,
      videoUrl,
      imageUrl
    }

    setAlerts(prev => [...prev, newAlert])
    showToast(`Añadido "${giftName}". Recuerda presionar "Guardar Todo".`)
  }

  const handleDeleteAlert = (index) => {
    const name = alerts[index].giftName
    if (window.confirm(`¿Estás seguro de eliminar la alerta para "${name}"?`)) {
      setAlerts(prev => prev.filter((_, i) => i !== index))
      showToast(`Alerta de "${name}" removida. Guarda los cambios para aplicar.`)
    }
  }

  const handleUpdateCardVideo = (index, val) => {
    setAlerts(prev => {
      const copy = [...prev]
      copy[index].videoUrl = val
      return copy
    })
    showToast('Video cambiado. Haz clic en "Guardar Todo" para salvar en disco.')
  }

  const openEditModal = (index) => {
    setEditingIndex(index)
    setModalVideoUrl(alerts[index].videoUrl || '')
    setModalImageUrl(alerts[index].imageUrl || '')
    setIsModalOpen(true)
  }

  const handleSaveModal = () => {
    if (!modalVideoUrl.trim()) {
      showToast('La ruta del video es requerida', true)
      return
    }
    setAlerts(prev => {
      const copy = [...prev]
      copy[editingIndex].videoUrl = modalVideoUrl
      copy[editingIndex].imageUrl = modalImageUrl
      return copy
    })
    setIsModalOpen(false)
    showToast('Rutas actualizadas. No olvides presionar "Guardar Todo".')
  }

  const handleSaveAllConfig = async () => {
    try {
      const res = await fetch('/api/alerts-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alerts)
      })
      if (res.ok) {
        showToast('¡Configuración de alertas guardada con éxito en el servidor!')
      } else {
        showToast('Fallo al guardar la configuración', true)
      }
    } catch (e) {
      showToast('Error al enviar la petición al servidor', true)
    }
  }

  const handleSimulateGift = async (giftName) => {
    try {
      const randImgId = Math.floor(Math.random() * 70) + 1
      const avatarUrl = `https://i.pravatar.cc/100?img=${randImgId}`
      const res = await fetch(`/test-gift?name=${encodeURIComponent(giftName)}&user=${encodeURIComponent('Jaime Flores')}&count=1&avatar=${encodeURIComponent(avatarUrl)}`)
      if (res.ok) {
        showToast(`Simulación de regalo enviada: 1x "${giftName}"`)
      } else {
        showToast('Error al enviar simulación', true)
      }
    } catch (e) {
      showToast('Error de conexión al simular', true)
    }
  }

  const handleSimulateFollow = async () => {
    const user = simFollowUser.trim() || 'seguidor_VIP'
    try {
      const res = await fetch(`/test-follow?user=${encodeURIComponent(user)}`)
      if (res.ok) {
        showToast(`Simulación de seguidor enviada: @${user}`)
      } else {
        showToast('Error al enviar simulación de seguidor', true)
      }
    } catch (e) {
      showToast('Error de conexión al simular seguidor', true)
    }
  }

  const handleSimulateChat = async (cmd) => {
    const comment = typeof cmd === 'string' ? cmd : simChatMessage.trim()
    if (!comment) {
      showToast('El comentario no puede estar vacío', true)
      return
    }
    try {
      const res = await fetch(`/test-chat?comment=${encodeURIComponent(comment)}&user=${encodeURIComponent('espectador_VIP')}`)
      if (res.ok) {
        showToast(`Simulación de chat enviada: "${comment}"`)
      } else {
        showToast('Error al enviar simulación de chat', true)
      }
    } catch (e) {
      showToast('Error de conexión al simular chat', true)
    }
  }

  const copyOverlayLink = () => {
    if (overlayUrlRef.current) {
      overlayUrlRef.current.select()
      document.execCommand('copy')
      showToast('¡Enlace del Overlay copiado al portapapeles!')
    }
  }

  // Helper to normalize gift images
  const getGiftImage = (gift) => {
    if (gift.imageUrl) return gift.imageUrl
    const normalized = gift.giftName.toLowerCase().trim()
    let filename = ''
    if (normalized === 'rose') filename = 'rose.webp'
    else if (normalized === 'ice cream cone') filename = 'Ice Cream Cone.webp'
    else if (normalized === 'tiktok') filename = 'TikTok.webp'
    else if (normalized === 'wink wink') filename = 'Wink wink.webp'
    else if (normalized === 'glow stick') filename = 'Glow Stick.webp'
    else if (normalized === 'pop') filename = 'Pop.webp'
    else if (normalized === 'oldies') filename = 'Oldies.webp'
    else if (normalized === 'love you so much') filename = 'Love you so much.webp'
    return filename ? `/gifts/img/${filename}` : '/avatar/default.png'
  }

  return (
    <div className="app-container">
      {/* ─── SIDEBAR ─── */}
      <aside>
        <div className="logo-area">
          <div className="logo-icon">
            <i className="fa-brands fa-tiktok"></i>
          </div>
          <div className="logo-text">
            <h1>TikPop</h1>
            <p>Panel de Control</p>
          </div>
        </div>

        {/* Connection Widget */}
        <div className="sb-card">
          <h3><i className="fa-solid fa-link"></i> Conectar a TikTok</h3>
          <div className="sb-input-group">
            <input 
              type="text" 
              className="sb-input" 
              value={tiktokUser} 
              onChange={(e) => setTiktokUser(e.target.value)} 
              placeholder="ej. radioxero26" 
            />
          </div>
          <span className="sb-subtitle">Escribe el nombre sin el símbolo @</span>
          <div className="status-indicator">
            <span className={`status-dot ${connectionStatus.connected ? 'connected' : ''}`}></span>
            <span id="connectionText">
              {connectionStatus.connected 
                ? `Conectado: @${connectionStatus.username}` 
                : 'Desconectado'}
            </span>
          </div>
          <button className="btn btn-accent" onClick={handleSaveTikTokUser}>Conectar</button>
        </div>

        {/* Widget Copy URL Overlay */}
        <div className="sb-card">
          <h3><i className="fa-solid fa-display"></i> URL Overlay</h3>
          <div className="copy-group">
            <input 
              type="text" 
              readOnly 
              ref={overlayUrlRef}
              className="sb-input" 
              value="http://localhost:3000/" 
            />
            <button className="btn-copy" onClick={copyOverlayLink} title="Copiar URL">
              <i className="fa-regular fa-copy"></i>
            </button>
          </div>
        </div>

        {/* Live Events Feed */}
        <div className="event-log">
          <h3><i className="fa-solid fa-bolt"></i> Eventos Recientes</h3>
          <div className="event-entries">
            {recentEvents.length === 0 ? (
              <div className="event-entry info" style={{ borderLeftColor: 'var(--text-muted)' }}>
                <span className="event-text" style={{ color: 'var(--text-muted)' }}>Esperando eventos del live...</span>
              </div>
            ) : (
              recentEvents.map(evt => (
                <div key={evt.id} className={`event-entry ${evt.type}`}>
                  <span className="event-time">{evt.time}</span>
                  <span className="event-text" dangerouslySetInnerHTML={{ __html: evt.text }}></span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Exit Button */}
        <button className="btn btn-outline-danger" style={{ marginTop: 'auto' }}>
          <i className="fa-solid fa-power-off"></i> Salir completamente
        </button>
      </aside>

      {/* ─── MAIN CONTENT AREA ─── */}
      <main>
        {/* Navigation Tabs Header */}
        <header>
          <div className="tabs-container">
            <button className={`tab-btn ${activeTab === 'regalos' ? 'active' : ''}`} onClick={() => setActiveTab('regalos')}>
              <i className="fa-solid fa-gift"></i> Regalos
            </button>
            <button className={`tab-btn ${activeTab === 'likes' ? 'active' : ''}`} onClick={() => setActiveTab('likes')}>
              <i className="fa-solid fa-heart"></i> Me Gusta
            </button>
            <button className={`tab-btn ${activeTab === 'shares' ? 'active' : ''}`} onClick={() => setActiveTab('shares')}>
              <i className="fa-solid fa-share-nodes"></i> Compartir
            </button>
            <button className={`tab-btn ${activeTab === 'follows' ? 'active' : ''}`} onClick={() => setActiveTab('follows')}>
              <i className="fa-solid fa-user-plus"></i> Seguir
            </button>
            <button className={`tab-btn ${activeTab === 'licencia' ? 'active' : ''}`} onClick={() => setActiveTab('licencia')}>
              <i className="fa-solid fa-key"></i> Licencia
            </button>
            <button className={`tab-btn ${activeTab === 'simulador' ? 'active' : ''}`} onClick={() => setActiveTab('simulador')}>
              <i className="fa-solid fa-flask"></i> Simulador
            </button>
          </div>

          <div className="global-actions">
            <button className="btn btn-accent" onClick={handleSaveAllConfig}>
              <i className="fa-solid fa-floppy-disk"></i> Guardar Todo
            </button>
          </div>
        </header>

        {/* Tab Body Contents */}
        <div className="content-area">
          
          {/* TAB 1: REGALOS */}
          {activeTab === 'regalos' && (
            <div className="tab-content active">
              {/* Creator/Add widget */}
              <div className="content-card">
                <div className="card-header-flex">
                  <h2><i className="fa-solid fa-circle-plus"></i> Añadir Regalo</h2>
                </div>

                <div className="form-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Seleccionar Regalo</label>
                    <select id="giftAddSelect" className="select-input">
                      {GIFT_CHOICES.map(g => (
                        <option key={g.name} value={g.name}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <button className="btn btn-accent" style={{ width: '100%', height: '40px' }} onClick={handleAddNewGift}>
                      <i className="fa-solid fa-plus"></i> Añadir
                    </button>
                  </div>
                </div>
              </div>

              {/* Title & Count Badge */}
              <div className="card-header-flex" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}><i className="fa-regular fa-square-check" style={{ color: 'var(--accent-pink)', marginRight: '6px' }}></i> Regalos Configurados</h3>
                <span id="alertCount" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{alerts.length} configurados</span>
              </div>

              {/* Grid of gift cards */}
              <div className="gifts-grid">
                {alerts.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                    No hay alertas de regalo configuradas. Selecciona un regalo arriba y añádelo.
                  </div>
                ) : (
                  alerts.map((item, index) => {
                    // Generate video options
                    const videoOptions = [...AVAILABLE_VIDEOS]
                    if (!videoOptions.includes(item.videoUrl.split('/').pop())) {
                      videoOptions.push(item.videoUrl)
                    }

                    return (
                      <div className="gift-card" key={item.id}>
                        <div className="gift-card-header">
                          <div className="gift-info">
                            <img 
                              src={getGiftImage(item)} 
                              className="gift-avatar" 
                              alt={item.giftName} 
                              onError={(e) => { e.target.src = '/avatar/default.png' }}
                            />
                            <div className="gift-details">
                              <h4 style={{ textTransform: 'capitalize' }}>{item.giftName}</h4>
                              <span><i className="fa-solid fa-coins"></i> 1 coins</span>
                            </div>
                          </div>
                          <label className="switch">
                            <input type="checkbox" defaultChecked />
                            <span className="slider"></span>
                          </label>
                        </div>

                        <div className="slider-group">
                          <div className="slider-header">
                            <span>Combo (ms)</span>
                            <span>3000ms</span>
                          </div>
                          <input type="range" className="range-slider" min="500" max="10000" step="500" defaultValue="3000" />
                        </div>

                        <div className="media-sub-grid">
                          {/* MP3 Config */}
                          <div className="media-box">
                            <div className="media-box-header">
                              <label><input type="checkbox" /> MP3</label>
                              <span>50%</span>
                            </div>
                            <button className="btn-upload-mock">Subir</button>
                            <span className="media-filename">Sin archivo</span>
                            <input type="range" className="range-slider" min="0" max="100" defaultValue="50" disabled />
                          </div>

                          {/* Video Config */}
                          <div className="media-box">
                            <div className="media-box-header">
                              <label><input type="checkbox" defaultChecked /> Video</label>
                              <span>70%</span>
                            </div>
                            
                            <select 
                              className="select-input" 
                              style={{ padding: '4px 6px', fontSize: '0.75rem', borderRadius: '6px', height: '28px' }}
                              value={item.videoUrl}
                              onChange={(e) => handleUpdateCardVideo(index, e.target.value)}
                            >
                              {AVAILABLE_VIDEOS.map(v => (
                                <option key={v} value={`gifts/videos/${v}`}>{v}</option>
                              ))}
                              {!AVAILABLE_VIDEOS.some(v => `gifts/videos/${v}` === item.videoUrl) && (
                                <option value={item.videoUrl}>{item.videoUrl}</option>
                              )}
                            </select>
                            
                            <span className="media-filename" style={{ marginTop: '2px' }}>
                              {item.videoUrl.split('/').pop()}
                            </span>
                            <input type="range" className="range-slider" min="0" max="100" defaultValue="70" />
                          </div>
                        </div>

                        <div className="gift-card-actions">
                          <button className="btn-probar" onClick={() => handleSimulateGift(item.giftName)}>
                            <i className="fa-solid fa-play"></i> Probar
                          </button>
                          <button className="btn-action-small" onClick={() => openEditModal(index)} title="Editar rutas manuales">
                            <i className="fa-solid fa-sliders"></i>
                          </button>
                          <button className="btn-action-small delete" onClick={() => handleDeleteAlert(index)} title="Eliminar Alerta">
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ME GUSTA */}
          {activeTab === 'likes' && (
            <div className="tab-content active">
              <div className="content-card">
                <div className="card-header-flex">
                  <h2><i className="fa-solid fa-heart"></i> Configuración de Likes (Me Gusta)</h2>
                  <button className="btn btn-accent" onClick={() => handleSimulateChat('!color rosa')} style={{ fontSize: '0.8rem', height: '32px' }}>
                    <i className="fa-solid fa-play"></i> Probar
                  </button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
                  Ajusta la interactividad en vivo cuando la gente le da taps de likes a la transmisión de TikTok.
                </p>

                <div className="setting-section">
                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    <div className="setting-info">
                      <h4>Habilitar animaciones por Likes</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Genera efectos visuales sutiles en pantalla con cada tanda de likes recibida.</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" defaultChecked />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="setting-info">
                      <h4>Frecuencia de actualización de luces</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Controla cuán dinámicamente parpadean las luces LED en respuesta a la actividad.</p>
                    </div>
                    <select className="select-input" style={{ width: '180px' }} defaultValue="fast">
                      <option value="slow">Bajo (Ahorro CPU)</option>
                      <option value="normal">Medio (Recomendado)</option>
                      <option value="fast">Frenético (Neon Glow)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPARTIR */}
          {activeTab === 'shares' && (
            <div className="tab-content active">
              <div className="content-card">
                <div className="card-header-flex">
                  <h2><i className="fa-solid fa-share-nodes"></i> Configuración de Compartir (Shares)</h2>
                  <button className="btn btn-accent" onClick={() => handleSimulateChat('!color celeste')} style={{ fontSize: '0.8rem', height: '32px' }}>
                    <i className="fa-solid fa-play"></i> Probar
                  </button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
                  Configura acciones automáticas cada vez que alguien comparta tu transmisión de TikTok Live.
                </p>

                <div className="setting-section">
                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="setting-info">
                      <h4>Notificación flotante por compartir</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Muestra un toast emergente flotante en pantalla felicitando al usuario.</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" defaultChecked />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SEGUIR */}
          {activeTab === 'follows' && (
            <div className="tab-content active">
              <div className="content-card">
                <div className="card-header-flex">
                  <h2><i className="fa-solid fa-user-plus"></i> Alerta de Seguir (Follows)</h2>
                  <button className="btn btn-accent" onClick={handleSimulateFollow} style={{ fontSize: '0.8rem', height: '32px' }}>
                    <i className="fa-solid fa-play"></i> Probar
                  </button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
                  Define cómo reacciona tu reproductor en pantalla ante nuevos seguidores.
                </p>

                <div className="setting-section">
                  <div className="setting-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="setting-info">
                      <h4>Notificación de follows</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Muestra un Toast elegante con el avatar y el nombre del nuevo seguidor en pantalla.</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" defaultChecked />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LICENCIA */}
          {activeTab === 'licencia' && (
            <div className="tab-content active">
              <div className="content-card">
                <div className="license-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
                  <div className="license-icon" style={{ width: '80px', height: '80px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', color: 'var(--accent-cyan)', marginBottom: '1.2rem', boxShadow: 'var(--glow-cyan)' }}>
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <h2>Licencia de TikPop</h2>
                  <div className="license-status-tag" style={{ margin: '0.8rem 0' }}>Activada VIP</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '450px', marginBottom: '2rem' }}>
                    Gracias por usar TikPop. Tu clave de licencia está vinculada permanentemente y tienes acceso ilimitado a todas las herramientas interactivas y visuales.
                  </p>

                  <div className="license-details" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', textAlign: 'left' }}>
                    <div className="license-detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Usuario Titular</span>
                      <span>Jaime Flores</span>
                    </div>
                    <div className="license-detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Tipo de Licencia</span>
                      <span>VIP Premium Unlimited</span>
                    </div>
                    <div className="license-detail-row" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Estado</span>
                      <span style={{ color: '#4ade80', fontWeight: 600 }}>Vigente y Activa</span>
                    </div>
                    <div className="license-detail-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Fecha de Expiración</span>
                      <span>Nunca (Vitalicia)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SIMULADOR */}
          {activeTab === 'simulador' && (
            <div className="tab-content active">
              <div className="content-card">
                <div className="card-header-flex">
                  <h2><i className="fa-solid fa-flask"></i> Simulador de Eventos TikTok Live</h2>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  Usa estas herramientas para probar tus alertas, comandos de chat, temas de neón y tickers en tiempo real sin estar en vivo.
                </p>

                <div className="setting-section">
                  {/* Simulate Follow */}
                  <div className="content-card" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', marginBottom: '1rem', border: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>👤 Simular Seguidor (Follow)</h3>
                    <div className="form-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '0.8rem' }}>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Nombre de Usuario</label>
                        <input 
                          type="text" 
                          className="text-input" 
                          value={simFollowUser} 
                          onChange={(e) => setSimFollowUser(e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <button 
                          className="btn btn-accent" 
                          onClick={handleSimulateFollow}
                          style={{ width: '100%', height: '40px', background: 'linear-gradient(135deg, #22c55e, #10b981)', boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)' }}
                        >
                          <i className="fa-solid fa-user-plus"></i> Simular Seguidor
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Simulate Chat */}
                  <div className="content-card" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)', marginBottom: '1rem', border: '1px dashed var(--border-color)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>💬 Simular Mensaje de Chat (Comandos)</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                      Prueba los comandos de chat para el control de luces, visualizadores y temas:
                      <code style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', marginLeft: '5px' }}>!color azul</code>,
                      <code style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', marginLeft: '5px' }}>!viz wave</code>,
                      <code style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', marginLeft: '5px' }}>!tema claro</code>.
                    </p>
                    <div className="form-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginTop: '0.8rem' }}>
                      <div className="form-group" style={{ flex: 2 }}>
                        <label>Mensaje de Chat / Comando</label>
                        <input 
                          type="text" 
                          className="text-input" 
                          placeholder="ej. !color verde" 
                          value={simChatMessage} 
                          onChange={(e) => setSimChatMessage(e.target.value)} 
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <button 
                          className="btn btn-accent" 
                          onClick={() => handleSimulateChat()}
                          style={{ width: '100%', height: '40px', background: 'linear-gradient(135deg, #06b6d4, #3b82f6)', boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)' }}
                        >
                          <i className="fa-solid fa-paper-plane"></i> Enviar al Chat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ─── MODAL EDIT OVERLAY ─── */}
      {isModalOpen && (
        <div className="overlay active" id="editModalOverlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Editar Rutas Estáticas</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            
            <div className="form-group" style={{ padding: '0.5rem 0' }}>
              <label>Ruta del Video Estático (Pantalla Verde)</label>
              <div className="sb-input-group">
                <input 
                  type="text" 
                  className="sb-input" 
                  value={modalVideoUrl} 
                  onChange={(e) => setModalVideoUrl(e.target.value)} 
                  placeholder="gifts/videos/rosa.mp4" 
                />
              </div>
            </div>

            <div className="form-group" style={{ padding: '0.5rem 0' }}>
              <label>Ruta de la Imagen del Regalo (Miniatura)</label>
              <div className="sb-input-group">
                <input 
                  type="text" 
                  className="sb-input" 
                  value={modalImageUrl} 
                  onChange={(e) => setModalImageUrl(e.target.value)} 
                  placeholder="gifts/img/rose.webp" 
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn btn-accent" onClick={handleSaveModal}>Guardar Rutas</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FLOATING TOAST NOTIFIER ─── */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'error' : ''}`}>
        <i className={`fa-solid ${toast.isError ? 'fa-circle-exclamation' : 'fa-circle-check'}`}></i>
        <span style={{ marginLeft: '8px' }}>{toast.text}</span>
      </div>

    </div>
  )
}
