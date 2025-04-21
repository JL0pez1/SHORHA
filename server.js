require('dotenv').config(); // Carga variables de entorno desde .env
const express = require('express');
const mysql = require('mysql2'); // Driver de MySQL
const bodyParser = require('body-parser'); // Middleware para parsear bodies de requests
const path = require('path'); // Utilidad para manejar rutas de archivos
const session = require('express-session'); // Middleware para manejar sesiones

const app = express();
const PORT = process.env.PORT || 3000; // Puerto del servidor

// --- Configuración de Base de Datos ---
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Umg123', // ¡Usa variables de entorno para seguridad!
    database: process.env.DB_NAME || 'SORHA'
});

// Conectar a MySQL
db.connect(err => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        process.exit(1); // Detiene la app si no puede conectar a la BD
    } else {
        console.log('Conectado exitosamente a la base de datos MySQL');
    }
});

// --- Middlewares Globales ---
app.use(bodyParser.urlencoded({ extended: true })); // Para formularios HTML
app.use(bodyParser.json()); // Para peticiones API con JSON
// Servir archivos estáticos (CSS, JS cliente, imágenes) desde 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'CAMBIAME_POR_UN_SECRETO_REAL_Y_SEGURO_EN_ENV', // ¡MUY IMPORTANTE CAMBIAR ESTO!
    resave: false,
    saveUninitialized: false, // GDPR Compliance & best practice
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
        httpOnly: true, // Seguridad: previene acceso desde JS
        maxAge: 24 * 60 * 60 * 1000 // 1 día de duración
        // sameSite: 'Lax' // Buena práctica para prevenir CSRF
    }
}));

// --- Middlewares de Autorización ---

// Middleware: Verifica si el usuario es 'admin'
const checkAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' });
    }
    if (req.session.user.rol !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol de Administrador.' });
    }
    next(); // Usuario es admin, continuar
};

// Middleware: Verifica si el usuario es 'administrativo' O 'admin'
const checkAdministrativoOrAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' });
    }
    const userRole = req.session.user.rol;
    if (userRole !== 'administrativo' && userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol Administrativo o Administrador.' });
    }
    next(); // Rol permitido, continuar
};


// --- Rutas HTML y Lógica de Sesión/Autenticación ---

// Ruta Raíz '/'
app.get('/', (req, res) => {
    if (req.session.user) {
        return redirectByRole(req.session.user.rol, res); // Redirigir si ya hay sesión
    }
    res.sendFile(path.join(__dirname, 'views', 'login.html')); // Mostrar login si no hay sesión
});

// Procesar Login (POST)
app.post('/login', (req, res) => {
    const { usuario, pass } = req.body;
    if (!usuario || !pass) {
        return res.redirect('/?error=Usuario+y+contraseña+son+requeridos');
    }

    // Buscar usuario activo con contraseña correcta (hasheada con SHA2-256)
    db.query(
        'SELECT id, usuario, rol FROM USUARIOS WHERE usuario = ? AND pass = SHA2(?, 256) AND activo = TRUE',
        [usuario, pass],
        (err, results) => {
            if (err) {
                console.error('Error en la consulta de login:', err);
                return res.redirect('/?error=Error+interno+del+servidor');
            }
            if (results.length > 0) { // Usuario encontrado
                const user = results[0];
                req.session.user = { id: user.id, usuario: user.usuario, rol: user.rol };
                req.session.save(err => { // Guardar sesión antes de redirigir
                    if (err) {
                        console.error("Error al guardar sesión:", err);
                        return res.redirect('/?error=Error+al+iniciar+sesión');
                    }
                    redirectByRole(user.rol, res); // Redirigir al dashboard
                });
            } else { // Usuario no encontrado o contraseña incorrecta
                res.redirect('/?error=Usuario+o+contraseña+incorrectos');
            }
        }
    );
});

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
    };
    const targetRoute = routes[rol];
    if (targetRoute) {
        res.redirect(targetRoute);
    } else {
        console.warn(`Intento de redirección para rol no definido: ${rol}`);
        res.redirect('/?error=Rol+no+configurado'); // O a una página de error
    }
}

// Rutas Protegidas para servir archivos HTML
const protectedHtmlRoutes = {
    '/reportes': 'reportes',
    '/productividad': 'productividad',
    '/recursos': 'recursos',
    '/administrativo': 'administrativo', // Rol 'administrativo' (o 'admin')
    '/colaborador': 'colaborador',
    '/admin': 'admin',                   // Rol 'admin'
    '/nominas': 'nominas'
};

