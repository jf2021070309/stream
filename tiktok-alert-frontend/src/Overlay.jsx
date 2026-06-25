import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const STREAM_URL = 'https://stream.zeno.fm/n7fm3s6537zuv'
const SEGMENT_COUNT = 14

const AVATAR_VIDEOS = [
  '/avatar/video1.mp4',
  '/avatar/video2.mp4',
  '/avatar/video3.mp4',
  '/avatar/video4.mp4'
]

const GIFT_COIN_VALUES = {
  'rose': 1,
  'ice cream cone': 1,
  'wink wink': 1,
  'glow stick': 1,
  'tiktok': 1,
  'pop': 1,
  'oldies': 1,
  'love you so much': 1
}

const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cccccc"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'

export default function Overlay() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(50)
  const [statusText, setStatusText] = useState('Listo para escuchar')
  const [statusClass, setStatusClass] = useState('')
  const [trackTitle, setTrackTitle] = useState('Sintonizando señal...')
  const [vizMode, setVizMode] = useState('led') // 'led', 'bars', 'wave'
  const [isDarkTheme, setIsDarkTheme] = useState(true)

  // Live Ticker State
  const [tickerFollowUser, setTickerFollowUser] = useState('@esperando')
  const [tickerGiftUser, setTickerGiftUser] = useState('esperando...')
  const [tickerTopUser, setTickerTopUser] = useState('esperando...')

  // Alert State
  const [alertActive, setAlertActive] = useState(false)
  const [alertUser, setAlertUser] = useState('')
  const [alertAvatar, setAlertAvatar] = useState('')
  const [alertMsg, setAlertMsg] = useState('')
  const [alertVideoSrc, setAlertVideoSrc] = useState('')

  // Top Donator State
  const [donorTotals, setDonorTotals] = useState({})
  const [topDonor, setTopDonor] = useState({ username: '', coins: 0 })
  const topDonorRef = useRef({ username: '', coins: 0 })

  // Active Gift State
  const [currentGift, setCurrentGift] = useState({ username: '', giftName: '', videoUrl: '' })

  // Refs for Audio & Visualizers
  const audioRef = useRef(null)
  const canvasRef = useRef(null)
  const animationFrameRef = useRef(null)
  const alertVideoRef = useRef(null)

  // Audio Analyser Refs
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const dataArrayRef = useRef(null)

  // VU LED Meters Ref
  const vuLRef = useRef(null)
  const vuRRef = useRef(null)

  // Double Avatar Video Loop Refs
  const avatarVideo1Ref = useRef(null)
  const avatarVideo2Ref = useRef(null)
  const [activeAvatarIndex, setActiveAvatarIndex] = useState(1)
  const avatarQueueRef = useRef([])

  // Queue state for TikTok gifts
  const giftQueueRef = useRef([])
  const isProcessingGiftRef = useRef(false)
  const alertTimeoutRef = useRef(null)
  const activeAlertRef = useRef(null)

  // Alerts configuration mapping
  const giftVideoMapRef = useRef({
    'rose': '/gifts/videos/rosa.mp4',
    'ice cream cone': '/gifts/videos/helado.mp4',
    'tiktok': '/gifts/videos/tiktok.mp4',
    'wink wink': '/gifts/videos/wink wink.mp4',
    'glow stick': '/gifts/videos/glow stick.mp4',
    'pop': '/gifts/videos/pop.mp4',
    'oldies': '/gifts/videos/oldies.mp4',
    'love you so much': '/gifts/videos/Love you so much.mp4'
  })

  // Toast Helper
  const showToast = (text) => {
    const toast = document.createElement('div')
    toast.className = 'rx-toast'
    toast.innerText = text
    document.body.appendChild(toast)
    setTimeout(() => toast.classList.add('show'), 100)
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 500)
    }, 3000)
  }

  // Fetch Alerts Configuration
  const loadAlertsConfig = async () => {
    try {
      const res = await fetch('/api/alerts-config')
      if (res.ok) {
        const configData = await res.json()
        const newMap = {}
        configData.forEach(item => {
          const name = item.giftName.toLowerCase().trim()
          newMap[name] = item.videoUrl
        })
        giftVideoMapRef.current = newMap
        console.log('✅ Configuración de alertas cargada dinámicamente:', newMap)
      }
    } catch (e) {
      console.warn('Usando configuración de alertas por defecto:', e)
    }
  }

  // Shuffle Helper for Playlist
  const shuffleArray = (array) => {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // Ticker rotation
  const [currentTickerIndex, setCurrentTickerIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTickerIndex(prev => (prev + 1) % 3)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Visibility Auto-Resume Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying && audioRef.current && audioRef.current.paused) {
        const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now()
        audioRef.current.src = STREAM_URL + cacheBuster
        audioRef.current.load()
        audioRef.current.play().catch(e => console.error(e))
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isPlaying])

  // Setup Zeno Metadata Event Source
  useEffect(() => {
    const sse = new EventSource('https://api.zeno.fm/mounts/metadata/subscribe/n7fm3s6537zuv')
    sse.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed && parsed.streamTitle) {
          setTrackTitle(parsed.streamTitle)
        }
      } catch (e) {
        // Fallback raw text
        if (event.data) setTrackTitle(event.data)
      }
    }
    return () => sse.close()
  }, [])

  // Socket IO Listeners for live events
  useEffect(() => {
    loadAlertsConfig()

    const socketServerUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.endsWith('github.io')
      ? 'http://localhost:3000'
      : window.location.origin;

    const socket = io(socketServerUrl)

    socket.on('connect', () => {
      console.log('✅ Conectado al servidor local de alertas de TikTok')
      showToast('🔗 Alertas de TikTok activas')
    })

    socket.on('gift', (data) => {
      // Add to alert queue
      queueGiftAlert(data.username, data.giftName, data.profilePictureUrl, data.repeatCount)

      // Update Top Gift Side cards
      const cleanGift = data.giftName.toLowerCase().trim()
      const isOneCoin = GIFT_COIN_VALUES[cleanGift] === 1
      const videoPath = giftVideoMapRef.current[cleanGift] || '/gifts/videos/rosa.mp4'

      setCurrentGift({
        username: `@${data.username}`,
        giftName: data.giftName,
        videoUrl: videoPath,
        isOneCoin
      })

      // Update Ticker
      setTickerGiftUser(`@${data.username} (${data.repeatCount}x ${data.giftName})`)

      // Calculate Top Donor
      const coins = (GIFT_COIN_VALUES[cleanGift] || 1) * (data.repeatCount || 1)
      setDonorTotals(prev => {
        const newTotals = { ...prev }
        newTotals[data.username] = (newTotals[data.username] || 0) + coins

        if (newTotals[data.username] > topDonorRef.current.coins) {
          const newTop = { username: data.username, coins: newTotals[data.username] }
          topDonorRef.current = newTop
          setTopDonor(newTop)
          setTickerTopUser(`@${data.username} (${newTotals[data.username]} 🪙)`)
        }
        return newTotals
      })
    })

    socket.on('follow', (data) => {
      setTickerFollowUser(`@${data.username}`)
      showToast(`👤 Nuevo seguidor: @${data.username}`)
    })

    socket.on('share', (data) => {
      showToast(`🔗 @${data.username} compartió la transmisión`)
    })

    socket.on('chat', (data) => {
      handleChatCommand(data.username, data.comment)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // Handle live chat commands (changing theme colors, visualizers, styles)
  const handleChatCommand = (username, comment) => {
    if (!comment) return
    const text = comment.trim()
    if (!text.startsWith('!')) return

    const parts = text.split(' ')
    const command = parts[0].toLowerCase()
    const arg = parts.slice(1).join(' ').toLowerCase().trim()

    if (command === '!visualizador' || command === '!viz') {
      if (['led', 'bars', 'wave'].includes(arg)) {
        setVizMode(arg)
        showToast(`🎮 @${username} cambió el visualizador a: ${arg.toUpperCase()}`)
      }
    } 
    else if (command === '!color') {
      const colorMap = {
        'rojo': '#ef4444',
        'red': '#ef4444',
        'azul': '#3b82f6',
        'blue': '#3b82f6',
        'verde': '#22c55e',
        'green': '#22c55e',
        'rosa': '#ff0050',
        'pink': '#ff0050',
        'morado': '#8b5cf6',
        'purple': '#8b5cf6',
        'amarillo': '#eab308',
        'yellow': '#eab308',
        'celeste': '#06b6d4',
        'cyan': '#00f0ff',
        'neon': '#00f0ff'
      }
      const targetColor = colorMap[arg]
      if (targetColor) {
        changeThemePrimaryColor(targetColor)
        showToast(`🌈 @${username} cambió el color de luces a: ${arg.toUpperCase()}`)
      }
    }
    else if (command === '!tema') {
      if (arg === 'oscuro' || arg === 'dark') {
        setIsDarkTheme(true)
        showToast(`🌓 @${username} activó el Tema Oscuro`)
      } else if (arg === 'claro' || arg === 'light') {
        setIsDarkTheme(false)
        showToast(`🌓 @${username} activó el Tema Claro`)
      }
    }
  }

  const changeThemePrimaryColor = (hexColor) => {
    document.documentElement.style.setProperty('--primary', hexColor)
    
    // Parse RGB to calculate neon glow glow opacity
    let r = 237, g = 28, b = 36
    if (hexColor.startsWith('#')) {
      const hex = hexColor.slice(1)
      if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16)
        g = parseInt(hex.substring(2, 4), 16)
        b = parseInt(hex.substring(4, 6), 16)
      }
    }
    document.documentElement.style.setProperty('--primary-glow', `rgba(${r}, ${g}, ${b}, 0.2)`)
  }

  // Initialize double video loop for rotating avatars
  useEffect(() => {
    if (avatarQueueRef.current.length === 0) {
      avatarQueueRef.current = shuffleArray(AVATAR_VIDEOS)
    }

    if (avatarVideo1Ref.current) {
      avatarVideo1Ref.current.src = avatarQueueRef.current.shift()
      avatarVideo1Ref.current.load()
      avatarVideo1Ref.current.play().catch(e => console.log('Autoplay avatar video blocked', e))
    }
  }, [])

  const handleAvatarVideoEnded = (vIndex) => {
    if (avatarQueueRef.current.length === 0) {
      avatarQueueRef.current = shuffleArray(AVATAR_VIDEOS)
    }

    const nextSrc = avatarQueueRef.current.shift()
    const nextVideo = vIndex === 1 ? avatarVideo2Ref.current : avatarVideo1Ref.current
    const currentVideo = vIndex === 1 ? avatarVideo1Ref.current : avatarVideo2Ref.current

    nextVideo.src = nextSrc
    nextVideo.load()
    
    nextVideo.play().then(() => {
      setActiveAvatarIndex(vIndex === 1 ? 2 : 1)
      setTimeout(() => {
        currentVideo.pause()
      }, 550)
    }).catch(err => {
      console.log("Fallo al reproducir video de avatar en segundo plano:", err)
      setActiveAvatarIndex(vIndex === 1 ? 2 : 1)
    })
  }

  // Queue Alert processor
  const queueGiftAlert = (username, giftName, profilePictureUrl, repeatCount) => {
    const cleanName = giftName.toLowerCase().trim()
    const videoUrl = giftVideoMapRef.current[cleanName]
    if (!videoUrl) return

    // 1. Check if same user is currently streaking the same gift on screen
    if (activeAlertRef.current && 
        activeAlertRef.current.username === username && 
        activeAlertRef.current.giftName.toLowerCase().trim() === cleanName) {
      
      const newCount = Math.max(activeAlertRef.current.repeatCount, repeatCount)
      activeAlertRef.current.repeatCount = newCount
      const normalizedGiftName = giftName.charAt(0).toUpperCase() + giftName.slice(1)
      setAlertMsg(`¡Muchas gracias por el regalo!<br><span>${newCount}x ${normalizedGiftName}</span>`)
      
      // Reset timeout so user sees updated total before it fades
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current)
        alertTimeoutRef.current = setTimeout(() => {
          finishAlert()
        }, 8000)
      }
      return
    }

    // 2. Check if the gift event is already queued to update its count
    const existingIndex = giftQueueRef.current.findIndex(
      item => item.username === username && item.giftName.toLowerCase().trim() === cleanName
    )

    if (existingIndex !== -1) {
      if (repeatCount > giftQueueRef.current[existingIndex].repeatCount) {
        giftQueueRef.current[existingIndex].repeatCount = repeatCount
      }
    } else {
      giftQueueRef.current.push({ username, giftName, videoUrl, profilePictureUrl, repeatCount })
    }
    
    processNextGift()
  }

  const processNextGift = () => {
    if (isProcessingGiftRef.current || giftQueueRef.current.length === 0) return
    isProcessingGiftRef.current = true

    const alert = giftQueueRef.current.shift()
    
    // Store current active alert reference for dynamic combo updating
    activeAlertRef.current = {
      username: alert.username,
      giftName: alert.giftName,
      repeatCount: alert.repeatCount
    }

    setAlertUser(`@${alert.username}`)
    setAlertAvatar(alert.profilePictureUrl || DEFAULT_AVATAR)
    setAlertVideoSrc(alert.videoUrl)

    const count = alert.repeatCount || 1
    const normalizedGiftName = alert.giftName.charAt(0).toUpperCase() + alert.giftName.slice(1)
    setAlertMsg(`¡Muchas gracias por el regalo!<br><span>${count}x ${normalizedGiftName}</span>`)
    
    setAlertActive(true)

    if (alertVideoRef.current) {
      alertVideoRef.current.src = alert.videoUrl
      alertVideoRef.current.load()
      alertVideoRef.current.play().catch(err => {
        console.warn('Fallo al reproducir video en el overlay:', err)
        setTimeout(() => finishAlert(), 2000)
      })
    }

    alertTimeoutRef.current = setTimeout(() => {
      finishAlert()
    }, 8000)
  }

  const finishAlert = () => {
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current)
      alertTimeoutRef.current = null
    }

    setAlertActive(false)
    activeAlertRef.current = null

    setTimeout(() => {
      if (alertVideoRef.current) alertVideoRef.current.src = ''
      isProcessingGiftRef.current = false
      processNextGift()
    }, 450)
  }

  // Start Analyser Web Audio
  const startAnalyser = () => {
    if (!audioRef.current) return
    
    const audio = audioRef.current

    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.75
        
        const srcNode = ctx.createMediaElementSource(audio)
        srcNode.connect(analyser)
        analyser.connect(ctx.destination)

        audioContextRef.current = ctx
        analyserRef.current = analyser
        sourceNodeRef.current = srcNode
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      } catch (e) {
        console.error('AudioContext setup failed:', e)
      }
    }

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }

    // Animation Loop
    const draw = () => {
      if (!audioRef.current || audioRef.current.paused) return
      
      animationFrameRef.current = requestAnimationFrame(draw)

      const analyser = analyserRef.current
      const dataArr = dataArrayRef.current
      
      if (analyser && dataArr) {
        analyser.getByteFrequencyData(dataArr)
      } else {
        // Fallback simulation
        simulateFrequencyData()
      }

      // Render Active visualizer mode
      const mode = vizModeRef.current
      if (mode === 'led') {
        drawLed()
      } else if (mode === 'bars') {
        drawBars()
      } else if (mode === 'wave') {
        drawWave()
      }

      // Neon Lights logo response
      if (dataArr) {
        let sum = 0
        for (let i = 0; i < 15; i++) sum += dataArr[i]
        const avg = sum / 15
        updateNeonGlow(avg)
      }
    }

    // Keep vizModeRef updated inside draw loop scope
    vizModeRef.current = vizMode
    
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    draw()
  }

  // Ref to hold vizMode for draw loop access
  const vizModeRef = useRef(vizMode)
  useEffect(() => {
    vizModeRef.current = vizMode
  }, [vizMode])

  // Simulator frequency data
  const simulateFrequencyData = () => {
    const dataArr = dataArrayRef.current || new Uint8Array(128)
    const now = Date.now() / 180
    for (let i = 0; i < dataArr.length; i++) {
      const freqScale = Math.pow(1 - (i / dataArr.length), 1.5)
      const wave1 = Math.sin(now + i * 0.15) * 40
      const wave2 = Math.sin(now * 0.7 - i * 0.05) * 30
      const noise = Math.random() * 40
      dataArr[i] = Math.max(20, (110 + wave1 + wave2 + noise) * freqScale * 1.2)
    }
    dataArrayRef.current = dataArr
  }

  // Draw LED meters
  const simLRef = useRef(0)
  const drawLed = () => {
    const dataArr = dataArrayRef.current
    let activeValL = 0
    let activeValR = 0

    if (!analyserRef.current || !dataArr) {
      const baseL = 0.5 + Math.random() * 0.2
      simLRef.current += (Math.min(1.2, baseL + (Math.random() * 0.1)) - simLRef.current) * 0.25
      activeValL = Math.round(Math.pow(simLRef.current, 1.5) * SEGMENT_COUNT * 1.3)
      activeValR = Math.round(Math.min(SEGMENT_COUNT, activeValL + (Math.random() - 0.5) * 4))
    } else {
      let avgL = 0
      let avgR = 0
      for (let i = 0; i < 10; i++) avgL += dataArr[i]
      for (let i = 10; i < 20; i++) avgR += dataArr[i]

      activeValL = Math.round((avgL / 10 / 255) * SEGMENT_COUNT * 1.05)
      activeValR = Math.round((avgR / 10 / 255) * SEGMENT_COUNT * 1.05)
    }

    activeValL = Math.min(SEGMENT_COUNT, activeValL)
    activeValR = Math.min(SEGMENT_COUNT, activeValR)

    // Render directly on DOM elements for maximum performance
    if (vuLRef.current && vuRRef.current) {
      const childrenL = vuLRef.current.children
      const childrenR = vuRRef.current.children
      
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        if (childrenL[i]) {
          if (i < activeValL) childrenL[i].classList.add('active')
          else childrenL[i].classList.remove('active')
        }
        if (childrenR[i]) {
          if (i < activeValR) childrenR[i].classList.add('active')
          else childrenR[i].classList.remove('active')
        }
      }
    }
  }

  // Draw Bars Visualizer
  const drawBars = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArr = dataArrayRef.current || new Uint8Array(128)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const barCount = 32
    const canvasW = canvas.width / window.devicePixelRatio
    const canvasH = canvas.height / window.devicePixelRatio
    const barWidth = (canvasW / barCount) * 0.8
    const gap = (canvasW / barCount) * 0.2

    const brickHeight = 4
    const brickGap = 1.5
    const totalBricks = Math.floor(canvasH / (brickHeight + brickGap))

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ef4444'

    const activeGradient = ctx.createLinearGradient(0, canvasH, 0, 0)
    activeGradient.addColorStop(0, primaryColor + 'cc')
    activeGradient.addColorStop(0.7, primaryColor)
    activeGradient.addColorStop(1, '#ffffff')

    let x = gap / 2
    const step = Math.floor(dataArr.length / 2 / barCount)

    for (let i = 0; i < barCount; i++) {
      let sum = 0
      for (let j = 0; j < step; j++) sum += dataArr[i * step + j]
      let avg = sum / step

      const factor = i < 8 ? 0.95 : (i < 16 ? 1.2 : 1.4)
      const activeHeight = (avg / 255) * canvasH * factor
      const activeBricks = Math.ceil(activeHeight / (brickHeight + brickGap))

      for (let b = 0; b < totalBricks; b++) {
        const y = canvasH - (b * (brickHeight + brickGap)) - brickHeight

        if (b < activeBricks) {
          ctx.fillStyle = activeGradient
          ctx.shadowBlur = 4
          ctx.shadowColor = primaryColor
        } else {
          ctx.fillStyle = isDarkTheme ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)'
          ctx.shadowBlur = 0
        }

        ctx.fillRect(x, y, barWidth, brickHeight)
      }

      x += barWidth + gap
    }
  }

  // Draw Wave Visualizer
  const drawWave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dataArr = dataArrayRef.current || new Uint8Array(128)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const canvasW = canvas.width / window.devicePixelRatio
    const canvasH = canvas.height / window.devicePixelRatio

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ef4444'
    const primaryGlow = getComputedStyle(document.documentElement).getPropertyValue('--primary-glow').trim() || 'rgba(239, 68, 68, 0.3)'

    const gradient = ctx.createLinearGradient(0, canvasH, 0, 0)
    gradient.addColorStop(0, primaryColor + '99')
    gradient.addColorStop(0.6, primaryColor)
    gradient.addColorStop(1, '#ffffff')

    ctx.beginPath()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = gradient
    ctx.shadowBlur = 10
    ctx.shadowColor = primaryColor

    const sliceWidth = canvasW / (dataArr.length / 2)
    let x = 0

    for (let i = 0; i < dataArr.length / 2; i++) {
      const factor = i < 15 ? (0.8 + (i / 15) * 0.5) : 1.4
      const v = (dataArr[i] / 255) * canvasH * factor
      const y = canvasH - v

      if (i === 0) ctx.moveTo(x, y)
      else {
        const prevFactor = (i - 1) < 15 ? (0.8 + ((i - 1) / 15) * 0.5) : 1.4
        const prevY = canvasH - (dataArr[i - 1] / 255 * canvasH * prevFactor)
        ctx.quadraticCurveTo(x - sliceWidth / 2, prevY, x, y)
      }
      x += sliceWidth
    }

    ctx.stroke()

    ctx.lineTo(canvasW, canvasH)
    ctx.lineTo(0, canvasH)
    const fillGradient = ctx.createLinearGradient(0, canvasH, 0, 0)
    fillGradient.addColorStop(0, 'rgba(0,0,0,0)')
    fillGradient.addColorStop(1, primaryGlow)
    ctx.fillStyle = fillGradient
    ctx.fill()
  }

  // Update Neon Glow intensity
  const updateNeonGlow = (value) => {
    const logo = document.querySelector('.rx-small-logo')
    if (!logo || !isPlaying) return
    const glowVal = (value / 255) * 16
    const glowWideVal = (value / 255) * 35
    logo.style.setProperty('--audio-glow', `${glowVal}px`)
    logo.style.setProperty('--audio-glow-wide', `${glowWideVal}px`)
  }

  // Play Pause Handler
  const handleTogglePlay = () => {
    if (!audioRef.current) return
    const audio = audioRef.current

    if (!isPlaying) {
      setStatusText('Conectando con Radio Xero...')
      setStatusClass('loading')

      if (!window.navigator.userAgent.match(/iPhone|iPad|iPod/i) && !window.navigator.userAgent.match(/EdgA/i)) {
        audio.crossOrigin = 'anonymous'
      } else {
        audio.removeAttribute('crossorigin')
      }

      const cacheBuster = (STREAM_URL.includes('?') ? '&' : '?') + '_=' + Date.now()
      audio.src = STREAM_URL + cacheBuster
      audio.load()

      audio.play().then(() => {
        setIsPlaying(true)
        setStatusText('Transmitiendo en vivo')
        setStatusClass('playing')
        startAnalyser()
      }).catch(err => {
        console.error('Audio play error:', err)
        setStatusText('Presiona PLAY para escuchar.')
        setStatusClass('')
        setIsPlaying(false)
      })
    } else {
      audio.pause()
      audio.src = ''
      setIsPlaying(false)
      setStatusText('Pausado')
      setStatusClass('')
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      
      const logo = document.querySelector('.rx-small-logo')
      if (logo) {
        logo.style.setProperty('--audio-glow', '0px')
        logo.style.setProperty('--audio-glow-wide', '0px')
      }
    }
  }

  // Mute Handler
  const handleToggleMute = () => {
    if (!audioRef.current) return
    const nextMute = !isMuted
    setIsMuted(nextMute)
    audioRef.current.muted = nextMute
  }

  // Volume Handler
  const handleVolumeChange = (v) => {
    const val = Number(v)
    setVolume(val)
    if (audioRef.current) {
      audioRef.current.volume = val / 100
    }
  }

  // Resize canvas handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [vizMode])

  return (
    <div className={`top-bg-wrapper ${isDarkTheme ? 'dark-theme' : ''}`}>
      <div className="top-bg"></div>

      <header>
        <h1 className="visually-hidden">TikXero</h1>
        <div className="theme-switch" id="themeToggle" onClick={() => setIsDarkTheme(!isDarkTheme)} aria-label="Cambiar tema">
          <div className="switch-knob" style={{ transform: isDarkTheme ? 'translateX(28px)' : 'translateX(0)' }}>
            <i className={`fas ${isDarkTheme ? 'fa-moon' : 'fa-sun'}`}></i>
          </div>
        </div>
        <img src="/logo%20xero.png" alt="Radio Xero Logo" className="main-logo" />
      </header>

      <div className="main-wrapper">
        {/* ─── LIVE TICKER ─── */}
        <div className="rx-ticker-container">
          <div className="rx-ticker-header">
            <i className="fas fa-star rx-star-pulse"></i> LIVE
          </div>
          <div className="rx-ticker-wrapper">
            <div className={`rx-ticker-item ${currentTickerIndex === 0 ? 'active' : ''}`}>
              <span className="ticker-label"><i className="fas fa-user-plus text-cyan"></i> SEGUIDOR:</span>
              <span className="ticker-val">{tickerFollowUser}</span>
            </div>
            <div className={`rx-ticker-item ${currentTickerIndex === 1 ? 'active' : ''}`}>
              <span className="ticker-label"><i className="fas fa-gift text-pink"></i> REGALO:</span>
              <span className="ticker-val" dangerouslySetInnerHTML={{ __html: tickerGiftUser }}></span>
            </div>
            <div className={`rx-ticker-item ${currentTickerIndex === 2 ? 'active' : ''}`}>
              <span className="ticker-label"><i className="fas fa-trophy text-yellow"></i> TOP:</span>
              <span className="ticker-val" dangerouslySetInnerHTML={{ __html: tickerTopUser }}></span>
            </div>
          </div>
        </div>

        {/* ─── CUSTOM PLAYER CARD ─── */}
        <section className="card player-card">
          
          {/* TikTok Live Alert Overlay */}
          <div className={`rx-alert-overlay ${alertActive ? 'active' : ''}`}>
            <div className="rx-alert-video-container">
              <video ref={alertVideoRef} onEnded={finishAlert} muted playsInline></video>
              
              <div className="rx-alert-info-layer">
                <img className="rx-alert-avatar" src={alertAvatar} alt="Avatar" />
                <div className="rx-alert-username">{alertUser}</div>
                <div className="rx-alert-message" dangerouslySetInnerHTML={{ __html: alertMsg }}></div>
              </div>
            </div>
          </div>

          <div className="rx-player-content">
            {/* Double Avatar Videos Loop */}
            <div className={`rx-small-logo ${!isPlaying ? 'is-paused' : ''}`}>
              <video 
                ref={avatarVideo1Ref} 
                className={`rx-avatar-video ${activeAvatarIndex === 1 ? 'active' : ''}`}
                onEnded={() => handleAvatarVideoEnded(1)}
                autoPlay 
                muted 
                playsInline
              ></video>
              <video 
                ref={avatarVideo2Ref} 
                className={`rx-avatar-video ${activeAvatarIndex === 2 ? 'active' : ''}`}
                onEnded={() => handleAvatarVideoEnded(2)}
                muted 
                playsInline
              ></video>
            </div>

            <div className="rx-player-bottom-group">
              {/* Dynamic Visualizers Layout */}
              <div className="rx-viz-layout-wrapper">
                
                {/* Left Side: General Gift Alert */}
                <div className={`rx-viz-side rx-viz-side-left rx-side-card ${currentGift.videoUrl && !currentGift.isOneCoin ? 'has-video' : ''}`}>
                  <div className="rx-side-header">Gifts</div>
                  <div className="rx-side-body">
                    {currentGift.videoUrl && !currentGift.isOneCoin ? (
                      <>
                        <video src={currentGift.videoUrl} autoPlay muted loop playsInline className="rx-side-video"></video>
                        <div className="rx-side-username">{currentGift.username}</div>
                      </>
                    ) : (
                      <div className="rx-side-placeholder">Esperando regalo...</div>
                    )}
                  </div>
                </div>

                {/* Center Visualizer Frame */}
                <div className="rx-viz-area" id="rxVizArea">
                  <div className="rx-viz-bg-anim"></div>

                  <div className="rx-viz-selector">
                    <span className="rx-viz-title-badge" onClick={() => {
                      const modes = ['led', 'bars', 'wave']
                      const next = modes[(modes.indexOf(vizMode) + 1) % modes.length]
                      setVizMode(next)
                    }}>
                      <i className="fas fa-th"></i> {vizMode.toUpperCase()}
                    </span>
                  </div>

                  {/* LED VU Mode Container */}
                  <div className="rx-viz-container" style={{ display: vizMode === 'led' ? 'flex' : 'none' }}>
                    <div className="rx-vu-row">
                      <span className="rx-vu-label">L</span>
                      <div ref={vuLRef} className="rx-vu-meter">
                        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
                          <div key={i} className="rx-vu-segment"></div>
                        ))}
                      </div>
                    </div>
                    <div className="rx-vu-row">
                      <span className="rx-vu-label">R</span>
                      <div ref={vuRRef} className="rx-vu-meter">
                        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
                          <div key={i} className="rx-vu-segment"></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Canvas Mode */}
                  <canvas 
                    ref={canvasRef} 
                    className="rx-viz-canvas" 
                    style={{ display: vizMode !== 'led' ? 'block' : 'none' }}
                  ></canvas>
                </div>

                {/* Right Side: 1 Coin Gift Alert */}
                <div className={`rx-viz-side rx-viz-side-right rx-side-card ${currentGift.videoUrl && currentGift.isOneCoin ? 'has-video' : ''}`}>
                  <div className="rx-side-header">1 Coins</div>
                  <div className="rx-side-body">
                    {currentGift.videoUrl && currentGift.isOneCoin ? (
                      <>
                        <video src={currentGift.videoUrl} autoPlay muted loop playsInline className="rx-side-video"></video>
                        <div className="rx-side-username">{currentGift.username}</div>
                      </>
                    ) : (
                      <div className="rx-side-placeholder">Esperando 🪙...</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Metadata block */}
              <div className="rx-meta">
                <div className="rx-live-label">
                  <span className={`rx-dot ${isPlaying ? 'playing' : ''}`}></span>
                  {statusText}
                </div>

                <div className="rx-track">
                  <i className="fas fa-music rx-track-icon"></i>
                  <div className="rx-track-scroller">
                    <div className="rx-track-content">
                      <span>{trackTitle}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Controls */}
              <div className="rx-controls">
                <button className="rx-play-btn" onClick={handleTogglePlay} aria-label="Reproducir / Pausar">
                  {isPlaying ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="4" width="4" height="16" fill="currentColor" />
                      <rect x="15" y="4" width="4" height="16" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <polygon points="6,4 20,12 6,20" fill="currentColor" />
                    </svg>
                  )}
                </button>

                <div className="rx-vol">
                  <button className="rx-mute-btn" onClick={handleToggleMute} aria-label="Silenciar">
                    {isMuted ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '18px', height: '18px' }}>
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '18px', height: '18px' }}>
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>
                  <div className="rx-vol-container">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={volume} 
                      className="rx-vol-slider" 
                      onChange={(e) => handleVolumeChange(e.target.value)}
                      aria-label="Volumen" 
                    />
                    <span className="rx-vol-value">{volume}%</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Share Section info grid */}
        <div className="info-grid">
          <section className="card info-card">
            <h2>
              <div className="rx-icon-wrap rx-icon-share">
                <div></div>
                <div></div>
                <div></div>
              </div>
              Comparte el Sonido
            </h2>
            <p style={{ marginBottom: '0.5rem' }}>Lleva la mejor música a todas partes. Comparte el enlace con tus amigos y expande la experiencia Xero.</p>

            <div className="social-grid">
              <a href="https://api.whatsapp.com/send?text=Sintoniza%20Radio%20Xero%20http%3A%2F%2Flocalhost%3A3000%2F" target="_blank" rel="noopener noreferrer" className="social-btn whatsapp">
                <i className="fab fa-whatsapp"></i>
              </a>
              <a href="https://www.facebook.com/sharer/sharer.php?u=http%3A%2F%2Flocalhost%3A3000%2F" target="_blank" rel="noopener noreferrer" className="social-btn facebook">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="https://twitter.com/intent/tweet?text=Sintoniza%20Radio%20Xero&url=http%3A%2F%2Flocalhost%3A3000%2F" target="_blank" rel="noopener noreferrer" className="social-btn twitter">
                <i className="fab fa-twitter"></i>
              </a>
            </div>
          </section>
        </div>
      </div>

      {/* Hidden Audio Tag */}
      <audio ref={audioRef} style={{ display: 'none' }}></audio>
    </div>
  )
}
