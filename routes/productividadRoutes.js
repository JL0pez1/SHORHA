// routes/productividadRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { checkAuthenticated } = require('../middleware/authMiddleware');

// GET /api/productividad/metricas
router.get('/metricas', checkAuthenticated, async (req, res) => {
    const sql = 'SELECT id_metrica, nombre_metrica, unidad_medida, descripcion FROM metricas ORDER BY nombre_metrica';
    try {
        const [metricas] = await db.promise().query(sql);
        res.json({ success: true, metricas: metricas || [] });
    } catch (error) {
        console.error('Error al obtener métricas de productividad:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al obtener lista de métricas.' });
    }
});

// GET /api/productividad/registros/:idColaborador
router.get('/registros/:idColaborador', checkAuthenticated, async (req, res) => {
    const idColaborador = req.params.idColaborador;

    if (!idColaborador || isNaN(parseInt(idColaborador))) {
        return res.status(400).json({ success: false, message: 'ID de colaborador inválido.' });
    }

    const sql = `
        SELECT
            rm.id_registro,
            rm.fecha_registro,
            rm.valor_medido,
            m.nombre_metrica,
            m.unidad_medida
        FROM registro_metricas_empleado rm
        JOIN metricas m ON rm.id_metrica = m.id_metrica
        WHERE rm.id_colaborador = ?
        ORDER BY rm.fecha_registro DESC, m.nombre_metrica ASC
    `;
    try {
        const [registros] = await db.promise().query(sql, [parseInt(idColaborador)]);
        const formattedRegistros = registros.map(reg => ({
            ...reg,
            fecha_registro: reg.fecha_registro ? new Date(reg.fecha_registro).toISOString().split('T')[0] : null
        }));
        res.json({ success: true, registros: formattedRegistros || [] });
    } catch (error) {
        console.error(`Error al obtener registros de productividad para colaborador ${idColaborador}:`, error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al obtener los registros de productividad.' });
    }
});

// POST /api/productividad/registrar
router.post('/registrar', checkAuthenticated, async (req, res) => {
    const { id_colaborador, fecha_registro, metricas } = req.body;

    if (!id_colaborador || isNaN(parseInt(id_colaborador)) || !fecha_registro || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_registro) || !Array.isArray(metricas) || metricas.length === 0) {
        return res.status(400).json({ success: false, message: 'Datos incompletos o formato incorrecto. Se requiere id_colaborador (número), fecha_registro (YYYY-MM-DD) y un array de métricas.' });
    }

    const values = [];
    for (const metrica of metricas) {
        if (metrica.id_metrica != null && !isNaN(parseInt(metrica.id_metrica)) &&
            metrica.valor_medido != null && metrica.valor_medido !== '' && !isNaN(parseFloat(metrica.valor_medido))) {
            values.push([
                parseInt(id_colaborador),
                parseInt(metrica.id_metrica),
                fecha_registro,
                parseFloat(metrica.valor_medido)
            ]);
        } else {
            console.warn("Datos de métrica inválidos o incompletos omitidos en productividad/registrar:", metrica);
        }
    }

    if (values.length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionaron valores de métricas válidos para registrar.' });
    }

    const sql = 'INSERT INTO registro_metricas_empleado (id_colaborador, id_metrica, fecha_registro, valor_medido) VALUES ?';
    
    try {
        const [result] = await db.promise().query(sql, [values]);
        res.status(201).json({
            success: true,
            message: `Productividad registrada exitosamente para ${result.affectedRows} métrica(s).`,
            insertedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Error al registrar productividad:', error);
        let userMessage = 'Error interno del servidor al guardar los datos de productividad.';
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            userMessage = 'Error de referencia: ';
            if (error.message.includes('`id_colaborador`')) {
                userMessage += 'El ID de colaborador no existe.';
            } else if (error.message.includes('`id_metrica`')) {
                userMessage += 'Una de las IDs de métrica no existe.';
            } else {
                userMessage += 'Clave foránea no válida.';
            }
            return res.status(400).json({ success: false, message: userMessage });
        }
        res.status(500).json({ success: false, message: userMessage });
    }
});

module.exports = router;