Object.entries(protectedHtmlRoutes).forEach(([route, requiredRole]) => {
    app.get(route, (req, res) => {
        if (!req.session.user) {
            return res.redirect('/'); // Requiere login
        }
        const userRole = req.session.user.rol;
        let hasAccess = (userRole === requiredRole);
        // Excepción: Admin puede acceder a la ruta de Administrativo
        if (route === '/administrativo' && userRole === 'admin') {
            hasAccess = true;
        }

        if (!hasAccess) {
            console.log(`Acceso denegado a ${route} para rol ${userRole}.`);
            // Podrías redirigir a su propio dashboard o mostrar error
            // return redirectByRole(userRole, res);
             return res.status(403).send(`Acceso denegado. Tu rol (${userRole}) no permite acceder a esta sección.`);
        }
        // Servir el HTML correspondiente desde la carpeta 'views'
        const htmlFileName = `${requiredRole}.html`;
        res.sendFile(path.join(__dirname, 'views', htmlFileName));
    });
});


// --- API: Endpoint para datos de sesión ---
app.get('/api/session/user', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'No autenticado' });
    }
});


// --- API CRUD para Usuarios (Login/Sistema - Tabla USUARIOS) ---
// Protegido por checkAdmin

// GET /api/users - Listar todos los usuarios
app.get('/api/users', checkAdmin, (req, res) => {
    db.query('SELECT id, usuario, rol, activo FROM USUARIOS ORDER BY usuario', (err, results) => {
        if (err) {
             console.error("Error DB get users:", err);
             return res.status(500).json({ success: false, message: 'Error DB al obtener usuarios.' });
        }
        res.json({ success: true, data: results });
    });
});

// GET /api/users/:id - Obtener un usuario
app.get('/api/users/:id', checkAdmin, (req, res) => {
    db.query('SELECT id, usuario, rol, activo FROM USUARIOS WHERE id = ?', [req.params.id], (err, results) => {
        if (err) { /* ... manejo de errores ... */ return res.status(500).json({ success: false, message: 'Error DB.' }); }
        if (results.length === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); }
        res.json({ success: true, data: results[0] });
    });
});

// POST /api/users - Crear usuario
app.post('/api/users', checkAdmin, (req, res) => {
    const { usuario, password, rol, activo = true } = req.body;
    const activoBool = String(activo).toLowerCase() === 'true' || activo === true || activo === 1;
    if (!usuario || !password || !rol) { /* ... validación ... */ return res.status(400).json({ success: false, message: 'Faltan campos.' }); }

    db.query('SELECT id FROM USUARIOS WHERE usuario = ?', [usuario], (err, results) => { // Check duplicado
        if (err) { /* ... manejo de errores ... */ return res.status(500).json({ success: false, message: 'Error DB check.' }); }
        if (results.length > 0) { return res.status(400).json({ success: false, message: 'Usuario ya existe.' }); }

        // Insertar nuevo usuario
        db.query('INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)',
            [usuario, password, rol, activoBool], (err, result) => {
                if (err) { /* ... manejo de errores ... */ return res.status(500).json({ success: false, message: 'Error DB create.' }); }
                res.status(201).json({ success: true, message: 'Usuario creado.', data: { id: result.insertId, usuario, rol, activo: activoBool } });
            }
        );
    });
});

// PUT /api/users/:id - Actualizar usuario
app.put('/api/users/:id', checkAdmin, (req, res) => {
    const { usuario, password, rol, activo } = req.body;
    const { id } = req.params;
    const activoBool = String(activo).toLowerCase() === 'true' || activo === true || activo === 1;
    if (!usuario || !rol || activo === undefined) { /* ... validación ... */ return res.status(400).json({ success: false, message: 'Faltan campos.' }); }

    let query, params;
    if (password && password.trim() !== '') { // Actualizar contraseña si se provee
        query = 'UPDATE USUARIOS SET usuario = ?, pass = SHA2(?, 256), rol = ?, activo = ? WHERE id = ?';
        params = [usuario, password, rol, activoBool, id];
    } else { // No actualizar contraseña
        query = 'UPDATE USUARIOS SET usuario = ?, rol = ?, activo = ? WHERE id = ?';
        params = [usuario, rol, activoBool, id];
    }

    db.query(query, params, (err, result) => {
         if (err) {
             if (err.code === 'ER_DUP_ENTRY') { return res.status(400).json({ success: false, message: 'Usuario ya en uso.' }); }
             /* ... manejo de errores ... */ return res.status(500).json({ success: false, message: 'Error DB update.' });
         }
         if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); }
        res.json({ success: true, message: 'Usuario actualizado.' });
    });
});

