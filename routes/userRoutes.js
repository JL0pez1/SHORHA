// routes/userRoutes.js
const express = require('express');
const { checkAdmin } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');
const router = express.Router();

// Todas estas rutas requieren rol de admin
router.get('/', checkAdmin, userController.getAllUsers); // [cite: 51]
router.post('/', checkAdmin, userController.createUser); // [cite: 54]
router.get('/:id', checkAdmin, userController.getUserById); // [cite: 53]
router.put('/:id', checkAdmin, userController.updateUser); // [cite: 60]
router.delete('/:id', checkAdmin, userController.deleteUser); // [cite: 71]

module.exports = router;