// routes/contractRoutes.js
const express = require('express');
const { checkAdministrativoOrAdmin } = require('../middleware/authMiddleware'); // O solo checkAdmin si prefieres
const contractController = require('../controllers/contractController');
const router = express.Router();

// Proteger todas las rutas de contratos
router.use(checkAdministrativoOrAdmin); // Middleware aplicado a todas las rutas siguientes

router.get('/', contractController.getAllContracts); // [cite: 273, 318]
router.post('/', contractController.createContract); // [cite: 277, 322]
router.get('/:id', contractController.getContractById); // [cite: 275, 320]
router.put('/:id', contractController.updateContract); // [cite: 280, 325]
router.delete('/:id', contractController.deleteContract); // [cite: 285, 330]

module.exports = router;