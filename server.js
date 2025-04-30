// server.js
require('dotenv').config(); // Carga variables de entorno desde .env [cite: 1]
const express = require('express');
const bodyParser = require('body-parser'); // Middleware para parsear bodies de requests [cite: 2]
const path = require('path'); // Utilidad para manejar rutas de archivos [cite: 3]
const session = require('express-session'); // Middleware para manejar sesiones [cite: 3]
const db = require('./config/db'); // Importa la conexión a la BD (ya se conecta dentro) [cite: 4, 5]

// Importar Routers
const authRoutes = require('./routes/authRoutes');
const viewRoutes = require('./routes/viewRoutes');
const userRoutes = require('./routes/userRoutes');
const collaboratorRoutes = require('./routes/collaboratorRoutes');
const contractRoutes = require('./routes/contractRoutes');
const productividadRoutes = require('./routes/productividadRoutes');


const app = express(); // [cite: 4]
const PORT = process.env.PORT || 3000; // Puerto del servidor [cite: 4]

// --- Middlewares Globales ---
app.use(bodyParser.urlencoded({ extended: true })); // Para formularios HTML [cite: 6]
app.use(bodyParser.json()); // Para peticiones API con JSON [cite: 7]
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos [cite: 7]

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'CAMBIAME_POR_UN_SECRETO_REAL_Y_SEGURO_EN_ENV', // ¡MUY IMPORTANTE CAMBIAR ESTO! [cite: 8]
    resave: false, // [cite: 8]
    saveUninitialized: false, // GDPR Compliance & best practice [cite: 9]
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción [cite: 9]
        httpOnly: true, // Seguridad: previene acceso desde JS [cite: 9]
        maxAge: 24 * 60 * 60 * 1000, // 1 día de duración [cite: 9]
        // sameSite: 'Lax' // Buena práctica para prevenir CSRF [cite: 9]
    }
}));

// --- Montaje de Rutas ---
app.use('/', authRoutes); // Rutas de autenticación (incluye '/', /login, /logout)

console.log('viewRoutes:', viewRoutes);
app.use('/', viewRoutes); // Rutas para servir HTML protegidos (ej: /admin, /colaborador)

console.log('userRoutes:', userRoutes);
app.use('/api/users', userRoutes);

// Montar rutas API bajo un prefijo '/api' es una buena práctica
console.log('authRoutes:', authRoutes);
app.use('/', authRoutes); // [cite: 51]
console.log('collaboratorRoutes:', collaboratorRoutes);
app.use('/api', collaboratorRoutes);
 // Nota: Montado en /api para que coincida /api/colaboradores y /api/colaborador/data

 console.log('contractRoutes:', contractRoutes);
 app.use('/api/contratos', contractRoutes); // [cite: 273, 318]

 app.use('/api/productividad', productividadRoutes);

// --- Manejo de 404 (Rutas no encontradas) ---
// Este debe ir DESPUÉS de todas las rutas definidas
app.use((req, res, next) => { // [cite: 335]
    res.status(404).send(`
        <!DOCTYPE html><html><head><title>404 - No Encontrado</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} a{color: #007bff; text-decoration: none;} a:hover{text-decoration: underline;}</style></head>
        <body><h1><i class="fas fa-map-signs"></i> 404 - Página No Encontrada</h1><p>La ruta solicitada <strong>${req.originalUrl}</strong> no existe.</p><p><a href="/">Volver al inicio</a></p></body></html>
    `); // [cite: 335] (HTML mejorado)
});

// --- Manejo de Errores Generales ---
// Este middleware captura errores no manejados en las rutas anteriores
app.use((err, req, res, next) => { // [cite: 336]
    console.error('Unhandled error:', err.stack); // Log completo del stack trace [cite: 336]
    res.status(500).send(`
        <!DOCTYPE html><html><head><title>500 - Error del Servidor</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} pre{white-space: pre-wrap; word-wrap: break-word; text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;}</style></head>
        <body><h1><i class="fas fa-server"></i> 500 - Error Interno del Servidor</h1><p>Ha ocurrido un error inesperado procesando tu solicitud.</p>
        ${process.env.NODE_ENV !== 'production' ? `<details><summary>Detalles del error (Solo en desarrollo)</summary><pre>${err.stack}</pre></details>` : ''}
        <p><a href="/">Volver al inicio</a></p></body></html>
    `); // [cite: 337] (HTML mejorado, muestra stack solo en desarrollo)
});

// --- Iniciar Servidor ---
app.listen(PORT, () => { // [cite: 337]
    console.log(`Servidor corriendo en http://localhost:${PORT}`); // [cite: 337]
});