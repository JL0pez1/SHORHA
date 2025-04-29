// controllers/viewController.js
const path = require('path');

const protectedHtmlRoutesConfig = {
    '/reportes': { roles: ['admin', 'reportes'], file: 'reportes' },
    '/productividad': { roles: ['admin', 'productividad'], file: 'productividad' },
    '/recursos': { roles: ['admin', 'recursos'], file: 'recursos' },
    '/administrativo': { roles: ['admin', 'administrativo'], file: 'administrativo' },
    '/colaborador': { roles: ['admin', 'colaborador'], file: 'colaborador' }, // Admin también puede ver perfil de colaborador (ajustar si no)
    '/admin': { roles: ['admin'], file: 'admin' },
    '/nominas': { roles: ['admin', 'nominas'], file: 'nominas' } // Ajusta roles si es necesario
};

// Middleware/Controller para servir archivos HTML protegidos
const serveProtectedHtml = (req, res) => {
    const requestedRoute = req.path; // Obtiene la ruta solicitada (ej: '/admin')
    const userRole = req.session.user.rol;

    const routeConfig = protectedHtmlRoutesConfig[requestedRoute];

    if (!routeConfig) {
        // Esto no debería ocurrir si las rutas están bien definidas, pero como fallback
        console.warn(`Configuración no encontrada para la ruta protegida: ${requestedRoute}`);
        return res.status(404).send('Página no encontrada.');
    }

    // Verificar si el rol del usuario está permitido para esta ruta
    if (!routeConfig.roles.includes(userRole)) {
        console.log(`Acceso denegado a ${requestedRoute} para rol ${userRole}. Roles permitidos: ${routeConfig.roles.join(', ')}`); // [cite: 46]
        // Respuesta HTML de acceso denegado
        return res.status(403).send(`
            <!DOCTYPE html><html><head><title>Acceso Denegado</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} a{color: #007bff; text-decoration: none;} a:hover{text-decoration: underline;}</style></head>
            <body><h1><i class="fas fa-ban"></i> Acceso Denegado</h1><p>Tu rol (${userRole}) no tiene permiso para acceder a esta sección (${requestedRoute}).</p><p><a href="/">Volver al inicio</a></p></body></html>
        `); // [cite: 47] (HTML mejorado)
    }

    // Si tiene acceso, servir el archivo HTML
    const htmlFileName = `${routeConfig.file}.html`; // [cite: 48]
    const filePath = path.join(__dirname, '..', 'views', htmlFileName); // [cite: 48] Ajusta el path

    res.sendFile(filePath, (err) => { // [cite: 48]
        if (err) {
            console.error(`Error sirviendo archivo ${htmlFileName}:`, err); // [cite: 49]
            if (err.code === 'ENOENT') { // [cite: 49]
                res.status(404).send(`Archivo ${htmlFileName} no encontrado.`); // [cite: 50]
            } else {
                res.status(500).send(`Error interno al cargar la página ${htmlFileName}.`); // [cite: 50]
            }
        }
    });
};

module.exports = {
    serveProtectedHtml,
    protectedHtmlRoutesConfig // Exportar la config por si se necesita
};