// DELETE /api/users/:id - Eliminar usuario
app.delete('/api/users/:id', checkAdmin, (req, res) => {
     const { id } = req.params;
     if (req.session.user && req.session.user.id == id) { /* ... evitar auto-eliminación ... */ return res.status(400).json({ success: false, message: 'No puedes eliminarte.' }); }

    db.query('DELETE FROM USUARIOS WHERE id = ?', [id], (err, result) => {
         if (err) {
             if (err.code === 'ER_ROW_IS_REFERENCED_2') { return res.status(400).json({ success: false, message: 'Usuario referenciado.' }); }
             /* ... manejo de errores ... */ return res.status(500).json({ success: false, message: 'Error DB delete.' });
         }
         if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); }
        res.json({ success: true, message: 'Usuario eliminado.' });
    });
});


// --- API CRUD para colaboradores (Tabla colaboradores) ---
// Protegido por checkAdministrativoOrAdmin

// GET /api/colaboradores/:id - Obtener un empleado
app.get('/api/colaboradores/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM colaboradores WHERE id_empleado = ?';
    db.query(sql, [id], (err, results) => {
        if (err) { /* ... */ return res.status(500).json({ message: 'Error interno del servidor.' }); }
        if (results.length === 0) { /* ... */ return res.status(404).json({ message: 'Empleado no encontrado.' }); }
        const empleado = results[0];
        // Formatear fecha YYYY-MM-DD
        if (empleado.fecha_nacimiento) {
            try {
                 const date = new Date(empleado.fecha_nacimiento);
                 empleado.fecha_nacimiento = date.toISOString().split('T')[0];
            } catch(e) { empleado.fecha_nacimiento = null; }
        }
        res.json(empleado);
    });
});

// GET /api/colaboradores - Listar todos los colaboradores
app.get('/api/colaboradores', checkAdministrativoOrAdmin, (req, res) => {
    const sql = 'SELECT * FROM colaboradores ORDER BY primer_apellido ASC, primer_nombre ASC'; // Ordenar alfabéticamente
    db.query(sql, (err, results) => {
        if (err) { /* ... */ return res.status(500).json({ message: 'Error interno del servidor.' }); }
        res.json(results);
    });
});

