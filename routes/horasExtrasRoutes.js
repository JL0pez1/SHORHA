// routes/horasExtrasRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ajusta la ruta a tu archivo de conexión a BD
const { checkAccessRrhhFeatures } = require('../middleware/authMiddleware'); // Middleware de autorización

// GET /api/horasextras/empleado/:id_empleado?fecha_inicio=YYYY-MM-DD&fecha_fin=YYYY-MM-DD
// Protegido para que solo roles de RRHH/Nóminas/Admin puedan consultar horas extra.
router.get('/empleado/:id_empleado', checkAccessRrhhFeatures, async (req, res) => {
    const { id_empleado } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    if (!id_empleado || isNaN(parseInt(id_empleado))) {
        return res.status(400).json({ success: false, message: 'ID de empleado es requerido y debe ser un número.' });
    }

    let sql = 'SELECT id_extra, fecha, horas, tipo FROM horas_extras WHERE id_empleado = ?';
    const params = [parseInt(id_empleado)];

    // Validar y añadir filtros de fecha si se proporcionan
    if (fecha_inicio && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha_inicio inválido. Use YYYY-MM-DD.' });
    }
    if (fecha_fin && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha_fin inválido. Use YYYY-MM-DD.' });
    }

    if (fecha_inicio && fecha_fin) {
        sql += ' AND fecha BETWEEN ? AND ?';
        params.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
        sql += ' AND fecha >= ?';
        params.push(fecha_inicio);
    } else if (fecha_fin) {
        sql += ' AND fecha <= ?';
        params.push(fecha_fin);
    }

    sql += ' ORDER BY fecha DESC';

    try {
        const [rows] = await db.promise().query(sql, params);
        const formattedResults = rows.map(he => ({
            ...he,
            fecha: he.fecha ? new Date(he.fecha).toISOString().split('T')[0] : null
        }));
        res.json({ success: true, data: formattedResults });
    } catch (error) {
        console.error("Error obteniendo horas extras del empleado:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al obtener horas extras.' });
    }
});

// POST /api/horasextras
// Protegido para que solo roles de RRHH/Nóminas/Admin puedan agregar horas extra.
router.post('/', checkAccessRrhhFeatures, async (req, res) => {
    const { id_empleado, fecha, horas, tipo = 'normal' } = req.body;

    if (!id_empleado || !fecha || !horas) {
        return res.status(400).json({ success: false, message: 'ID de empleado, fecha y horas son requeridos.' });
    }
    if (isNaN(parseInt(id_empleado))) {
        return res.status(400).json({ success: false, message: 'ID de empleado debe ser un número.' });
    }
    if (isNaN(parseFloat(horas)) || parseFloat(horas) <= 0) {
        return res.status(400).json({ success: false, message: 'Las horas deben ser un número positivo.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }
    const tiposValidos = ['normal', 'doble', 'feriado'];
    if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ success: false, message: `Tipo de hora extra inválido. Valores permitidos: ${tiposValidos.join(', ')}.` });
    }

    const sql = 'INSERT INTO horas_extras (id_empleado, fecha, horas, tipo) VALUES (?, ?, ?, ?)';
    try {
        const [result] = await db.promise().query(sql, [parseInt(id_empleado), fecha, parseFloat(horas), tipo]);
        res.status(201).json({ 
            success: true, 
            message: 'Horas extra agregadas exitosamente.', 
            id_extra: result.insertId,
            data: { id_extra: result.insertId, id_empleado: parseInt(id_empleado), fecha, horas: parseFloat(horas), tipo} 
        });
    } catch (error) {
        console.error("Error agregando horas extras:", error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ success: false, message: 'El ID de empleado proporcionado no existe en la tabla de colaboradores.' });
        }
        res.status(500).json({ success: false, message: 'Error interno del servidor al agregar horas extras.' });
    }
});

module.exports = router;