// routes/productividadRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ajusta la ruta si es necesario
// Asegúrate que checkAuthenticated existe y solo verifica si req.session.user existe
// checkAdministrativoOrAdmin y checkEmpleado ya no serían necesarios para estas rutas
const { checkAuthenticated /* , checkAdministrativoOrAdmin, checkEmpleado */ } = require('../middleware/authMiddleware');

// --- RUTA PARA OBTENER MÉTRICAS DISPONIBLES ---
// GET /api/productividad/metricas
// Cualquiera autenticado puede ver qué métricas existen. (SIN CAMBIOS)
router.get('/metricas', checkAuthenticated, async (req, res) => {
    const sql = 'SELECT id_metrica, nombre_metrica, unidad_medida, descripcion FROM metricas ORDER BY nombre_metrica';
    try {
        const [metricas] = await db.promise().query(sql);
        res.json({ success: true, metricas });
    } catch (error) {
        console.error('Error al obtener métricas:', error);
        res.status(500).json({ success: false, message: 'Error al obtener lista de métricas.' });
    }
});

// --- RUTA PARA CONSULTAR REGISTROS DE UN COLABORADOR ---
// GET /api/productividad/registros/:idColaborador
// Protegido: CUALQUIERA AUTENTICADO (checkAuthenticated) puede ver registros.
router.get('/registros/:idColaborador', checkAuthenticated, async (req, res) => {
    const idColaborador = req.params.idColaborador;

    // --- Lógica de Permisos OMITIDA ---
    // Se elimina el bloque if que verificaba roles/id_empleado.
    // checkAuthenticated ya garantizó que el usuario está logueado.
    // CUALQUIER USUARIO LOGUEADO PODRÁ VER LOS REGISTROS DE CUALQUIER ID_COLABORADOR

    // Consulta para obtener registros y nombre de la métrica
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
        const [registros] = await db.promise().query(sql, [idColaborador]);
        res.json({ success: true, registros });
    } catch (error) {
        console.error(`Error al obtener registros para colaborador ${idColaborador}:`, error);
        res.status(500).json({ success: false, message: 'Error al obtener los registros de productividad.' });
    }
});


// --- RUTA PARA REGISTRAR NUEVA PRODUCTIVIDAD ---
// POST /api/productividad/registrar
// Protegida: CUALQUIERA AUTENTICADO (checkAuthenticated) puede registrar.
// Puede registrar datos para CUALQUIER id_colaborador enviado en el body. ¡Cuidado!
router.post('/registrar', checkAuthenticated, async (req, res) => { // <-- Cambiado checkAdministrativoOrAdmin a checkAuthenticated
    const { id_colaborador, fecha_registro, metricas } = req.body;

    if (!id_colaborador || !fecha_registro || !Array.isArray(metricas) || metricas.length === 0) {
        return res.status(400).json({ success: false, message: 'Datos incompletos o formato incorrecto.' });
    }

    const sql = 'INSERT INTO registro_metricas_empleado (id_colaborador, id_metrica, fecha_registro, valor_medido) VALUES ?';
    const values = [];

    for (const metrica of metricas) {
        if (metrica.id_metrica != null && metrica.valor_medido != null && metrica.valor_medido !== '' && !isNaN(parseFloat(metrica.valor_medido))) {
            values.push([
                id_colaborador, // ¡Cualquier usuario autenticado puede enviar cualquier id_colaborador aquí!
                metrica.id_metrica,
                fecha_registro,
                parseFloat(metrica.valor_medido)
            ]);
        } else if (metrica.id_metrica == null) {
             return res.status(400).json({ success: false, message: `Falta id_metrica para una de las entradas.` });
        }
    }

    if (values.length === 0) {
        return res.status(400).json({ success: false, message: 'No se proporcionaron valores válidos para registrar.' });
    }

    try {
        const [result] = await db.promise().query(sql, [values]);
        res.status(201).json({
            success: true,
            message: `Productividad registrada exitosamente para ${result.affectedRows} métricas.`,
            insertedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Error al registrar productividad:', error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al guardar los datos.' });
    }
});


module.exports = router;