// routes/reportesRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Ajusta la ruta si es necesario
const { checkAuthenticated } = require('../middleware/authMiddleware'); // Asumiendo que tienes este middleware
const puppeteer = require('puppeteer'); // <-- Importa puppeteer

// Función auxiliar para añadir días a una fecha
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0]; // FormatoYYYY-MM-DD
}

// --- RUTA PARA OBTENER REGISTROS DE MÉTRICAS PARA EL REPORTE (EXISTENTE) ---
// GET /api/reportes/metricas
// Permite filtrar por idColaborador y una fecha de inicio (para rango de 30 días)
router.get('/metricas', checkAuthenticated, async (req, res) => {
    const idColaborador = req.query.idColaborador;
    const startDate = req.query.fechaRegistro; // Usamos este como fecha de inicio para el rango

    // Validaciones (ajusta validaciones según los filtros que uses)
    if (idColaborador && (isNaN(idColaborador) || parseInt(idColaborador) <= 0)) {
        return res.status(400).json({ success: false, message: 'ID de colaborador inválido.' });
    }
     if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha de inicio inválido. UseYYYY-MM-DD.' });
     }

    let sql = `
        SELECT
            rm.id_registro,
            rm.id_colaborador,
            c.primer_nombre,
            c.primer_apellido,
            rm.fecha_registro,
            rm.id_metrica,
            m.nombre_metrica,
            m.unidad_medida,
            rm.valor_medido
        FROM registro_metricas_empleado rm
        JOIN colaboradores c ON rm.id_colaborador = c.id_empleado
        JOIN metricas m ON rm.id_metrica = m.id_metrica
    `;
    const whereClauses = [];
    const queryParams = [];

    if (idColaborador) {
        whereClauses.push('rm.id_colaborador = ?');
        queryParams.push(idColaborador);
    }

    // Ajuste para el rango de fechas: Desde la fecha seleccionada + 30 días
    if (startDate) {
        const endDate = addDays(startDate, 30); // Calcula la fecha de fin (30 días después)
        whereClauses.push('DATE(rm.fecha_registro) BETWEEN ? AND ?'); // Filtrar por rango
        queryParams.push(startDate, endDate); // Usar la fecha de inicio y fin calculada
         console.log(`GET /api/reportes/metricas: Filtrando desde ${startDate} hasta ${endDate} (30 días después)`);
    } else {
         console.log('GET /api/reportes/metricas: No se proporcionó fecha de inicio, no se aplica filtro de rango de fecha.');
    }

    // Construir la cláusula WHERE final
    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Añadir ordenamiento por fecha ascendente para la gráfica
    sql += ' ORDER BY rm.fecha_registro ASC, c.primer_apellido ASC, c.primer_nombre ASC, m.nombre_metrica ASC';


    try {
        const [registros] = await db.promise().query(sql, queryParams);

        const formattedRegistros = registros.map(reg => ({
            ...reg,
            fecha_registro: reg.fecha_registro ? new Date(reg.fecha_registro).toISOString().split('T')[0] : null // FormatoYYYY-MM-DD
        }));

        res.json({ success: true, registros: formattedRegistros });

    } catch (error) {
        console.error('Error al obtener registros para el reporte (/metricas):', error);
        res.status(500).json({ success: false, message: 'Error al obtener los datos para el reporte de métricas.' });
    }
});


