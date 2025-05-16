// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const db = require('./config/db');

// Importar Routers
const authRoutes = require('./routes/authRoutes');
const viewRoutes = require('./routes/viewRoutes');
const userRoutes = require('./routes/userRoutes');
const collaboratorRoutes = require('./routes/collaboratorRoutes'); // <--- ESTA ES LA CLAVE
const contractRoutes = require('./routes/contractRoutes');
const productividadRoutes = require('./routes/productividadRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const horasExtrasRoutes = require('./routes/horasExtrasRoutes');
const nominaRoutes = require('./routes/nominaRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Globales ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'SORHA_SESSION_SECRET_REPLACE_ME_CAMBIAME',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        // sameSite: 'Lax'
    }
}));

// --- Montaje de Rutas ---
console.log('Montando rutas...');

// Rutas de autenticación y vistas HTML principales
app.use('/', authRoutes);
app.use('/', viewRoutes);

// Rutas API
app.use('/api/users', userRoutes);
// app.use('/api/colaboradores', collaboratorRoutes); // Comentamos o eliminamos esta
app.use('/api', collaboratorRoutes); // <--- CAMBIO PRINCIPAL AQUÍ: /api/ usa collaboratorRoutes directamente
                                      // Esto significa que GET /api/ -> getAllCollaborators
                                      // y GET /api/:id -> getCollaboratorById
app.use('/api/contratos', contractRoutes);
app.use('/api/productividad', productividadRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/horasextras', horasExtrasRoutes);
app.use('/api/nomina', nominaRoutes);

console.log('Rutas montadas exitosamente.');

// --- Manejo de 404 (Rutas no encontradas) ---
app.use((req, res, next) => {
    res.status(404).send(`
        <!DOCTYPE html><html><head><title>404 - No Encontrado</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} a{color: #007bff; text-decoration: none;} a:hover{text-decoration: underline;}</style></head>
        <body><h1><i class="fas fa-map-signs"></i> 404 - Página No Encontrada</h1><p>La ruta solicitada <strong>${req.originalUrl}</strong> no existe en este servidor.</p><p><a href="/">Volver al inicio</a></p></body></html>
    `);
});

// --- Manejo de Errores Generales ---
app.use((err, req, res, next) => {
    console.error('Unhandled application error:', err.stack);
    res.status(500).send(`
        <!DOCTYPE html><html><head><title>500 - Error del Servidor</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} pre{white-space: pre-wrap; word-wrap: break-word; text-align: left; background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6;}</style></head>
        <body><h1><i class="fas fa-server"></i> 500 - Error Interno del Servidor</h1><p>Ha ocurrido un error inesperado procesando tu solicitud.</p>
        ${process.env.NODE_ENV !== 'production' ? `<details><summary>Detalles del error (Solo en desarrollo)</summary><pre>${err.stack}</pre></details>` : ''}
        <p><a href="/">Volver al inicio</a></p></body></html>
    `);
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor SORHA corriendo en http://localhost:${PORT}`);
});