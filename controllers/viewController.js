// controllers/viewController.js
const path = require('path');

// Configuración de rutas protegidas y qué archivo HTML sirven.
// El valor de 'file' es el nombre del archivo HTML sin la extensión '.html',
// y se espera que esté en la carpeta /views.
const protectedHtmlRoutesConfig = {
    '/reportes': { roles: ['admin', 'reportes'], file: 'reportes' },
    '/productividad': { roles: ['admin', 'productividad'], file: 'productividad' },
    // Si tu archivo HTML para nóminas y horas extra se llama 'recursos.html'
    // y quieres acceder a él mediante la URL '/recursos':
    '/recursos': { roles: ['admin', 'recursos', 'nominas'], file: 'recursos' },
    '/administrativo': { roles: ['admin', 'administrativo'], file: 'administrativo' },
    '/colaborador': { roles: ['admin', 'colaborador'], file: 'colaborador' },
    '/admin': { roles: ['admin'], file: 'admin' },
    '/nominas': { roles: ['admin', 'nominas'], file: 'nominas' } // Puedes mantener esta o eliminarla si /recursos la cubre.
                                                                 // Si la mantienes, debe existir un 'nominas.html'.
};

// Middleware/Controller para servir archivos HTML protegidos
const serveProtectedHtml = (req, res) => {
    const requestedRoute = req.path; // Ej: '/recursos'
    const user = req.session.user;

    // Si no hay usuario en la sesión, este middleware no debería ser alcanzado
    // ya que checkAuthenticated en viewRoutes.js debería haber redirigido.
    // Pero como doble chequeo:
    if (!user || !user.rol) {
        console.warn('Intento de acceso a ruta protegida sin sesión o rol válido.');
        return res.redirect('/?error=Sesion+invalida');
    }
    const userRole = user.rol;
    const routeConfig = protectedHtmlRoutesConfig[requestedRoute];

    if (!routeConfig) {
        console.warn(`Configuración no encontrada para la ruta protegida: ${requestedRoute}`);
        // Esto normalmente sería manejado por el 404 de server.js si la ruta no está en viewRoutes.js
        return res.status(404).send('Página de configuración no encontrada.');
    }

    if (!routeConfig.roles.includes(userRole)) {
        console.log(`Acceso denegado a ${requestedRoute} para rol ${userRole}. Roles permitidos: ${routeConfig.roles.join(', ')}`);
        return res.status(403).send(`
            <!DOCTYPE html><html><head><title>Acceso Denegado</title><style>body{font-family: sans-serif; padding: 20px; text-align: center;} h1{color: #dc3545;} a{color: #007bff; text-decoration: none;} a:hover{text-decoration: underline;}</style></head>
            <body><h1><i class="fas fa-ban"></i> Acceso Denegado</h1><p>Tu rol ('${userRole}') no tiene permiso para acceder a esta sección ('${requestedRoute}').</p><p><a href="/">Volver al inicio</a></p></body></html>
        `);
    }

    const htmlFileName = `${routeConfig.file}.html`;
    const filePath = path.join(__dirname, '..', 'views', htmlFileName);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Error sirviendo archivo HTML '${htmlFileName}' para la ruta '${requestedRoute}':`, err);
            if (err.code === 'ENOENT') {
                res.status(404).send(`El archivo '${htmlFileName}' no fue encontrado en el servidor. Verifique la configuración de rutas y la carpeta 'views'.`);
            } else {
                res.status(500).send(`Error interno al intentar cargar la página '${htmlFileName}'.`);
            }
        }
    });
};

module.exports = {
    serveProtectedHtml,
    protectedHtmlRoutesConfig // Exportar la config por si se necesita en otro lado
};