// POST /api/colaboradores - Crear empleado
app.post('/api/colaboradores', checkAdministrativoOrAdmin, (req, res) => {
    const d = req.body; // Alias para datos
    if (!d.primer_nombre || !d.primer_apellido || !d.usuario_empleado) { /* ... */ return res.status(400).json({ message: 'Faltan campos obligatorios.' }); }
    const edadInt = d.edad ? parseInt(d.edad, 10) : null;
    if (d.edad && isNaN(edadInt)) { /* ... */ return res.status(400).json({ message: 'Edad inválida.' }); }

    const sql = `INSERT INTO colaboradores (primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario_empleado, sexo, edad, id_contrato, puesto, estado_civil, fecha_nacimiento, ciudad_nacimiento, departamento, email, email_interno, telefono, direccion, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [ d.primer_nombre, d.segundo_nombre||null, d.primer_apellido, d.segundo_apellido||null, d.usuario_empleado, d.sexo||null, edadInt, d.id_contrato||null, d.puesto||null, d.estado_civil||null, d.fecha_nacimiento||null, d.ciudad_nacimiento||null, d.departamento||null, d.email||null, d.email_interno||null, d.telefono||null, d.direccion||null, d.status||'Activo' ];

    db.query(sql, values, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') { return res.status(400).json({ message: 'Usuario de empleado ya existe.' }); }
            if (err.code === 'ER_NO_REFERENCED_ROW_2') { return res.status(400).json({ message: 'ID de contrato inválido.' }); }
            /* ... */ return res.status(500).json({ message: 'Error interno al crear empleado.' });
        }
        res.status(201).json({ message: 'Empleado creado exitosamente.', id: result.insertId });
    });
});

// PUT /api/colaboradores/:id - Actualizar empleado
app.put('/api/colaboradores/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const d = req.body; // Alias
    if (!d.primer_nombre || !d.primer_apellido || !d.usuario_empleado) { /* ... */ return res.status(400).json({ message: 'Faltan campos obligatorios.' }); }
    const edadInt = d.edad ? parseInt(d.edad, 10) : null;
    if (d.edad && isNaN(edadInt)) { /* ... */ return res.status(400).json({ message: 'Edad inválida.' }); }

    const sql = `UPDATE colaboradores SET primer_nombre=?, segundo_nombre=?, primer_apellido=?, segundo_apellido=?, usuario_empleado=?, sexo=?, edad=?, id_contrato=?, puesto=?, estado_civil=?, fecha_nacimiento=?, ciudad_nacimiento=?, departamento=?, email=?, email_interno=?, telefono=?, direccion=?, status=? WHERE id_empleado=?`;
    const values = [ d.primer_nombre, d.segundo_nombre||null, d.primer_apellido, d.segundo_apellido||null, d.usuario_empleado, d.sexo||null, edadInt, d.id_contrato||null, d.puesto||null, d.estado_civil||null, d.fecha_nacimiento||null, d.ciudad_nacimiento||null, d.departamento||null, d.email||null, d.email_interno||null, d.telefono||null, d.direccion||null, d.status||'Activo', id ];

    db.query(sql, values, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') { return res.status(400).json({ message: 'Usuario de empleado ya en uso.' }); }
            if (err.code === 'ER_NO_REFERENCED_ROW_2') { return res.status(400).json({ message: 'ID de contrato inválido.' }); }
            /* ... */ return res.status(500).json({ message: 'Error interno al actualizar.' });
        }
        if (result.affectedRows === 0) { /* ... */ return res.status(404).json({ message: 'Empleado no encontrado.' }); }
        res.json({ message: 'Empleado actualizado exitosamente.' });
    });
});

// DELETE /api/colaboradores/:id - Eliminar empleado
app.delete('/api/colaboradores/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM colaboradores WHERE id_empleado = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            if (err.code === 'ER_ROW_IS_REFERENCED_2') { return res.status(400).json({ message: 'No se puede eliminar, empleado referenciado.' }); }
            /* ... */ return res.status(500).json({ message: 'Error interno al eliminar.' });
        }
        if (result.affectedRows === 0) { /* ... */ return res.status(404).json({ message: 'Empleado no encontrado.' }); }
        res.json({ message: 'Empleado eliminado exitosamente.' });
    });
});


// --- Logout ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            // Intenta redirigir incluso si hay error al destruir sesión
             return res.redirect('/?error=Error+al+cerrar+sesión');
        }
        // Limpiar la cookie del lado del cliente
        res.clearCookie('connect.sid'); // Reemplaza 'connect.sid' si usas otro nombre de cookie
        res.redirect('/'); // Redirigir a la página de login
    });
});

// --- Manejadores de Errores (Deben ir al final) ---

// Manejador para rutas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).sendFile(path.join(__dirname, 'views', '404.html')); // O envía un mensaje simple
    // res.status(404).send("Lo sentimos, la página que buscas no existe (404).");
});

// Manejador de errores generales (500)
// Debe tener 4 argumentos (err, req, res, next)
app.use((err, req, res, next) => {
  console.error("---- ERROR NO MANEJADO DETECTADO ----");
  console.error("Ruta:", req.method, req.originalUrl);
  console.error("Error:", err.stack || err); // Muestra el stack trace completo
  console.error("-------------------------------------");

  // Evitar enviar el stack trace al cliente en producción
  if (process.env.NODE_ENV === 'production') {
       res.status(500).send('¡Algo salió muy mal en el servidor! (500)');
  } else {
       // En desarrollo, puede ser útil enviar más detalles (con precaución)
       res.status(500).send(`<h1>Error 500 - Error Interno</h1><pre>${err.stack || err}</pre>`);
  }
});


// Iniciar el servidor Express
app.listen(PORT, () => {
    console.log(`-----------------------------------------------------------`);
    console.log(`Servidor SORHA corriendo en http://localhost:${PORT}`);
    console.log(`Sirviendo HTML desde: ${path.join(__dirname, 'views')}`);
    console.log(`Sirviendo Estáticos (CSS/JS) desde: ${path.join(__dirname, 'public')}`);
    console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`-----------------------------------------------------------`);
});