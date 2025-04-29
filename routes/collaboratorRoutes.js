// routes/collaboratorRoutes.js
const express = require('express');
const { checkAuthenticated, checkAdministrativoOrAdmin } = require('../middleware/authMiddleware');
const collaboratorController = require('../controllers/collaboratorController');
const router = express.Router();

// Ruta especial para que el colaborador obtenga sus propios datos
// Solo requiere estar autenticado
router.get('/colaborador/data', checkAuthenticated, collaboratorController.getCollaboratorProfileData); // [cite: 289]

// Rutas CRUD para administrar colaboradores (requieren rol administrativo o admin)
router.get('/', checkAdministrativoOrAdmin, collaboratorController.getAllCollaborators); // [cite: 84]
router.post('/', checkAdministrativoOrAdmin, collaboratorController.createCollaborator); // [cite: 87]
router.get('/:id', checkAdministrativoOrAdmin, collaboratorController.getCollaboratorById); // [cite: 76]
router.put('/:id', checkAdministrativoOrAdmin, collaboratorController.updateCollaborator); // [cite: 128]
router.delete('/:id', checkAdministrativoOrAdmin, collaboratorController.deleteCollaborator); // [cite: 243]


module.exports = router;