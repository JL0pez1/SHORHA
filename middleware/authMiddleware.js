// middleware/authMiddleware.js

// Middleware: Verifica si hay un usuario logueado (cualquier rol)
const checkAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        if (req.accepts('json')) {
            return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' }); // [cite: 23]
        } else {
            return res.redirect('/?error=Acceso+requiere+autenticación'); // [cite: 24]
        }
    }
    next(); // Usuario logueado, continuar
}

// Middleware: Verifica si el usuario es 'admin'
const checkAdmin = (req, res, next) => {
    // Primero verifica si está autenticado (reutiliza checkAuthenticated)
    checkAuthenticated(req, res, () => {
        // Si pasa checkAuthenticated, verifica el rol
        if (req.session.user.rol !== 'admin') {
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol de Administrador.' }); // [cite: 13]
            } else {
                return res.status(403).send('Acceso denegado. Requiere rol de Administrador.'); // [cite: 14]
            }
        }
        next(); // Usuario es admin, continuar
    });
};

// Middleware: Verifica si el usuario es 'administrativo' O 'admin'
const checkAdministrativoOrAdmin = (req, res, next) => {
    // Primero verifica si está autenticado
    checkAuthenticated(req, res, () => {
        // Si pasa checkAuthenticated, verifica el rol
        const userRole = req.session.user.rol; // [cite: 18]
        if (userRole !== 'administrativo' && userRole !== 'admin') { // [cite: 18]
            if (req.accepts('json')) {
                return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol Administrativo o Administrador.' }); // [cite: 19]
            } else {
                return res.status(403).send('Acceso denegado. Requiere rol Administrativo o Administrador.'); // [cite: 20]
            }
        }
        next(); // Rol permitido, continuar
    });
};


module.exports = {
    checkAuthenticated,
    checkAdmin,
    checkAdministrativoOrAdmin
};