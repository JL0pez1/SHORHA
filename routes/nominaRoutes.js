// routes/nominaRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { checkAccessRrhhFeatures } = require('../middleware/authMiddleware'); // Middleware de autorización

// NOTA: La ruta GET /api/empleados/:id DEBE estar en collaboratorRoutes.js

// POST /api/nomina/pagar (Pago individual)
router.post('/pagar', checkAccessRrhhFeatures, (req, res) => {
    const { id_empleado, fecha_inicio, fecha_fin } = req.body;

    if (!id_empleado || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ success: false, message: 'ID de empleado, fecha de inicio y fecha de fin son requeridos.' });
    }
    if (isNaN(parseInt(id_empleado))) {
        return res.status(400).json({ success: false, message: 'ID de empleado debe ser un número.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Use AAAA-MM-DD.' });
    }

    db.query('CALL sp_generar_pago_periodo(?, ?, ?)',
        [parseInt(id_empleado), fecha_inicio, fecha_fin],
        (error, results) => {
            if (error) {
                console.error("Error al ejecutar SP sp_generar_pago_periodo (individual):", error);
                if (error.sqlMessage) {
                     return res.status(500).json({ success: false, message: `Error en el SP: ${error.sqlMessage}`, errorDetails: error.message });
                }
                return res.status(500).json({ success: false, message: 'Error interno del servidor al procesar el pago individual.', errorDetails: error.message });
            }

            if (results && results[0] && Array.isArray(results[0]) && results[0].length > 0 && results[0][0].Resultado !== undefined && results[0][0].Resultado !== null) {
                const spMessage = results[0][0].Resultado;
                console.log("[API/NOMINA/PAGAR Individual] SP Message:", spMessage);

                if (spMessage.toLowerCase().startsWith('error:')) {
                    return res.status(400).json({ success: false, message: spMessage });
                }
                return res.json({ success: true, message: spMessage });

            } else {
                console.warn("[API/NOMINA/PAGAR Individual] Respuesta inesperada del SP:", results);
                return res.status(500).json({ success: false, message: 'Respuesta inesperada del proceso de pago individual.' });
            }
        }
    );
});

