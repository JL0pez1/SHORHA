// routes/viewRoutes.js
const express = require('express');
const { checkAuthenticated } = require('../middleware/authMiddleware');
const { serveProtectedHtml, protectedHtmlRoutesConfig } = require('../controllers/viewController');
const router = express.Router();
// Generar rutas dinámicamente basadas en la configuración
Object.keys(protectedHtmlRoutesConfig).forEach(route => {
    // Aplicar primero el middleware de autenticación, luego el controlador que verifica roles y sirve el HTML
    router.get(route, checkAuthenticated, serveProtectedHtml); // [cite: 40]
});

module.exports = router;