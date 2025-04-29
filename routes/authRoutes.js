// routes/authRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

// Ruta Raíz '/' - Maneja la redirección o muestra el login
router.get('/', authController.handleRootGet); // [cite: 25]

// Procesar Login (POST)
router.post('/login', authController.handleLoginPost); // [cite: 26]

// Ruta Logout (GET)
router.get('/logout', authController.handleLogout); // [cite: 333]

// Ruta para verificar la sesión del usuario (para frontend)
router.get('/api/session/user', authController.getSessionUser); // Ruta API nueva

module.exports = router;