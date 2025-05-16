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
const checkAdministrativoOrAdmin = (req, res, next) => {
    checkAuthenticated(req, res, () => {
        const userRole = req.session.user.rol;
        if (userRole !== 'administrativo' && userRole !== 'admin' && userRole !== 'recursos') {
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol Administrativo o Administrador.' });
            } else {
                return res.status(403).send('Acceso denegado. Requiere rol Administrativo o Administrador.');
            }
        }
        next(); // Rol permitido, continuar
    });
};

// Middleware: Verifica roles para funcionalidades de RRHH, Nóminas Y PRODUCTIVIDAD
// (para horas extra y ver info de colaborador si es necesario desde productividad.html)
const checkAccessRrhhFeatures = (req, res, next) => {
    checkAuthenticated(req, res, () => { 
        const userRole = req.session.user.rol;
        // Asegúrate de que 'productividad' esté en esta lista
        const allowedRoles = ['admin', 'administrativo', 'recursos', 'nominas', 'productividad']; 

        if (!allowedRoles.includes(userRole)) {
            // Este es el mensaje que probablemente estabas viendo
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: `Acceso no autorizado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}.` });
            } else {
                return res.status(403).send(`Acceso denegado. Tu rol ('${userRole}') no tiene los permisos necesarios para esta acción.`);
            }
        }
        next(); // Rol permitido, continuar
    });
};

module.exports = {
    checkAuthenticated,
    checkAdmin,
    checkAdministrativoOrAdmin,
    checkAccessRrhhFeatures 
};