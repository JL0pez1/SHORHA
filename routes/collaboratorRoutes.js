// routes/collaboratorRoutes.js
const express = require('express');
// Importamos el middleware actualizado que incluye 'productividad' y 'recursos'
const { checkAuthenticated, checkAccessRrhhFeatures } = require('../middleware/authMiddleware'); 
const collaboratorController = require('../controllers/collaboratorController');
const router = express.Router();

// Ruta especial para que el colaborador obtenga sus propios datos (solo necesita estar autenticado)
router.get('/colaborador/data', checkAuthenticated, collaboratorController.getCollaboratorProfileData);

// Rutas CRUD para administrar colaboradores
// Ahora usamos checkAccessRrhhFeatures para permitir a 'productividad', 'recursos', 'nominas', etc.
// Estas rutas son consumidas por administrativo.html y recursos.html, y potencialmente productividad.html
router.get('/', checkAccessRrhhFeatures, collaboratorController.getAllCollaborators);
router.post('/', checkAccessRrhhFeatures, collaboratorController.createCollaborator);
router.get('/:id', checkAccessRrhhFeatures, collaboratorController.getCollaboratorById); // Clave para "Buscar Empleado"
router.put('/:id', checkAccessRrhhFeatures, collaboratorController.updateCollaborator);
router.delete('/:id', checkAccessRrhhFeatures, collaboratorController.deleteCollaborator);

module.exports = router;