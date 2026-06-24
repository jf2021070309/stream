const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// Cargar configuración
const configPath = path.join(__dirname, 'config.json');
let config = { tiktokUsername: 'radioxero26', port: 3000 };
if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error('Error al leer config.json, usando valores por defecto:', e);
    }
}

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del reproductor si se decide usar localmente
app.use(express.static(path.join(__dirname, '../')));

// Ruta para simular regalos de prueba (Rosa, Helado, Tiktok, Corazón)
app.get('/test-gift', (req, res) => {
    const giftName = req.query.name || 'rosa';
    const username = req.query.user || 'usuario_demo';
    
    console.log(`🧪 [TEST] Simulando regalo "${giftName}" enviado por @${username}`);
    io.emit('gift', {
        username: username,
        nickname: username,
        giftName: giftName,
        giftId: 1000,
        repeatCount: 1,
        timestamp: Date.now()
    });
    
    res.send(`Alerta de regalo simulada con éxito. Tipo: "${giftName}", Usuario: @${username}`);
});

// Ruta para obtener la configuración de alertas (CRUD - Read)
app.get('/api/alerts-config', (req, res) => {
    const filePath = path.join(__dirname, '../alerts-config.json');
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            return res.json(JSON.parse(data));
        } catch (e) {
            return res.status(500).json({ error: 'Error al leer alerts-config.json' });
        }
    }
    return res.json([]);
});

// Ruta para guardar la configuración de alertas (CRUD - Create/Update/Delete)
app.post('/api/alerts-config', (req, res) => {
    const filePath = path.join(__dirname, '../alerts-config.json');
    try {
        const newConfig = req.body;
        fs.writeFileSync(filePath, JSON.stringify(newConfig, null, 2), 'utf8');
        console.log('📝 Configuración de alertas guardada con éxito.');
        return res.json({ success: true, message: 'Configuración guardada correctamente' });
    } catch (e) {
        console.error('Error al escribir alerts-config.json:', e);
        return res.status(500).json({ error: 'Error al escribir el archivo de configuración' });
    }
});

// Obtener usuario de TikTok actual
app.get('/api/tiktok-username', (req, res) => {
    return res.json({ tiktokUsername: config.tiktokUsername });
});

