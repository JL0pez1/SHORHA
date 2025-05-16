// routes/nominaRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { checkAccessRrhhFeatures } = require('../middleware/authMiddleware'); // Middleware de autorización

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
        return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    db.query('CALL sp_generar_pago_periodo(?, ?, ?)',
        [parseInt(id_empleado), fecha_inicio, fecha_fin],
        (error, results) => {
            if (error) {
                console.error("Error al ejecutar SP sp_generar_pago_periodo (individual):", error);
                // Mejorar el mensaje de error si es un error SQL del SP
                if (error.sqlMessage) {
                     // Puedes intentar parsear error.sqlMessage si el SP devuelve mensajes específicos así
                     return res.status(500).json({ success: false, message: `Error en el SP: ${error.sqlMessage}`, errorDetails: error.message });
                }
                return res.status(500).json({ success: false, message: 'Error interno del servidor al procesar el pago individual.', errorDetails: error.message });
            }
            
            // Manejar la respuesta del SP para pago individual
            // La estructura esperada de 'results' para un SELECT de un SP es [ [ { Resultado: '...' } ], ... ]
            if (results && results[0] && Array.isArray(results[0]) && results[0].length > 0 && results[0][0].Resultado !== undefined && results[0][0].Resultado !== null) {
                const spMessage = results[0][0].Resultado;
                console.log("[API/NOMINA/PAGAR Individual] SP Message:", spMessage); // Log para depuración individual

                if (spMessage.toLowerCase().startsWith('error:')) {
                    // Si el SP devuelve un mensaje que empieza con 'Error:', lo consideramos un fallo de validación del SP
                    return res.status(400).json({ success: false, message: spMessage });
                }
                // Si no empieza con 'Error:', asumimos que es el mensaje de éxito del SP
                return res.json({ success: true, message: spMessage });

            } else {
                // Si la estructura de la respuesta del SP no es la esperada
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
    
    // Asegúrate de que la consulta SQL solo selecciona columnas que existen en la tabla nominas
    const sql = `
        SELECT id_nomina, id_empleado, DATE_FORMAT(fecha_inicio, '%Y-%m-%d') as fecha_inicio, 
               DATE_FORMAT(fecha_fin, '%Y-%m-%d') as fecha_fin, tipo_pago, sueldo_base, 
               horas_extra, bonificaciones, descuentos, total_pagado, 
               DATE_FORMAT(fecha_pago, '%Y-%m-%d %H:%i:%s') as fecha_pago
        FROM nominas WHERE id_empleado = ? AND YEAR(fecha_inicio) = ? AND MONTH(fecha_inicio) = ? 
        ORDER BY fecha_inicio ASC, tipo_pago ASC`;
    
    try {
        // Usando db.promise() para async/await
        const [pagos] = await db.promise().query(sql, [parseInt(id_empleado), parseInt(anio), parseInt(mes)]);
        console.log(`[API/NOMINA/HISTORIAL] Pagos encontrados: ${pagos.length}`);
        res.json({ success: true, data: pagos });
    } catch (error) {
        console.error("Error obteniendo historial de pagos:", error);
        res.status(500).json({ success: false, message: 'Error interno del servidor al obtener el historial de pagos.', errorDetails: error.message });
    }
});

// --- RUTA PARA PAGO DE NÓMINA GENERAL ---
// POST /api/nomina/pagar-general
router.post('/pagar-general', checkAccessRrhhFeatures, async (req, res) => {
    const { mes, anio, tipo_pago_general } = req.body;
    console.log(`[API/NOMINA/PAGAR-GENERAL] Solicitud para Mes: ${mes}, Año: ${anio}, Tipo General: ${tipo_pago_general}`);

    if (!mes || isNaN(parseInt(mes)) || parseInt(mes) < 1 || parseInt(mes) > 12) {
        return res.status(400).json({ success: false, message: 'Mes es requerido y debe ser un número entre 1 y 12.' });
    }
    if (!anio || isNaN(parseInt(anio)) || parseInt(anio) < 2000 || parseInt(anio) > 2100) {
        return res.status(400).json({ success: false, message: 'Año es requerido y debe ser un número válido.' });
    }
    if (!tipo_pago_general || !['semanal', 'quincenal', 'mensual'].includes(tipo_pago_general)) {
        return res.status(400).json({ success: false, message: "Tipo de pago general inválido. Debe ser 'semanal', 'quincenal' o 'mensual'." });
    }

    try {
        const [empleados] = await db.promise().query("SELECT id_empleado FROM colaboradores WHERE status = 'Activo'");
        if (!empleados || empleados.length === 0) {
            return res.status(404).json({ success: false, message: 'No se encontraron empleados activos para procesar la nómina.' });
        }

        let resultadosProcesamiento = { successes: [], errors: [] };
        let pagosExitosos = 0;
        let pagosFallidos = 0;

        // Las fechas en JS son 0-indexadas para los meses, UTC para evitar problemas de zona horaria
        const primerDiaDelMes = new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 1));
        const ultimoDiaDelMes = new Date(Date.UTC(parseInt(anio), parseInt(mes), 0)); // Día 0 del siguiente mes es el último del actual

        for (const empleado of empleados) {
            const idEmpleado = empleado.id_empleado;
            let periodos = [];

            if (tipo_pago_general === 'mensual') {
                periodos.push({
                    inicio: primerDiaDelMes.toISOString().split('T')[0],
                    fin: ultimoDiaDelMes.toISOString().split('T')[0]
                });
            } else if (tipo_pago_general === 'quincenal') {
                 // Crear fechas UTC para evitar problemas de zona horaria, especialmente con el día 15
                 const dia15 = new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 15));

                periodos.push({
                    inicio: primerDiaDelMes.toISOString().split('T')[0],
                    fin: dia15.toISOString().split('T')[0]
                });
                periodos.push({
                    inicio: new Date(Date.UTC(parseInt(anio), parseInt(mes) - 1, 16)).toISOString().split('T')[0],
                    fin: ultimoDiaDelMes.toISOString().split('T')[0]
                });
            } else if (tipo_pago_general === 'semanal') {
                // Calcular semanas dentro del mes
                let fechaInicioSemana = new Date(primerDiaDelMes);
                
                // Ajustar al primer día de la semana (Domingo=0, Lunes=1, etc.) si es necesario,
                // dependiendo de cómo el SP o tu lógica maneje el inicio de semana.
                // Si esperas que el SP maneje cualquier rango de 7 días, puedes omitir este ajuste.
                // Si esperas semanas naturales (Dom-Sab), podrías necesitar ajustar fechaInicioSemana
                // al domingo anterior o el mismo domingo si el mes no inicia en domingo.
                // Por simplicidad, aquí asumimos que el SP maneja el rango exacto de 7 días proporcionado.

                while (fechaInicioSemana.getUTCMonth() === primerDiaDelMes.getUTCMonth() && fechaInicioSemana <= ultimoDiaDelMes) {
                    let fechaFinSemana = new Date(fechaInicioSemana);
                    fechaFinSemana.setUTCDate(fechaInicioSemana.getUTCDate() + 6);

                    // Asegurarse de que la fecha fin no se pase del último día del mes
                    if (fechaFinSemana > ultimoDiaDelMes) {
                        fechaFinSemana = new Date(ultimoDiaDelMes);
                    }

                    periodos.push({
                        inicio: fechaInicioSemana.toISOString().split('T')[0],
                        fin: fechaFinSemana.toISOString().split('T')[0]
                    });

                    // Preparar para la siguiente semana
                    // Si la fecha fin de esta semana es igual o mayor que el último día del mes, salimos
                    if (fechaFinSemana.getTime() >= ultimoDiaDelMes.getTime()) {
                         // Si la última semana no termina exactamente en el último día del mes, 
                         // el siguiente periodo empezaría un día después de fechaFinSemana.
                         // Si fechaFinSemana ya es el ultimoDiaDelMes, el siguiente periodo ya no estaría en el mes.
                         if (fechaFinSemana.toISOString().split('T')[0] === ultimoDiaDelMes.toISOString().split('T')[0]) {
                              break; // Ya procesamos hasta el último día del mes
                         } else {
                              // Si la semana termina antes del fin de mes, el siguiente periodo comienza un día después
                              fechaInicioSemana.setUTCDate(fechaFinSemana.getUTCDate() + 1);
                         }
                    } else {
                         // Si la semana termina dentro del mes, la siguiente comienza un día después
                         fechaInicioSemana.setUTCDate(fechaFinSemana.getUTCDate() + 1);
                    }
                     // Pequeña corrección para evitar bucle infinito si la última semana es exactamente 7 días y termina en el último día
                     if (fechaInicioSemana > ultimoDiaDelMes && periodos.length > 0 && periodos[periodos.length - 1].fin !== ultimoDiaDelMes.toISOString().split('T')[0]) {
                         // Si la última semana calculada no llegó al fin del mes, aseguramos que el bucle termine
                         // Esto puede pasar si el último periodo calculado arriba no abarcó hasta el fin del mes exactamente
                         // debido a la lógica de +6 días vs ultimoDiaDelMes.
                         // Sin embargo, la lógica actual de "if (fechaFinSemana > ultimoDiaDelMes) fechaFinSemana = new Date(ultimoDiaDelMes);" ya maneja esto.
                         // Esta verificación adicional es probablemente redundante pero puede servir como red de seguridad.
                         // break; // Considerar si esta ruptura adicional es realmente necesaria
                     }
                }
            }


            for (const periodo of periodos) {
                console.log(`[API/NOMINA/PAGAR-GENERAL] Procesando Empleado ID: ${idEmpleado}, Periodo: ${periodo.inicio} a ${periodo.fin}`);
                try {
                    // Usar un nombre de variable distinto para la respuesta raw del SP
                    const spRawResults = await new Promise((resolve, reject) => {
                        db.query('CALL sp_generar_pago_periodo(?, ?, ?)',
                            [idEmpleado, periodo.inicio, periodo.fin],
                            (error, results) => {
                                if (error) {
                                     // Si hay un error a nivel de base de datos (ej: sintaxis SQL en SP), reject
                                     return reject(error);
                                }
                                // Si no hay error a nivel de BD, resolve con los resultados (que pueden contener un mensaje de error del SP)
                                resolve(results); 
                            }
                        );
                    });

                    // <<< --- LOGUEA LA RESPUESTA EXACTA DEL SP PARA DEBUGGING --- >>>
                    // Esto mostrará la estructura completa que devuelve db.query para cada SP call
                    console.log(`[API/NOMINA/PAGAR-GENERAL] SP Response RAW para Empleado ${idEmpleado} (${periodo.inicio}-${periodo.fin}):`, JSON.stringify(spRawResults));


                    // >>>>>>> --- CORRECCIÓN CLAVE AQUÍ --- <<<<<<<
                    // Verificar que spRawResults tiene la estructura esperada y el campo Resultado
                    // Ahora usamos consistentemente 'spRawResults'
                    if (spRawResults && spRawResults[0] && Array.isArray(spRawResults[0]) && spRawResults[0].length > 0 && spRawResults[0][0].Resultado !== undefined && spRawResults[0][0].Resultado !== null) {
                        const spMessage = spRawResults[0][0].Resultado; // <<< Usamos spRawResults aquí

                        console.log(`[API/NOMINA/PAGAR-GENERAL] SP Message Extracted para Empleado ${idEmpleado} (${periodo.inicio}-${periodo.fin}): "${spMessage}"`); // Log del mensaje extraído

                        // Clasificar basado en el prefijo 'Error:'
                        if (spMessage.toLowerCase().startsWith('error:')) {
                            resultadosProcesamiento.errors.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): ${spMessage}`);
                            pagosFallidos++;
                        } else { // Si no empieza con 'Error:', asumimos que es un mensaje de éxito del SP
                            resultadosProcesamiento.successes.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): ${spMessage}`);
                            pagosExitosos++;
                        }
                    } else {
                         // Este 'else' se ejecuta si la estructura de spRawResults no es la esperada, 
                         // si spRawResults[0] no es un array o está vacío, 
                         // o si spRawResults[0][0].Resultado es undefined o null.
                         console.warn(`[API/NOMINA/PAGAR-GENERAL] SP Unexpected Structure/Missing Result para Empleado ${idEmpleado} (${periodo.inicio}-${periodo.fin}):`, spRawResults);
                        resultadosProcesamiento.errors.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): Respuesta inesperada o incompleta del SP.`);
                        pagosFallidos++;
                    }
                } catch (spError) {
                    // Este catch atrapa errores a nivel de la base de datos, no errores reportados por el SP con SELECT
                    console.error(`[API/NOMINA/PAGAR-GENERAL] Error SQL/Promesa para Empleado ID ${idEmpleado}, Periodo: ${periodo.inicio}-${periodo.fin}:`, spError);
                    resultadosProcesamiento.errors.push(`Empleado ID ${idEmpleado} (${periodo.inicio} a ${periodo.fin}): Error al ejecutar SP - ${spError.message}`);
                    pagosFallidos++;
                }
            }
        }

        let finalMessage = `Proceso de nómina general completado. Pagos exitosos: ${pagosExitosos}. Pagos con error/omitidos: ${pagosFallidos}.`;
        
        // Determinar el estado de la respuesta HTTP
        let responseStatus = 200; // Por defecto, éxito parcial o total
        if (pagosFallidos > 0 && pagosExitosos === 0) {
             responseStatus = 400; // Si todos fallaron
        } else if (pagosFallidos > 0) {
             responseStatus = 207; // Multi-Status - Indica que algunos tuvieron éxito y otros fallaron
        } else {
             responseStatus = 200; // Todos exitosos
        }

        res.status(responseStatus).json({
            // success es true si al menos uno tuvo éxito
            success: pagosExitosos > 0,
            message: finalMessage,
            details: resultadosProcesamiento
        });

    } catch (error) {
        // Este catch atrapa errores al obtener la lista de empleados activos
        console.error("[API/NOMINA/PAGAR-GENERAL] Error obteniendo lista de empleados:", error);
        res.status(500).json({ success: false, message: 'Error interno al iniciar el proceso de nómina general (obtener empleados).', errorDetails: error.message });
    }
});

module.exports = router;