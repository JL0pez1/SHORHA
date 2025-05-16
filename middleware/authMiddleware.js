// middleware/authMiddleware.js

// Middleware: Verifica si hay un usuario logueado (cualquier rol)
const checkAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        if (req.accepts('json')) {
            // Si la petición espera JSON (es una API call), devuelve error JSON
            return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' });
        } else {
            // Si es una petición normal del navegador, redirige al login
            return res.redirect('/?error=Acceso+requiere+autenticación');
        }
    }
    next(); // Usuario logueado, continuar
};

// Middleware: Verifica si el usuario es 'admin'
const checkAdmin = (req, res, next) => {
    checkAuthenticated(req, res, () => { // Primero verifica si está autenticado
        if (req.session.user.rol !== 'admin') {
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol de Administrador.' });
            } else {
                return res.status(403).send('Acceso denegado. Requiere rol de Administrador.');
            }
        }
        next(); // Usuario es admin, continuar
    });
};

// Middleware: Verifica si el usuario es 'administrativo' O 'admin'
// Este podría seguir usándose para funciones que SÓLO ellos deben hacer.
const checkAdministrativoOrAdmin = (req, res, next) => {
    checkAuthenticated(req, res, () => {
        const userRole = req.session.user.rol;
        if (userRole !== 'administrativo' && userRole !== 'admin') {
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol Administrativo o Administrador.' });
            } else {
                return res.status(403).send('Acceso denegado. Requiere rol Administrativo o Administrador.');
            }
        }
        next(); // Rol permitido, continuar
    });
};

// NUEVO Middleware: Verifica roles para funcionalidades de Recursos Humanos/Nóminas
// Esto permitirá a 'admin', 'administrativo', 'recursos', y 'nominas' acceder.
const checkAccessRrhhFeatures = (req, res, next) => {
    checkAuthenticated(req, res, () => { // Primero autenticado
        const userRole = req.session.user.rol;
        const allowedRoles = ['admin', 'administrativo', 'recursos', 'nominas']; // Roles permitidos

        if (!allowedRoles.includes(userRole)) {
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: `Acceso no autorizado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.` });
            } else {
                // Para peticiones no-API, podrías redirigir o mostrar una página de error HTML más amigable
                return res.status(403).send(`Acceso denegado. Tu rol ('${userRole}') no tiene los permisos necesarios.`);
            }
        }
        next(); // Rol permitido, continuar
    });
};

module.exports = {
    checkAuthenticated,
    checkAdmin,
    checkAdministrativoOrAdmin, // Lo dejamos por si se usa en otras partes de tu app
    checkAccessRrhhFeatures     // Exportamos el nuevo middleware
};