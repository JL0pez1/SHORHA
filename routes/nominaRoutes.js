// routes/nominaRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ajusta la ruta a tu archivo de conexión a BD
const { checkAccessRrhhFeatures } = require('../middleware/authMiddleware'); // Middleware de autorización

// POST /api/nomina/pagar
// Protegido para que solo roles de RRHH/Nóminas/Admin puedan procesar pagos.
router.post('/pagar', checkAccessRrhhFeatures, (req, res) => {
    const { id_empleado, fecha_inicio, fecha_fin } = req.body;

    if (!id_empleado || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ success: false, message: 'ID de empleado, fecha de inicio y fecha de fin son requeridos para procesar el pago.' });
    }
    if (isNaN(parseInt(id_empleado))) {
        return res.status(400).json({ success: false, message: 'ID de empleado debe ser un número.' });
    }
    // Validar formato de fechas YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha inválido. Use YYYY-MM-DD.' });
    }

    // Usamos db.query con callback para Stored Procedures, ya que el manejo de múltiples resultsets
    // o mensajes de error/éxito del SP puede ser más directo así.
    db.query('CALL sp_generar_pago_periodo(?, ?, ?)',
        [parseInt(id_empleado), fecha_inicio, fecha_fin],
        (error, results) => {
            if (error) {
                console.error("Error al ejecutar SP sp_generar_pago_periodo:", error);
                return res.status(500).json({ success: false, message: 'Error interno del servidor al procesar el pago.', errorDetails: error.message });
            }

            // El SP sp_generar_pago_periodo devuelve un único resultset con una columna "Resultado".
            // `results` para CALL suele ser un array donde el primer elemento [0] es el resultset (que también es un array).
            if (results && results[0] && Array.isArray(results[0]) && results[0].length > 0 && results[0][0].Resultado) {
                const spMessage = results[0][0].Resultado;
                // Convertimos el inicio del mensaje a minúsculas para una comparación más robusta
                if (spMessage.toLowerCase().startsWith('error:')) {
                    // Si el SP indica un error de lógica de negocio (ej. pago duplicado, rango inválido)
                    return res.status(400).json({ success: false, message: spMessage });
                }
                // Si el SP tiene éxito
                return res.json({ 
                    success: true, 
                    message: spMessage, 
                    // Podrías incluir más datos del results[0][0] si el SP los devuelve y son útiles
                    // data: results[0][0] 
                });
            } else {
                // Esto podría ocurrir si el SP no se ejecuta como se espera o no devuelve el resultset esperado.
                console.warn("Respuesta inesperada o vacía del SP sp_generar_pago_periodo:", results);
                return res.status(500).json({ success: false, message: 'Respuesta inesperada del proceso de pago. Contacte al administrador.' });
            }
        }
    );
});

module.exports = router;