// GET /api/nomina/historial/:id_empleado?mes=M&anio=AAAA
router.get('/historial/:id_empleado', checkAccessRrhhFeatures, async (req, res) => {
    const { id_empleado } = req.params;
    const { mes, anio } = req.query;
    console.log(`[API/NOMINA/HISTORIAL] Solicitud para empleado: ${id_empleado}, Mes: ${mes}, Año: ${anio}`);
    if (!id_empleado || isNaN(parseInt(id_empleado))) { return res.status(400).json({ success: false, message: 'ID de empleado es requerido y debe ser un número.' }); }
    if (!mes || isNaN(parseInt(mes)) || parseInt(mes) < 1 || parseInt(mes) > 12) { return res.status(400).json({ success: false, message: 'Mes es requerido y debe ser un número entre 1 y 12.' }); }
    if (!anio || isNaN(parseInt(anio)) || parseInt(anio) < 2000 || parseInt(anio) > 2100) { return res.status(400).json({ success: false, message: 'Año es requerido y debe ser un número válido.' }); }

    const sql = `
        SELECT id_nomina, id_empleado, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') as fecha_inicio,
               DATE_FORMAT(fecha_fin, '%Y-%m-%d') as fecha_fin, tipo_pago, sueldo_base,
               horas_extra, bonificaciones, descuentos, total_pagado,
               DATE_FORMAT(fecha_pago, '%Y-%m-%d %H:%i:%s') as fecha_pago
        FROM nominas WHERE id_empleado = ? AND YEAR(fecha_inicio) = ? AND MONTH(fecha_inicio) = ?
        ORDER BY fecha_inicio ASC, tipo_pago ASC`;

    try {
        const [pagos] = await db.promise().query(sql, [parseInt(id_empleado), parseInt(anio), parseInt(mes)]);
        console.log(`[API/NOMINA/HISTORIAL] Pagos encontrados: ${pagos.length}`);
        res.json({ success: true, data: pagos });
    } catch (error) {
        console.error("Error obteniendo historial de pagos:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al obtener el historial de pagos.', errorDetails: error.message });
    }
});

// --- RUTA PARA PAGO DE NÓMINA GENERAL ---
// POST /api/nomina/pagar-general  <-- ¡Esta es la ruta que debe coincidir!
router.post('/pagar-general', checkAccessRrhhFeatures, async (req, res) => { // <-- El path es '/pagar-general'
    const { mes, anio, tipo_pago_general, quincena } = req.body;
    console.log(`[API/NOMINA/PAGAR-GENERAL] Solicitud para Mes: ${mes}, Año: ${anio}, Tipo General: ${tipo_pago_general}, Quincena: ${quincena}`);

    if (!mes || isNaN(parseInt(mes)) || parseInt(mes) < 1 || parseInt(mes) > 12) {
        return res.status(400).json({ success: false, message: 'Mes es requerido y debe ser un número entre 1 y 12.' });
    }
    if (!anio || isNaN(parseInt(anio)) || parseInt(anio) < 2000 || parseInt(anio) > 2100) {
        return res.status(400).json({ success: false, message: 'Año es requerido y debe ser un número válido.' });
    }
    if (!tipo_pago_general || !['semanal', 'quincenal', 'mensual'].includes(tipo_pago_general)) {
        return res.status(400).json({ success: false, message: "Tipo de pago general inválido. Debe ser 'semanal', 'quincenal' o 'mensual'." });
    }
    if (tipo_pago_general === 'quincenal' && (!quincena || !['primera', 'segunda'].includes(quincena))) {
         return res.status(400).json({ success: false, message: "Para pago quincenal, debe especificar 'primera' o 'segunda' quincena." });
    }


    try {
        const [empleados] = await db.promise().query("SELECT id_empleado FROM colaboradores WHERE status = 'Activo'");
        if (!empleados || empleados.length === 0) {
            return res.status(404).json({ success: false, message: 'No se encontraron empleados activos para procesar la nómina.' });
        }

        let resultadosProcesamiento = { successes: [], errors: [] };
        let pagosExitosos = 0;
        let pagosFallidos = 0;

        const primerDiaDelMes = new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 1));
        const ultimoDiaDelMes = new Date(Date.UTC(parseInt(anio), parseInt(mes), 0));


        let periodosAGenerar = [];

        if (tipo_pago_general === 'mensual') {
            periodosAGenerar.push({
                inicio: primerDiaDelMes.toISOString().split('T')[0],
                fin: ultimoDiaDelMes.toISOString().split('T')[0]
            });
        } else if (tipo_pago_general === 'quincenal') {
             if (quincena === 'primera') {
                  const dia15 = new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 15));
                  periodosAGenerar.push({
                       inicio: primerDiaDelMes.toISOString().split('T')[0],
                       fin: dia15.toISOString().split('T')[0]
                  });
             } else if (quincena === 'segunda') {
                  periodosAGenerar.push({
                       inicio: new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 16)).toISOString().split('T')[0],
                       fin: ultimoDiaDelMes.toISOString().split('T')[0]
                  });
             }
        } else if (tipo_pago_general === 'semanal') {
            let fechaInicioSemana = new Date(primerDiaDelMes);

            while (fechaInicioSemana.getUTCFullYear() === parseInt(anio) && fechaInicioSemana.getUTCMonth() === primerDiaDelMes.getUTCMonth() && fechaInicioSemana <= ultimoDiaDelMes) {
                 let fechaFinSemana = new Date(fechaInicioSemana);
                 fechaFinSemana.setUTCDate(fechaInicioSemana.getUTCDate() + 6);

                 if (fechaFinSemana > ultimoDiaDelMes) {
                      fechaFinSemana = new Date(ultimoDiaDelMes);
                 }

                 if (fechaInicioSemana <= fechaFinSemana) {
                      periodosAGenerar.push({
                           inicio: fechaInicioSemana.toISOString().split('T')[0],
                           fin: fechaFinSemana.toISOString().split('T')[0]
                      });
                 }

                 const nextDayAfterWeek = new Date(fechaFinSemana);
                 nextDayAfterWeek.setUTCDate(fechaFinSemana.getUTCDate() + 1);

                 if (nextDayAfterWeek.getUTCMonth() !== primerDiaDelMes.getUTCMonth() || nextDayAfterWeek > ultimoDiaDelMes) {
                     break;
                 }
                 fechaInicioSemana = nextDayAfterWeek;
            }
        }

        for (const empleado of empleados) {
            const idEmpleado = empleado.id_empleado;

            for (const periodo of periodosAGenerar) {
                console.log(`[API/NOMINA/PAGAR-GENERAL] Procesando Empleado ID: ${idEmpleado}, Periodo: ${periodo.inicio} a ${periodo.fin}`);
                try {
                    const spRawResults = await new Promise((resolve, reject) => {
                        db.query('CALL sp_generar_pago_periodo(?, ?, ?)',
                            [idEmpleado, periodo.inicio, periodo.fin],
                            (error, results) => {
                                if (error) {
                                     return reject(error);
                                }
                                resolve(results);
                            }
                        );
                    });

                    if (spRawResults && spRawResults[0] && Array.isArray(spRawResults[0]) && spRawResults[0].length > 0 && spRawResults[0][0].Resultado !== undefined && spRawResults[0][0].Resultado !== null) {
                        const spMessage = spRawResults[0][0].Resultado;
                        console.log(`[API/NOMINA/PAGAR-GENERAL] SP Message Extracted para Empleado ${idEmpleado} (${periodo.inicio}-${periodo.fin}): "${spMessage}"`);

                        if (spMessage.toLowerCase().startsWith('error:')) {
                            resultadosProcesamiento.errors.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): ${spMessage}`);
                            pagosFallidos++;
                        } else {
                            resultadosProcesamiento.successes.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): ${spMessage}`);
                            pagosExitosos++;
                        }
                    } else {
                         console.warn(`[API/NOMINA/PAGAR-GENERAL] SP Unexpected Structure/Missing Result para Empleado ${idEmpleado} (${periodo.inicio}-${periodo.fin}):`, spRawResults);
                         resultadosProcesamiento.errors.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): Respuesta inesperada o incompleta del SP.`);
                         pagosFallidos++;
                    }

                } catch (spError) {
                    console.error(`[API/NOMINA/PAGAR-GENERAL] Error SQL/Promesa para Empleado ID ${idEmpleado}, Periodo: ${periodo.inicio}-${periodo.fin}:`, spError);
                    let errorMessage = spError.message || 'Error desconocido al ejecutar SP.';
                     if (spError.sqlMessage) {
                        errorMessage = `Error SQL: ${spError.sqlMessage}`;
                    }
                    resultadosProcesamiento.errors.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): ${errorMessage}`);
                    pagosFallidos++;
                }
            }
        }

        let finalMessage = `Proceso de nómina general completado. Pagos exitosos: ${pagosExitosos}. Pagos con error/omitidos: ${pagosFallidos}.`;
        let responseStatus = 200;
        if (pagosFallidos > 0 && pagosExitosos === 0) {
             responseStatus = 400;
             finalMessage = result.message || 'Proceso de nómina general fallido para todos los empleados.';
        } else if (pagosFallidos > 0) {
             responseStatus = 207;
        } else {
             responseStatus = 200;
        }

        res.status(responseStatus).json({
            success: pagosExitosos > 0,
            message: finalMessage,
            details: resultadosProcesamiento
        });

    } catch (error) {
        console.error("[API/NOMINA/PAGAR-GENERAL] Error obteniendo lista de empleados o error inicial:", error);
        res.status(500).json({ success: false, message: 'Error interno al iniciar el proceso de nómina general.', errorDetails: error.message });
    }
});

module.exports = router;