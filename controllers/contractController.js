// controllers/contractController.js
const db = require('../config/db');

// GET /api/contratos - Listar todos
const getAllContracts = (req, res) => {
    const sql = 'SELECT * FROM contratos ORDER BY nombre_contrato ASC'; // [cite: 273]
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error DB get all contratos:", err); // [cite: 274]
            return res.status(500).json({ success: false, message: 'Error interno del servidor al listar tipos de contrato.' }); // [cite: 274]
        }
        res.json({ success: true, data: results }); // [cite: 274]
    });
};

// GET /api/contratos/:id - Obtener uno
const getContractById = (req, res) => {
    const { id } = req.params; // [cite: 275]
    const sql = 'SELECT * FROM contratos WHERE id_contrato = ?'; // [cite: 275]
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error DB get contrato by id:", err); // [cite: 275]
            return res.status(500).json({ success: false, message: 'Error interno del servidor al obtener tipo de contrato.' }); // [cite: 276]
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado.' }); // [cite: 276]
        }
        res.json({ success: true, data: results[0] }); // [cite: 276]
    });
};

// POST /api/contratos - Crear uno
const createContract = (req, res) => {
    const { nombre_contrato, descripcion } = req.body; // [cite: 277]
    if (!nombre_contrato || nombre_contrato.trim() === '') { // [cite: 277]
        return res.status(400).json({ success: false, message: 'El nombre del contrato es obligatorio.' }); // [cite: 277]
    }
    const sql = 'INSERT INTO contratos (nombre_contrato, descripcion) VALUES (?, ?)'; // [cite: 277]
    const values = [nombre_contrato.trim(), descripcion ? descripcion.trim() : null]; // [cite: 277]
    db.query(sql, values, (err, result) => { // [cite: 278]
        if (err) {
            console.error("Error DB creating contrato:", err); // [cite: 278]
            if (err.code === 'ER_DUP_ENTRY') { // [cite: 278]
                return res.status(400).json({ success: false, message: 'Ya existe un tipo de contrato con este nombre.' }); // [cite: 278]
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al crear tipo de contrato.' }); // [cite: 279]
        }
        res.status(201).json({ success: true, message: 'Tipo de contrato creado exitosamente.', data: { id_contrato: result.insertId, nombre_contrato, descripcion } }); // [cite: 279]
    });
};

// PUT /api/contratos/:id - Actualizar uno
const updateContract = (req, res) => {
    const { id } = req.params; // [cite: 280]
    const { nombre_contrato, descripcion } = req.body; // [cite: 280]
    if (!nombre_contrato || nombre_contrato.trim() === '') { // [cite: 280]
        return res.status(400).json({ success: false, message: 'El nombre del contrato es obligatorio.' }); // [cite: 280]
    }
    const sql = 'UPDATE contratos SET nombre_contrato = ?, descripcion = ? WHERE id_contrato = ?'; // [cite: 280]
    const values = [nombre_contrato.trim(), descripcion ? descripcion.trim() : null, id]; // [cite: 281]
    db.query(sql, values, (err, result) => { // [cite: 281]
        if (err) {
            console.error("Error DB updating contrato:", err); // [cite: 281]
            if (err.code === 'ER_DUP_ENTRY') { // [cite: 281]
                return res.status(400).json({ success: false, message: 'Ya existe otro tipo de contrato con este nombre.' }); // [cite: 282]
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar tipo de contrato.' }); // [cite: 282]
        }
        if (result.affectedRows === 0) { // [cite: 283]
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado para actualizar.' }); // [cite: 284]
        }
        res.json({ success: true, message: 'Tipo de contrato actualizado exitosamente.' }); // [cite: 284]
    });
};

// DELETE /api/contratos/:id - Eliminar uno
const deleteContract = (req, res) => {
    const { id } = req.params; // [cite: 285]
    const sql = 'DELETE FROM contratos WHERE id_contrato = ?'; // [cite: 285]
    db.query(sql, [id], (err, result) => { // [cite: 285]
        if (err) {
            console.error("Error DB deleting contrato:", err); // [cite: 286]
            if (err.code === 'ER_ROW_IS_REFERENCED_2') { // [cite: 286]
                return res.status(400).json({ success: false, message: 'No se puede eliminar el tipo de contrato, hay colaboradores asociados a él.' }); // [cite: 286]
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar tipo de contrato.' }); // [cite: 287]
        }
        if (result.affectedRows === 0) { // [cite: 287]
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado para eliminar.' }); // [cite: 287]
        }
        res.json({ success: true, message: 'Tipo de contrato eliminado exitosamente.' }); // [cite: 287]
    });
};

module.exports = {
    getAllContracts,
    getContractById,
    createContract,
    updateContract,
    deleteContract
};