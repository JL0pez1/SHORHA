// controllers/authController.js
const db = require('../config/db'); // Importa la conexión a la BD
const path = require('path');

// Función Auxiliar: Redirigir según rol
function redirectByRole(rol, res) {
    const routes = {
        'reportes': '/reportes',
        'productividad': '/productividad',
        'recursos': '/recursos',
        'administrativo': '/administrativo',
        'colaborador': '/colaborador',
        'admin': '/admin',
        'nominas': '/nominas'
    }; // [cite: 34]
    const targetRoute = routes[rol]; // [cite: 35]
    if (targetRoute) {
        res.redirect(targetRoute); // [cite: 36]
    } else {
        console.warn(`Intento de redirección para rol no definido: ${rol}`); // [cite: 37]
        res.redirect('/?error=Rol+no+configurado+para+redirección'); // [cite: 38]
    }
}

// Manejar GET a la ruta raíz
const handleRootGet = (req, res) => {
    if (req.session.user) {
        return redirectByRole(req.session.user.rol, res); // Redirigir si ya hay sesión [cite: 25]
    }
    // Mostrar login si no hay sesión
    res.sendFile(path.join(__dirname, '..', 'views', 'login.html')); // [cite: 25] Note: Adjusted path
};

// Procesar Login (POST)
const handleLoginPost = (req, res) => {
    const { usuario, pass } = req.body; // [cite: 26]
    if (!usuario || !pass) {
        return res.redirect('/?error=Usuario+y+contraseña+son+requeridos'); // [cite: 26]
    }
    // Buscar usuario activo con contraseña correcta (hasheada con SHA2-256)
    db.query(
        'SELECT id, usuario, rol FROM USUARIOS WHERE usuario = ? AND pass = SHA2(?, 256) AND activo = TRUE', // [cite: 26]
        [usuario, pass], // [cite: 26]
        (err, results) => { // [cite: 26]
            if (err) {
                console.error('Error en la consulta de login:', err); // [cite: 26]
                return res.redirect('/?error=Error+interno+del+servidor'); // [cite: 26]
            }
            if (results.length > 0) { // Usuario encontrado [cite: 27]
                const user = results[0]; // [cite: 27]
                // Regenerar sesión para prevenir fijación de sesión
                req.session.regenerate(err => { // [cite: 27]
                    if (err) {
                        console.error("Error al regenerar sesión:", err); // [cite: 28]
                        return res.redirect('/?error=Error+al+iniciar+sesión'); // [cite: 29]
                    }
                    req.session.user = { id: user.id, usuario: user.usuario, rol: user.rol }; // [cite: 30]
                    req.session.save(err => { // Guardar sesión antes de redirigir [cite: 30]
                        if (err) {
                            console.error("Error al guardar sesión:", err); // [cite: 31]
                            return res.redirect('/?error=Error+al+iniciar+sesión'); // [cite: 31]
                        }
                        redirectByRole(user.rol, res); // Redirigir al dashboard [cite: 32]
                    });
                });
            } else { // Usuario no encontrado o contraseña incorrecta
                res.redirect('/?error=Usuario+o+contraseña+incorrectos'); // [cite: 33]
            }
        }
    );
};

// Manejar Logout (GET)
const handleLogout = (req, res) => {
    req.session.destroy(err => { // [cite: 333]
        if (err) {
            console.error("Error al destruir sesión:", err); // [cite: 334]
            return res.redirect('/?error=Error+al+cerrar+sesión'); // [cite: 334]
        }
        res.clearCookie('connect.sid'); // El nombre por defecto de la cookie de session [cite: 334]
        res.redirect('/?message=Sesión+cerrada+correctamente'); // Redirigir al login [cite: 334]
    });
};

// Obtener datos de la sesión del usuario (para verificar desde el frontend)
const getSessionUser = (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'No hay sesión activa.' });
    }
};

module.exports = {
    redirectByRole, // Exportar por si se necesita en otro lado
    handleRootGet,
    handleLoginPost,
    handleLogout,
    getSessionUser
};