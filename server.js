// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const db = require('./config/db');

// Importar Routers
const authRoutes = require('./routes/authRoutes');
const viewRoutes = require('./routes/viewRoutes'); // Deja la importación
const userRoutes = require('./routes/userRoutes'); // Deja la importación
const collaboratorRoutes = require('./routes/collaboratorRoutes'); // Deja la importación
const contractRoutes = require('./routes/contractRoutes'); // Deja la importación
const productividadRoutes = require('./routes/productividadRoutes'); // Deja la importación
const reportesRoutes = require('./routes/reportesRoutes'); // Deja la importación


const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Globales ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'CAMBIAME_POR_UN_SECRETO_REAL_Y_SEGURO_EN_ENV',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        // sameSite: 'Lax'
    }
}));

// --- Montaje de Rutas ---

// console.log('Valor de authRoutes antes del primer app.use:', authRoutes); // Puedes dejar o comentar este log
app.use('/', authRoutes); // **DEJA SÓLO ESTA LÍNEA DE TUS RUTAS PERSONALIZADAS**

 app.use('/api/reportes', reportesRoutes);
console.log('viewRoutes:', viewRoutes);
 app.use('/', viewRoutes);
 console.log('userRoutes:', userRoutes);
 app.use('/api/users', userRoutes);
 console.log('authRoutes:', authRoutes); // Comenta si dejaste el log de arriba
 app.use('/', authRoutes); // Comenta esta línea redundante
 console.log('collaboratorRoutes:', collaboratorRoutes);
 app.use('/api', collaboratorRoutes);
 console.log('contractRoutes:', contractRoutes);
 app.use('/api/contratos', contractRoutes);
app.use('/api/productividad', productividadRoutes);


// --- Manejo de 404 (Rutas no encontradas) ---
// Deja este middleware
app.use((req, res, next) => {
    res.status(404).send(`
        <!DOCTYPE html><html><head><title>404 - No Encontrado</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} a{color: #007bff; text-decoration: none;} a:hover{text-decoration: underline;}</style></head>
        <body><h1><i class="fas fa-map-signs"></i> 404 - Página No Encontrada</h1><p>La ruta solicitada <strong>${req.originalUrl}</strong> no existe.</p><p><a href="/">Volver al inicio</a></p></body></html>
    `);
});

// --- Manejo de Errores Generales ---
// Deja este middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).send(`
        <!DOCTYPE html><html><head><title>500 - Error del Servidor</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} pre{white-space: pre-wrap; word-wrap: break-word; text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;}</style></head>
        <body><h1><i class="fas fa-server"></i> 500 - Error Interno del Servidor</h1><p>Ha ocurrido un error inesperado procesando tu solicitud.</p>
        ${process.env.NODE_ENV !== 'production' ? `<details><summary>Detalles del error (Solo en desarrollo)</summary><pre>${err.stack}</pre></details>` : ''}
        <p><a href="/">Volver al inicio</a></p></body></html>
    `);
});


// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});