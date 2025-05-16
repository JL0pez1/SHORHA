// routes/collaboratorRoutes.js
const express = require('express');
// Importamos el nuevo middleware y mantenemos checkAuthenticated
const { checkAuthenticated, checkAccessRrhhFeatures } = require('../middleware/authMiddleware');
const collaboratorController = require('../controllers/collaboratorController');
const router = express.Router();

// Ruta especial para que el colaborador obtenga sus propios datos
// Solo requiere estar autenticado (sin cambio aquí, esto es para el perfil del propio colaborador)
router.get('/colaborador/data', checkAuthenticated, collaboratorController.getCollaboratorProfileData);

// Rutas CRUD para administrar colaboradores
// Ahora usamos checkAccessRrhhFeatures para permitir a 'recursos', 'nominas', etc.
router.get('/', checkAccessRrhhFeatures, collaboratorController.getAllCollaborators);
router.post('/', checkAccessRrhhFeatures, collaboratorController.createCollaborator);
router.get('/:id', checkAccessRrhhFeatures, collaboratorController.getCollaboratorById); // Esta es la que fallaba
router.put('/:id', checkAccessRrhhFeatures, collaboratorController.updateCollaborator);
router.delete('/:id', checkAccessRrhhFeatures, collaboratorController.deleteCollaborator);

module.exports = router;