// Guardar/Actualizar usuario de TikTok
app.post('/api/tiktok-username', (req, res) => {
    try {
        const { username } = req.body;
        if (!username) {
            return res.status(400).json({ error: 'Nombre de usuario requerido' });
        }
        
        config.tiktokUsername = username;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log(`👤 Usuario de TikTok actualizado a: @${username}`);
        
        // Re-establecer conexión
        reconnectTikTok(username);
        
        return res.json({ success: true, username: username });
    } catch (e) {
        console.error('Error al actualizar el usuario:', e);
        return res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let tiktokUsername = config.tiktokUsername;
console.log(`Iniciando servidor para el usuario de TikTok: @${tiktokUsername}`);

// Importación segura y compatible con tiktok-live-connector v1.x y v2.x
const tiktokConnector = require('tiktok-live-connector');
let TikTokLiveConnectionClass;

if (tiktokConnector.TikTokLiveConnection) {
    TikTokLiveConnectionClass = tiktokConnector.TikTokLiveConnection;
} else if (tiktokConnector.WebcastPushConnection) {
    TikTokLiveConnectionClass = tiktokConnector.WebcastPushConnection;
} else {
    console.error('ERROR CRÍTICO: No se encontró la clase de conexión en tiktok-live-connector.');
    process.exit(1);
}

let connection = new TikTokLiveConnectionClass(tiktokUsername, {});
let isConnectedToTikTok = false;

// Conectar a la transmisión de TikTok
function connectToTikTok() {
    if (!tiktokUsername || tiktokUsername === 'tu_usuario_de_tiktok') {
        console.warn('\n⚠️  ¡ATENCIÓN! Debes configurar tu nombre de usuario de TikTok en "config.json" para conectarte en vivo.\n');
        return;
    }

    console.log(`Intentando conectar a TikTok Live de @${tiktokUsername}...`);
    connection.connect().then(state => {
        console.log(`✅ ¡Conectado con éxito a la transmisión de @${tiktokUsername}! (Room ID: ${state.roomId})`);
        isConnectedToTikTok = true;
        io.emit('server_status', {
            connected: true,
            tiktokUsername: tiktokUsername
        });
    }).catch(err => {
        console.error(`❌ Error al conectar a TikTok Live. ¿El usuario @${tiktokUsername} está en vivo actualmente?`);
        console.error('Detalle del error:', err.message || err);
        isConnectedToTikTok = false;
        io.emit('server_status', {
            connected: false,
            tiktokUsername: tiktokUsername
        });
        console.log('Reintentando conexión en 15 segundos...');
        setTimeout(connectToTikTok, 15000);
    });
}

function reconnectTikTok(newUsername) {
    console.log(`🔄 Re-conectando a TikTok Live para el nuevo usuario: @${newUsername}...`);
    try {
        if (connection) {
            connection.disconnect();
        }
    } catch (e) {
        console.warn('Error al detener conexión previa:', e);
    }
    
    tiktokUsername = newUsername;
    connection = new TikTokLiveConnectionClass(newUsername, {});
    bindConnectionEvents();
    connectToTikTok();
}

function bindConnectionEvents() {
    // Escuchar eventos de TikTok y retransmitirlos por Socket.io
    connection.on('chat', data => {
        const user = data.user || data;
        io.emit('chat', {
            username: user.uniqueId,
            nickname: user.nickname,
            comment: data.comment
        });
    });

    connection.on('gift', data => {
        const user = data.user || data;
        const repeatCount = data.repeatCount || 1;
        console.log(`🎁 [REGALO] ${user.uniqueId} envió "${data.giftName}" x${repeatCount}`);

        io.emit('gift', {
            username: user.uniqueId,
            nickname: user.nickname,
            profilePictureUrl: user.profilePictureUrl,
            giftName: data.giftName,
            giftId: data.giftId,
            repeatCount: repeatCount,
            timestamp: Date.now()
        });
    });

    connection.on('follow', data => {
        const user = data.user || data;
        console.log(`👤 [SEGUIDOR] ${user.uniqueId} te comenzó a seguir!`);
        io.emit('follow', {
            username: user.uniqueId,
            nickname: user.nickname
        });
    });

    connection.on('share', data => {
        const user = data.user || data;
        console.log(`🔗 [COMPARTIDO] ${user.uniqueId} compartió el directo!`);
        io.emit('share', {
            username: user.uniqueId,
            nickname: user.nickname
        });
    });

    connection.on('like', data => {
        const user = data.user || data;
        // Solo enviar eventos significativos de likes para no saturar la red
        if (data.likeCount && data.likeCount % 100 === 0) {
            io.emit('like', {
                username: user.uniqueId,
                nickname: user.nickname,
                totalLikes: data.totalLikeCount
            });
        }
    });

    connection.on('disconnected', () => {
        console.warn('⚠️ Se perdió la conexión con TikTok Live. Intentando reconectar...');
        isConnectedToTikTok = false;
        io.emit('server_status', {
            connected: false,
            tiktokUsername: tiktokUsername
        });
        setTimeout(connectToTikTok, 10000);
    });
}

// Inicializar eventos
bindConnectionEvents();

// Conexión de clientes Web (nuestra página index.html)
io.on('connection', (socket) => {
    console.log(`💻 Cliente Web conectado (ID: ${socket.id})`);

    // Enviar estado de conexión inicial
    socket.emit('server_status', {
        connected: isConnectedToTikTok,
        tiktokUsername: tiktokUsername
    });

    socket.on('disconnect', () => {
        console.log(`💻 Cliente Web desconectado (ID: ${socket.id})`);
    });
});

// Iniciar servidor HTTP y WebSockets
const PORT = config.port || 3000;
server.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 Servidor de alertas corriendo en: http://localhost:${PORT}`);
    console.log(`📂 Servirá los archivos estáticos de tu reproductor.`);
    console.log(`===================================================`);

    connectToTikTok();
});