// --- RUTA PARA EXPORTAR REPORTE A PDF (ACTUALIZADA PARA INCLUIR GRÁFICA) ---
// GET /api/reportes/metricas/export/pdf
// Recibe los mismos filtros que la ruta /metricas
router.get('/metricas/export/pdf', checkAuthenticated, async (req, res) => {
    const idColaborador = req.query.idColaborador;
    const startDate = req.query.fechaRegistro; // Usamos este como fecha de inicio para el rango

    // Validaciones (pueden ser las mismas que la ruta /metricas)
    if (idColaborador && (isNaN(idColaborador) || parseInt(idColaborador) <= 0)) {
        return res.status(400).json({ success: false, message: 'ID de colaborador inválido.' });
    }
     if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return res.status(400).json({ success: false, message: 'Formato de fecha de inicio inválido. UseYYYY-MM-DD.' });
     }
      if (!startDate && idColaborador) {
         // Opcional: Puedes requerir fecha de inicio si hay colaborador, o ajustar la consulta
         // return res.status(400).json({ success: false, message: 'Por favor, ingrese una Fecha de Inicio para exportar si especifica un Colaborador.' });
      }


    let sql = `
        SELECT
            rm.id_registro,
            rm.id_colaborador,
            c.primer_nombre,
            c.primer_apellido,
            rm.fecha_registro,
            rm.id_metrica,
            m.nombre_metrica,
            m.unidad_medida,
            rm.valor_medido
        FROM registro_metricas_empleado rm
        JOIN colaboradores c ON rm.id_colaborador = c.id_empleado
        JOIN metricas m ON rm.id_metrica = m.id_metrica
    `;
    const whereClauses = [];
    const queryParams = [];

    if (idColaborador) {
        whereClauses.push('rm.id_colaborador = ?');
        queryParams.push(idColaborador);
    }

    // Ajuste para el rango de fechas: Desde la fecha seleccionada + 30 días
    if (startDate) {
        const endDate = addDays(startDate, 30); // Calcula la fecha de fin (30 días después)
        whereClauses.push('DATE(rm.fecha_registro) BETWEEN ? AND ?'); // Filtrar por rango
        queryParams.push(startDate, endDate); // Usar la fecha de inicio y fin calculada
         console.log(`GET /api/reportes/metricas/export/pdf: Filtrando desde ${startDate} hasta ${endDate} (30 días después)`);
    } else {
         console.log('GET /api/reportes/metricas/export/pdf: No se proporcionó fecha de inicio, no se aplica filtro de rango de fecha.');
    }


    if (whereClauses.length > 0) {
        sql += ' WHERE ' + whereClauses.join(' AND ');
    } else {
         // Si no hay filtros, limita el número de registros en el PDF para evitar documentos gigantes
         sql += ' LIMIT 500'; // Limita a 500 registros si no hay filtros
    }

    sql += ' ORDER BY rm.fecha_registro ASC, c.primer_apellido ASC, c.primer_nombre ASC, m.nombre_metrica ASC';


    let browser;

    try {
        // 1. Obtener los datos de la base de datos
        const [registros] = await db.promise().query(sql, queryParams);

        const formattedRegistros = registros.map(reg => ({
            ...reg,
            fecha_registro: reg.fecha_registro ? new Date(reg.fecha_registro).toISOString().split('T')[0] : null // FormatoYYYY-MM-DD
        }));

        // 2. Preparar datos y generar el contenido HTML con la gráfica incluida
        // Los datos de los registros se pasarán como una variable JavaScript en el HTML
        const registrosJson = JSON.stringify(formattedRegistros); // Convertir a JSON string

        let htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Métricas</title>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script> <style>
                    body { font-family: sans-serif; margin: 20px; }
                    h1 { color: #2c3e50; text-align: center; }
                    h2 { color: #2577ae; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; font-size: 12px; } /* Ajustar padding/font-size para PDF */
                    th { background-color: #2577ae; color: white; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                     /* Estilo para el mensaje de "No hay registros" en la tabla */
                     table tbody tr td[colspan="6"] { text-align: center; font-style: italic; color: #777; padding: 10px; }
                    .filters { margin-bottom: 20px; padding: 10px; background-color: #f0f0f0; border-radius: 5px; }
                    .filters p { margin: 5px 0; }
                    .chart-container-pdf { /* Contenedor para la gráfica en el PDF */
                        margin-top: 30px;
                        padding: 15px;
                        border: 1px solid #ccc;
                        border-radius: 5px;
                        background-color: #fff;
                        width: 100%; /* Ocupa todo el ancho disponible */
                        height: 400px; /* Altura fija para la gráfica en el PDF. AJUSTA ESTO */
                         /* Asegúrate de que Chart.js pueda renderizar correctamente en este espacio */
                    }
                     canvas { /* Asegura que el canvas dentro del contenedor ocupe el espacio */
                         display: block; /* Elimina espacio extra debajo del canvas */
                         width: 100% !important; /* Importante para que Chart.js respete el ancho del contenedor */
                         height: 100% !important; /* Importante para que Chart.js respete la altura del contenedor */
                     }

                </style>
            </head>
            <body>
                <h1>Reporte de Métricas de Empleado</h1>
                <div class="filters">
                    <p><strong>Filtros:</strong></p>
                    ${idColaborador ? `<p>ID Colaborador: ${idColaborador}</p>` : ''}
                    ${startDate ? `<p>Fecha de Inicio: ${startDate} (Rango de 30 días)</p>` : ''}
                </div>
        `;

        if (formattedRegistros && formattedRegistros.length > 0) {
            htmlContent += `
                <h2>Resultados del Reporte</h2>
                <table>
                    <thead>
                        <tr>
                            <th>ID Colab.</th>
                            <th>Nombre Colab.</th>
                            <th>Fecha</th>
                            <th>Métrica</th>
                            <th>Valor</th>
                            <th>Unidad</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            formattedRegistros.forEach(reg => {
                htmlContent += `
                    <tr>
                        <td>${reg.id_colaborador}</td>
                        <td>${reg.primer_nombre || ''} ${reg.primer_apellido || ''}</td>
                        <td>${reg.fecha_registro ? new Date(reg.fecha_registro).toLocaleDateString() : ''}</td>
                        <td>${reg.nombre_metrica || 'N/A'}</td>
                        <td>${reg.valor_medido}</td>
                        <td>${reg.unidad_medida || ''}</td>
                    </tr>
                `;
            });
            htmlContent += `
                    </tbody>
                </table>

                <div class="chart-container-pdf">
                     <canvas id="metricChartPDF"></canvas> </div>

                <script>
                    // Datos del reporte inyectados como variable JS
                    const reportData = ${registrosJson};

                    // Función para dibujar la gráfica en el PDF HTML
                    function drawMetricsChartPDF() {
                         console.log("Drawing chart in PDF HTML..."); // LOG para depuración en Puppeteer
                         if (!reportData || reportData.length === 0) {
                             console.log("No data to draw chart in PDF."); // LOG
                             return;
                         }
                         console.log("Report data available:", reportData); // LOG

                        const dates = [...new Set(reportData.map(reg => reg.fecha_registro))].sort();
                         console.log("Dates:", dates); // LOG
                        const metricsMap = new Map();
                        reportData.forEach(reg => {
                             if (!metricsMap.has(reg.id_metrica)) {
                                 metricsMap.set(reg.id_metrica, { id: reg.id_metrica, nombre: reg.nombre_metrica, unidad: reg.unidad_medida });
                             }
                        });
                        const metrics = Array.from(metricsMap.values());
                         console.log("Metrics:", metrics); // LOG

                        const datasets = metrics.map(metric => {
                             console.log("Processing metric for dataset:", metric); // LOG
                            const metricData = dates.map(date => {
                                 console.log(\`  Finding data for date \${date} and metric \${metric.id}\`); // LOG
                                const registro = reportData.find(reg => reg.fecha_registro === date && reg.id_metrica === metric.id);
                                 console.log("  Found record:", registro); // LOG
                                return registro ? registro.valor_medido : null;
                            });

                            const randomColor = \`rgba(\${Math.floor(Math.random() * 200)}, \${Math.floor(Math.random() * 200)}, \${Math.floor(Math.random() * 200)}, 0.8)\`;

                            return {
                                // Usamos concatenación simple para evitar posibles problemas con template literals anidados
                                label: metric.nombre + (metric.unidad ? ' (' + metric.unidad + ')' : ''),
                                data: metricData,
                                borderColor: randomColor,
                                backgroundColor: randomColor.replace('0.8', '0.3'),
                                tension: 0.1,
                                fill: false
                            };
                        });
                         console.log("Generated datasets:", datasets); // LOG


                        const ctx = document.getElementById('metricChartPDF').getContext('2d');
                         console.log("Canvas context obtained:", ctx); // LOG

                         if (!ctx) {
                             console.error("Could not get 2D context for canvas 'metricChartPDF'."); // LOG
                             return;
                         }

                        // Crear la instancia de la gráfica para el PDF
                        new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: dates,
                                datasets: datasets
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false, // Permitir control de tamaño por CSS
                                scales: {
                                    x: {
                                        title: { display: true, text: 'Fecha de Registro' },
                                        type: 'category'
                                    },
                                    y: {
                                         title: { display: true, text: 'Valor Medido' },
                                         beginAtZero: true
                                    }
                                },
                                plugins: {
                                    legend: { display: datasets.length > 0, position: 'top' },
                                    title: { display: true, text: 'Valores de Métricas por Fecha (Rango de 30 días)' },
                                     tooltip: { enabled: false } // Deshabilitar tooltips en PDF
                                },
                                hover: { mode: null } // Deshabilitar hover effects en PDF
                            }
                        });
                         console.log("Chart instance created."); // LOG
                    }

                    // Dibuja la gráfica una vez que el DOM esté completamente cargado en Puppeteer
                    // Usamos DOMContentLoaded
                    document.addEventListener('DOMContentLoaded', drawMetricsChartPDF);

                    // Opcional: También puedes llamar a la función directamente o con un pequeño timeout
                    // setTimeout(drawMetricsChartPDF, 100); // Ejemplo de retardo
                    // drawMetricsChartPDF(); // Ejemplo de llamada directa (podría fallar si DOM no está listo)


                </script>
            `;

        } else {
            htmlContent += '<p>No se encontraron registros de métricas con los filtros seleccionados.</p>';
        }

        htmlContent += `
            </body>
            </html>
        `;

        // 3. Usar Puppeteer para generar el PDF
        browser = await puppeteer.launch({
             args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Establecer el contenido HTML en la página de Puppeteer
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0' // Espera a que la red esté inactiva (incluyendo la carga de Chart.js)
        });

       
        // Usamos page.evaluate + setTimeout como alternativa a waitForTimeout
        await page.evaluate(() => {
            return new Promise(resolve => {
                setTimeout(resolve, 1000); // Espera 1000 milisegundos (1 segundo)
            });
        });

        // Generar el PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        // 4. Enviar el PDF como respuesta
        const filename = `reporte_metricas_${idColaborador || 'todos'}_${startDate ? startDate.replace(/-/g, '_') : 'sinfecha'}.pdf`; // Nombre de archivo más amigable
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); // 'attachment' fuerza descarga
        res.setHeader('Content-Type', 'application/pdf');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error al generar PDF del reporte (/metricas/export/pdf):', error);
        // Puedes añadir más detalles del error en la respuesta si no estás en producción
        res.status(500).json({ success: false, message: 'Error al generar el archivo PDF.', errorDetails: process.env.NODE_ENV !== 'production' ? error.message : undefined });
    } finally {
        // Asegurarse de cerrar el navegador de Puppeteer
        if (browser) {
            await browser.close();
        }
    }
});


// Exporta el router para que pueda ser usado en server.js
module.exports = router;