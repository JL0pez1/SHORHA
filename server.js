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
        // Es vital ver este error si falla la conexión inicial
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
// AGREGADO: Definición del middleware checkAuthenticated y otros.
// ESTE BLOQUE COMPLETO SE HA AGREGADO.

// Middleware: Verifica si el usuario es 'admin'
const checkAdmin = (req, res, next) => {
    if (!req.session.user) {
        // Si la petición espera JSON, responder JSON, sino redirigir
        if (req.accepts('json')) {
            return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' });
        } else {
            return res.redirect('/?error=Acceso+requiere+autenticación');
        }
    }
    if (req.session.user.rol !== 'admin') {
        if (req.accepts('json')) {
            return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol de Administrador.' });
        } else {
            return res.status(403).send('Acceso denegado. Requiere rol de Administrador.');
        }
    }
    next(); // Usuario es admin, continuar
};

// Middleware: Verifica si el usuario es 'administrativo' O 'admin'
const checkAdministrativoOrAdmin = (req, res, next) => {
    if (!req.session.user) {
        if (req.accepts('json')) {
            return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' });
        } else {
             return res.redirect('/?error=Acceso+requiere+autenticación');
        }
    }
    const userRole = req.session.user.rol;
    if (userRole !== 'administrativo' && userRole !== 'admin') {
        if (req.accepts('json')) {
            return res.status(403).json({ success: false, message: 'Acceso no autorizado. Se requiere rol Administrativo o Administrador.' });
        } else {
             return res.status(403).send('Acceso denegado. Requiere rol Administrativo o Administrador.');
        }
    }
    next(); // Rol permitido, continuar
};

// Middleware: Verifica si hay un usuario logueado (cualquier rol)
// ESTA ES LA FUNCIÓN checkAuthenticated QUE RESOLVERÁ EL REFERENCEERROR.
const checkAuthenticated = (req, res, next) => {
    if (!req.session.user) {
         if (req.accepts('json')) {
            return res.status(401).json({ success: false, message: 'No autenticado. Por favor, inicie sesión.' });
        } else {
             return res.redirect('/?error=Acceso+requiere+autenticación');
        }
    }
    next(); // Usuario logueado, continuar
}


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
                // Regenerar sesión para prevenir fijación de sesión
                req.session.regenerate(err => {
                     if (err) {
                         console.error("Error al regenerar sesión:", err);
                         return res.redirect('/?error=Error+al+iniciar+sesión');
                     }
                    req.session.user = { id: user.id, usuario: user.usuario, rol: user.rol };
                    req.session.save(err => { // Guardar sesión antes de redirigir
                        if (err) {
                            console.error("Error al guardar sesión:", err);
                            return res.redirect('/?error=Error+al+iniciar+sesión');
                        }
                        redirectByRole(user.rol, res); // Redirigir al dashboard
                    });
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
        // Quizás redirigir a una página genérica o al login con error
        res.redirect('/?error=Rol+no+configurado+para+redirección');
    }
}

// Rutas Protegidas para servir archivos HTML
const protectedHtmlRoutes = {
    '/reportes': 'reportes',
    '/productividad': 'productividad',
    '/recursos': 'recursos',
    '/administrativo': 'administrativo', // Rol 'administrativo' (o 'admin')
    '/colaborador': 'colaborador', // AGREGADO: Ruta HTML para colaborador
    '/admin': 'admin',                   // Rol 'admin'
    '/nominas': 'nominas' // Asumiendo que nominas es una página protegida
};
// MODIFICADO: Este loop ahora usa checkAuthenticated como primer middleware
Object.entries(protectedHtmlRoutes).forEach(([route, htmlFileNameWithoutExt]) => {
    app.get(route, checkAuthenticated, (req, res, next) => { // Usa checkAuthenticated primero
        const userRole = req.session.user.rol;
        let hasAccess = false;
        let requiredRole = htmlFileNameWithoutExt; // El nombre del archivo .html es el rol base requerido

        // Lógica de control de acceso más granular DESPUÉS de autenticar
        switch (requiredRole) {
            case 'admin':
                hasAccess = (userRole === 'admin'); // Solo admin
                break;
            case 'administrativo':
                hasAccess = (userRole === 'admin' || userRole === 'administrativo'); // Admin o adminstrativo
                break;
            case 'colaborador':
                 // Colaborador solo accede a /colaborador (y admin quizás si quieres)
                 // Si quieres que admin también acceda, descomenta la siguiente línea:
                 // if (userRole === 'admin') hasAccess = true;
                hasAccess = (userRole === 'colaborador'); // Solo colaborador accede por defecto
                break;
            default:
                // Otras rutas pueden requerir roles específicos o ser accesibles por admin
                hasAccess = (userRole === requiredRole || userRole === 'admin'); // Admin accede a todo lo demás por defecto
                break;
        }

        if (!hasAccess) {
            console.log(`Acceso denegado a ${route} para rol ${userRole}.`);
            // Si no tiene acceso, responde con HTML de acceso denegado
             return res.status(403).send('<!DOCTYPE html><html><head><title>Acceso Denegado</title></head><body><h1>Acceso Denegado</h1><p>Tu rol (' + userRole + ') no permite acceder a esta sección.</p><p><a href="/">Volver al inicio</a></p></body></html>');
        }
        // Servir el archivo HTML correspondiente desde la carpeta 'views'
        const htmlFileName = `${htmlFileNameWithoutExt}.html`;
        const filePath = path.join(__dirname, 'views', htmlFileName);

         res.sendFile(filePath, (err) => {
              if (err) {
                  console.error(`Error sirviendo archivo ${htmlFileName}:`, err);
                  // Si el archivo no se encuentra, puede ser un 404 o un error interno
                  if (err.code === 'ENOENT') {
                       res.status(404).send(`Archivo ${htmlFileName} no encontrado.`);
                  } else {
                       res.status(500).send(`Error interno al cargar la página ${htmlFileName}.`);
                  }
              }
         });
    });
});


// --- API CRUD para Usuarios (Login/Sistema - Tabla USUARIOS) ---
// Protegido por checkAdmin

// GET /api/users - Listar todos los usuarios
app.get('/api/users', checkAdmin, (req, res) => {
    db.query('SELECT id, usuario, rol, activo, fecha_creacion FROM USUARIOS ORDER BY usuario', (err, results) => {
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
        if (err) { console.error("Error DB get user by id:", err); return res.status(500).json({ success: false, message: 'Error DB.' }); }
        if (results.length === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); }
        res.json({ success: true, data: results[0] });
    });
});

// POST /api/users - Crear usuario
app.post('/api/users', checkAdmin, (req, res) => {
    const { usuario, password, rol, activo = true } = req.body;
    // Convertir 'activo' a booleano/número (consistentemente)
    const activoBool = ['true', '1', 1, true].includes(String(activo).toLowerCase());

    if (!usuario || !password || !rol) { return res.status(400).json({ success: false, message: 'Usuario, contraseña y rol son requeridos.' }); }

    // Validar rol (opcional, pero buena idea)
    const rolesPermitidos = ['admin', 'administrativo', 'colaborador', 'reportes', 'productividad', 'recursos', 'nominas']; // Actualiza según tus roles
    if (!rolesPermitidos.includes(rol)) {
         return res.status(400).json({ success: false, message: `Rol '${rol}' no es válido.` });
    }

    db.query('SELECT id FROM USUARIOS WHERE usuario = ?', [usuario], (err, results) => { // Check duplicado
        if (err) { console.error("Error DB check user exists:", err); return res.status(500).json({ success: false, message: 'Error DB check.' }); }
        if (results.length > 0) { return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe.' }); }

        // Insertar nuevo usuario
        db.query('INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)',
            [usuario, password, rol, activoBool], (err, result) => {
                if (err) {
                     console.error("Error DB create user:", err);
                      if (err.code === 'ER_DUP_ENTRY') { // Doble check por si acaso
                          return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe.' });
                      }
                      return res.status(500).json({ success: false, message: 'Error DB al crear usuario.' });
                }
                res.status(201).json({ success: true, message: 'Usuario creado exitosamente.', data: { id: result.insertId, usuario, rol, activo: activoBool } });
            }
        );
    });
});

// PUT /api/users/:id - Actualizar usuario
app.put('/api/users/:id', checkAdmin, (req, res) => {
    const { usuario, password, rol, activo } = req.body;
    const { id } = req.params;

    // Validar que 'activo' esté presente (incluso si es false/0)
    if (!usuario || !rol || activo === undefined || activo === null) {
         return res.status(400).json({ success: false, message: 'Usuario, rol y estado activo son requeridos.' });
    }
    const activoBool = ['true', '1', 1, true].includes(String(activo).toLowerCase());

    // Validar rol (opcional)
    const rolesPermitidos = ['admin', 'administrativo', 'colaborador', 'reportes', 'productividad', 'recursos', 'nominas'];
    if (!rolesPermitidos.includes(rol)) {
         return res.status(400).json({ success: false, message: `Rol '${rol}' no es válido.` });
    }

    // Prevenir que el admin se desactive a sí mismo o cambie su propio rol (si es necesario)
    if (req.session.user && req.session.user.id == id) {
        if (rol !== 'admin') {
           return res.status(400).json({ success: false, message: 'No puedes cambiar tu propio rol de administrador.' });
         }
        if (!activoBool) {
             return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta de administrador.' });
         }
    }


    let query, params;
    if (password && password.trim() !== '') { // Actualizar contraseña si se provee una no vacía
        query = 'UPDATE USUARIOS SET usuario = ?, pass = SHA2(?, 256), rol = ?, activo = ? WHERE id = ?';
        params = [usuario, password, rol, activoBool, id];
    } else { // No actualizar contraseña
        query = 'UPDATE USUARIOS SET usuario = ?, rol = ?, activo = ? WHERE id = ?';
        params = [usuario, rol, activoBool, id];
    }

    db.query(query, params, (err, result) => {
         if (err) {
             console.error("Error DB update user:", err);
             if (err.code === 'ER_DUP_ENTRY') { return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso por otra cuenta.' }); }
             return res.status(500).json({ success: false, message: 'Error DB al actualizar usuario.' });
         }
         if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); }
        res.json({ success: true, message: 'Usuario actualizado exitosamente.' });
    });
});

// DELETE /api/users/:id - Eliminar usuario
app.delete('/api/users/:id', checkAdmin, (req, res) => {
     const { id } = req.params;
     // Prevenir que el admin se elimine a sí mismo
     if (req.session.user && req.session.user.id == id) {
         return res.status(400).json({ success: false, message: 'No puedes eliminar tu propia cuenta de administrador.' });
     }

    db.query('DELETE FROM USUARIOS WHERE id = ?', [id], (err, result) => {
         if (err) {
             console.error("Error DB delete user:", err);
             // Si el usuario está referenciado en otra tabla (ej: logs, asignaciones), podría fallar
             if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                  return res.status(400).json({ success: false, message: 'No se puede eliminar, el usuario tiene registros asociados en otras tablas.' });
             }
             return res.status(500).json({ success: false, message: 'Error DB al eliminar usuario.' });
         }
         if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); }
        res.json({ success: true, message: 'Usuario eliminado exitosamente.' });
    });
});


// --- API CRUD para colaboradores (Tabla colaboradores) ---
// ESTE BLOQUE COMPLETO REEMPLAZA TUS RUTAS API EXISTENTES PARA /api/colaboradores
// e incluye la ruta /api/colaborador/data.
// Protegido por checkAdministrativoOrAdmin (excepto /api/colaborador/data que usa checkAuthenticated)

// GET /api/colaboradores/:id - Obtener un empleado
app.get('/api/colaboradores/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    // Selecciona todos los campos de colaboradores
    const sql = 'SELECT * FROM colaboradores WHERE id_empleado = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error DB get colaborador by id:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al obtener colaborador.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado.' });
        }
        const empleado = results[0];
        // Formatear fecha a YYYY-MM-DD si existe
        if (empleado.fecha_nacimiento) {
           try {
                // MySQL connector might return Date objects, need robust formatting
                const date = new Date(empleado.fecha_nacimiento);
                // Check if the date is valid
                if (!isNaN(date.getTime())) {
                     // Format as YYYY-MM-DD
                     const year = date.getFullYear();
                     const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
                     const day = date.getDate().toString().padStart(2, '0');
                     empleado.fecha_nacimiento = `${year}-${month}-${day}`;
                } else {
                     empleado.fecha_nacimiento = null; // Invalid date, set to null
                }
            } catch (e) {
                 console.error("Error formateando fecha_nacimiento:", e);
                 empleado.fecha_nacimiento = null; // Dejar nulo si hay error
            }
        }
        // Devolver éxito y los datos del empleado
        res.json({ success: true, data: empleado });
    });
});

// GET /api/colaboradores - Listar todos los colaboradores
app.get('/api/colaboradores', checkAdministrativoOrAdmin, (req, res) => {
    // Selecciona todos los campos y ordena
    const sql = 'SELECT * FROM colaboradores ORDER BY primer_apellido ASC, primer_nombre ASC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error DB get all colaboradores:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al listar colaboradores.' });
        }
        // Devolver éxito y la lista de colaboradores
        res.json({ success: true, data: results });
    });
});

// POST /api/colaboradores - Crear empleado Y usuario asociado (CON TRANSACCION)
// Este código crea tanto el colaborador como el usuario de login asociado.
app.post('/api/colaboradores', checkAdministrativoOrAdmin, (req, res) => {
    const d = req.body; // Datos del colaborador
    const { password } = req.body; // Contraseña para el usuario asociado

    console.log('Received POST body for colaborador:', d); // LOG para depuración

    // --- Validación Backend ---
    // Aseguramos que los campos marcados como obligatorios en el frontend lleguen con datos
    if (!d.primer_nombre || d.primer_nombre.trim() === '' ||
        !d.primer_apellido || d.primer_apellido.trim() === '' ||
        !d.usuario_empleado || d.usuario_empleado.trim() === '' ||
        !d.status || d.status.trim() === '') // Añadida validación para status
    {
         return res.status(400).json({ success: false, message: 'Primer Nombre, Primer Apellido, Usuario (Login) y Estado son obligatorios.' });
    }
    if (!password || password.trim() === '') { // Requerir contraseña no vacía al crear
        return res.status(400).json({ success: false, message: 'La contraseña es obligatoria y no puede estar vacía para crear el usuario asociado.' });
    }

    const edadInt = d.edad ? parseInt(d.edad, 10) : null;
    if (d.edad && (isNaN(edadInt) || edadInt < 0)) { // Validar que sea número positivo si se ingresa
        return res.status(400).json({ success: false, message: 'Edad inválida (debe ser un número positivo).' });
    }
    // --- Fin Validación ---

    // Iniciar Transacción
    db.beginTransaction(err => {
        if (err) {
            console.error("Error iniciando transacción:", err);
            return res.status(500).json({ success: false, message: 'Error interno al iniciar la operación.', error: err.message }); // Incluir mensaje del error
        }

        // 1. Insertar en 'colaboradores'
        // Asegúrate que la lista de columnas y valores coincida EXACTAMENTE con tu tabla
        const sqlColaborador = `INSERT INTO colaboradores (id_empleado, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario_empleado, sexo, edad, id_contrato, puesto, estado_civil, fecha_nacimiento, ciudad_nacimiento, departamento, email, email_interno, telefono, direccion, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        // Si id_empleado es AUTO_INCREMENT, pásalo como NULL. Si NO es AUTO_INCREMENT y DEBE venir del frontend, usa d.id_empleado y valida que no sea null/vacío ANTES.
        // Basado en tu DESCRIBE que dice YES NULL para id_empleado, asumo que o es AUTO_INCREMENT o es nullable (aunque sea PK, lo cual es raro).
        // Mantendremos NULL si no viene.
        const valuesColaborador = [
            d.id_empleado || null, // Pasa null si no viene un id_empleado del frontend
            d.primer_nombre.trim(), d.segundo_nombre ? d.segundo_nombre.trim() : null, d.primer_apellido.trim(), d.segundo_apellido ? d.segundo_apellido.trim() : null,
            d.usuario_empleado.trim(), // Aseguramos que se use el valor del formulario
            d.sexo || null, edadInt, d.id_contrato ? String(d.id_contrato).trim() : null, d.puesto ? d.puesto.trim() : null,
            d.estado_civil || null, d.fecha_nacimiento || null, d.ciudad_nacimiento ? d.ciudad_nacimiento.trim() : null, d.departamento ? d.departamento.trim() : null,
            d.email ? d.email.trim() : null, d.email_interno ? d.email_interno.trim() : null, d.telefono ? d.telefono.trim() : null, d.direccion ? d.direccion.trim() : null, d.status.trim()
        ];

        console.log('Inserting into colaboradores with values:', valuesColaborador); // LOG crucial

        db.query(sqlColaborador, valuesColaborador, (err, resultColaborador) => {
            if (err) {
                // *** ESTE ES EL PUNTO CLAVE PARA VER EL ERROR ESPECÍFICO ***
                console.error("Error insertando colaborador:", err);
                return db.rollback(() => { // Deshacer transacción
                    if (err.code === 'ER_DUP_ENTRY') {
                        // Mejorar mensaje para identificar la columna duplicada si es posible
                         const message = err.sqlMessage && err.sqlMessage.toLowerCase().includes('usuario_empleado')
                            ? 'El Usuario de Empleado ya existe para otro colaborador.'
                            : (err.sqlMessage && err.sqlMessage.toLowerCase().includes('for key')) // Verificar FK issues no capturadas
                                ? 'Error de clave foránea. Verifique el ID de contrato u otros datos relacionados.'
                                : (err.sqlMessage && err.sqlMessage.toLowerCase().includes('duplicate entry')) // Otro error de duplicidad
                                    ? 'Error de duplicidad en la base de datos (posiblemente ID de empleado si es manual).'
                                    : 'Ya existe un registro con datos duplicados.'; // Fallback
                         return res.status(400).json({ success: false, message: message });
                    }
                    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                        return res.status(400).json({ success: false, message: 'ID de contrato inválido o no existe.' });
                    }
                    // Error genérico capturado por el usuario
                    return res.status(500).json({ success: false, message: 'Error interno al crear colaborador.', error: err.message }); // Incluir mensaje del error para debug
                });
            }

            // Si id_empleado NO es auto_increment y se envió, usamos ese.
            // Si es auto_increment, resultColaborador.insertId lo tendrá.
            // Si id_empleado es nullable (como dice DESCRIBE) pero no auto_increment y no se envió, insertId será 0 o undefined.
            // Usaremos resultColaborador.insertId si id_empleado que vino en d.id_empleado es null/undefined/empty, asumiendo AUTO_INCREMENT.
            const nuevoColaboradorId = (d.id_empleado !== null && d.id_empleado !== undefined && d.id_empleado !== '') ? d.id_empleado : resultColaborador.insertId;
            if (!nuevoColaboradorId) {
                 console.error("Could not determine new colaborador ID after insert.");
                 return db.rollback(() => {
                     res.status(500).json({ success: false, message: 'Error al obtener el ID del nuevo colaborador.', error: 'Could not determine new ID' });
                 });
            }
             console.log('Colaborador inserted successfully with ID:', nuevoColaboradorId);
            // 2. Insertar en 'usuarios'
            const sqlUsuario = 'INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)';
            const valuesUsuario = [d.usuario_empleado.trim(), password, 'colaborador', true]; // Rol fijo 'colaborador', activo por defecto

            console.log('Attempting to insert user with values:', [valuesUsuario[0], '[PASSWORD_HASHED]', valuesUsuario[2], valuesUsuario[3]]); // Log values excluding raw password

            db.query(sqlUsuario, valuesUsuario, (err, resultUsuario) => {
                if (err) {
                    console.error("Error insertando usuario:", err); // LOG para ver si este es el error
                    return db.rollback(() => { // Deshacer transacción
                         if (err.code === 'ER_DUP_ENTRY') {
                            // Esto significa que el usuario_empleado ya existía en la tabla usuarios
                             return res.status(400).json({ success: false, message: 'El nombre de usuario (Login) ya está registrado en el sistema de usuarios. No se creó el colaborador.', error: err.message });
                         }
                        // Error genérico al crear usuario
                        return res.status(500).json({ success: false, message: 'Error interno al crear el usuario asociado. No se creó el colaborador.', error: err.message }); // Incluir mensaje del error
                    });
                }

                console.log('User created successfully with ID:', resultUsuario.insertId);
                // Si ambas inserciones OK, confirmar transacción
                db.commit(err => {
                    if (err) {
                        console.error("Error confirmando transacción:", err); // LOG si falla el commit
                        return db.rollback(() => { // Intentar deshacer si falla el commit
                            res.status(500).json({ success: false, message: 'Error interno al finalizar la operación (falló el commit).', error: err.message });
                        });
                    }
                    // Éxito!
                    res.status(201).json({ success: true, message: 'Colaborador y usuario creados exitosamente.', idColaborador: nuevoColaboradorId });
                });
            });
        });
    });
});


// PUT /api/colaboradores/:id - Actualizar empleado Y usuario asociado
app.put('/api/colaboradores/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params; // id_empleado a actualizar
    const d = req.body; // Nuevos datos del colaborador
    const { password } = req.body; // Nueva contraseña (opcional, puede ser vacía/null)

    console.log('Received PUT body for colaborador:', d); // LOG para depuración
    console.log('Updating colaborador ID:', id); // LOG para depuración


    // --- Validación Backend ---
     if (!id) {
         return res.status(400).json({ success: false, message: 'Falta el ID del colaborador en la ruta.' });
    }
    if (!d.primer_nombre || d.primer_nombre.trim() === '' ||
        !d.primer_apellido || d.primer_apellido.trim() === '' ||
        !d.usuario_empleado || d.usuario_empleado.trim() === '' ||
        !d.status || d.status.trim() === '')
    {
         return res.status(400).json({ success: false, message: 'Primer Nombre, Primer Apellido, Usuario (Login) y Estado son obligatorios.' });
    }
    const edadInt = d.edad ? parseInt(d.edad, 10) : null;
    if (d.edad && (isNaN(edadInt) || edadInt < 0)) {
        return res.status(400).json({ success: false, message: 'Edad inválida (debe ser un número positivo).' });
    }
     // --- Fin Validación ---

    // 1. Obtener el usuario_empleado *actual* antes de actualizar
    const sqlGetUsername = 'SELECT usuario_empleado FROM colaboradores WHERE id_empleado = ?';
    db.query(sqlGetUsername, [id], (err, results) => {
        if (err) {
             console.error("Error DB get old username:", err); // LOG si falla esta consulta
             return res.status(500).json({ success: false, message: 'Error interno consultando datos actuales del colaborador y usuario.', error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado para actualizar.' });
        }
        const oldUsername = results[0].usuario_empleado;
        const oldUsernameTrimmed = oldUsername ? oldUsername.trim() : ''; // Manejar posibles nulos/vacíos y trim
        const newUsernameTrimmed = d.usuario_empleado ? d.usuario_empleado.trim() : ''; // Asegurar que el nuevo username esté trimmed

        console.log(`Old username for ID ${id}: '${oldUsernameTrimmed}'`); // LOG

        // Iniciar Transacción para actualizar ambas tablas
         db.beginTransaction(err => {
             if (err) {
                 console.error("Error iniciando transacción para actualizar:", err);
                 return res.status(500).json({ success: false, message: 'Error interno al iniciar la operación de actualización.', error: err.message });
             }

             // 2. Actualizar la tabla 'colaboradores'
             const sqlUpdateColab = `UPDATE colaboradores SET primer_nombre=?, segundo_nombre=?, primer_apellido=?, segundo_apellido=?, usuario_empleado=?, sexo=?, edad=?, id_contrato=?, puesto=?, estado_civil=?, fecha_nacimiento=?, ciudad_nacimiento=?, departamento=?, email=?, email_interno=?, telefono=?, direccion=?, status=? WHERE id_empleado=?`;
             const valuesUpdateColab = [
                 d.primer_nombre.trim(), d.segundo_nombre ? d.segundo_nombre.trim() : null, d.primer_apellido.trim(), d.segundo_apellido ? d.segundo_apellido.trim() : null,
                 newUsernameTrimmed,
                 d.sexo || null, edadInt, d.id_contrato ? String(d.id_contrato).trim() : null, d.puesto ? d.puesto.trim() : null, d.estado_civil || null,
                 d.fecha_nacimiento || null, d.ciudad_nacimiento ? d.ciudad_nacimiento.trim() : null, d.departamento ? d.departamento.trim() : null, d.email ? d.email.trim() : null,
                 d.email_interno ? d.email_interno.trim() : null, d.telefono ? d.telefono.trim() : null, d.direccion ? d.direccion.trim() : null, d.status.trim(),
                 id
             ];

             console.log('Updating colaborador with values:', valuesUpdateColab); // LOG crucial

             db.query(sqlUpdateColab, valuesUpdateColab, (err, resultColab) => {
                 if (err) {
                      console.error("Error actualizando colaborador:", err); // LOG si falla esta actualización
                      return db.rollback(() => {
                          if (err.code === 'ER_DUP_ENTRY') {
                               const message = err.sqlMessage && err.sqlMessage.toLowerCase().includes('usuario_empleado')
                                    ? 'El nuevo Usuario de Empleado ya está en uso por otro colaborador.'
                                    : 'Error de duplicidad al actualizar colaborador.'; // Podría ser en id_empleado si intentan cambiarlo y ya existe
                               return res.status(400).json({ success: false, message: message, error: err.message });
                          }
                          if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                              return res.status(400).json({ success: false, message: 'ID de contrato inválido o no existe.', error: err.message });
                          }
                          return res.status(500).json({ success: false, message: 'Error interno al actualizar datos del colaborador.', error: err.message });
                      });
                 }

                 if (resultColab.affectedRows === 0) {
                     // Esto podría pasar si el ID existe pero por alguna razón no se actualiza
                     console.warn(`Colaborador con ID ${id} encontrado pero no actualizado (affectedRows 0).`); // LOG
                      // Considerarlo un error o no? Por ahora, lo marcamos como no encontrado en la fase de update.
                      return db.rollback(() => {
                          res.status(404).json({ success: false, message: 'Colaborador no encontrado o sin cambios para actualizar.' }); // Mejor mensaje
                      });
                 }

                 console.log(`Colaborador with ID ${id} updated successfully. Affected rows: ${resultColab.affectedRows}`);


                 // 3. Actualizar la tabla 'usuarios' (si cambió username o se proveyó nueva contraseña)
                 // Lógica MODIFICADA para intentar actualizar el usuario asociado
                 let message = 'Colaborador actualizado exitosamente'; // Mensaje base

                 const usernameChanged = oldUsernameTrimmed !== newUsernameTrimmed;
                 const passwordProvided = password && password.trim() !== '';

                 // Solo intentar actualizar/crear usuario si cambió el username O se proveyó contraseña
                 if (usernameChanged || passwordProvided) {
                      let sqlUpdateUser = null;
                      let valuesUpdateUser = [];

                      // Intentar actualizar la cuenta de usuario existente primero (usando oldUsername)
                      if (oldUsernameTrimmed) { // Solo intentamos actualizar si había un nombre de usuario anterior
                           if (usernameChanged && passwordProvided) {
                                console.log(`Attempting to update user '${oldUsernameTrimmed}' to '${newUsernameTrimmed}' and changing password.`);
                                sqlUpdateUser = `
                                   UPDATE USUARIOS
                                   SET usuario = ?, pass = SHA2(?, 256)
                                   WHERE usuario = ? AND rol = 'colaborador'`; // Limitamos a rol 'colaborador'
                                valuesUpdateUser = [newUsernameTrimmed, password, oldUsernameTrimmed];
                           } else if (usernameChanged) {
                                console.log(`Attempting to update user username from '${oldUsernameTrimmed}' to '${newUsernameTrimmed}'.`);
                                sqlUpdateUser = `
                                   UPDATE USUARIOS
                                   SET usuario = ?
                                   WHERE usuario = ? AND rol = 'colaborador'`; // Limitamos a rol 'colaborador'
                                valuesUpdateUser = [newUsernameTrimmed, oldUsernameTrimmed];
                           } else if (passwordProvided) {
                                console.log(`Attempting to change password for user '${oldUsernameTrimmed}'.`);
                                sqlUpdateUser = `
                                   UPDATE USUARIOS
                                   SET pass = SHA2(?, 256)
                                   WHERE usuario = ? AND rol = 'colaborador'`; // Limitamos a rol 'colaborador'
                                valuesUpdateUser = [password, oldUsernameTrimmed];
                           }
                      } else {
                          // Si no había un nombre de usuario anterior en el colaborador, no podemos actualizar.
                           // Procedemos directamente al intento de creación.
                          sqlUpdateUser = null; // Indicamos que no se intentó UPDATE
                          console.log("No previous username found for this collaborator. Will attempt user creation directly if password provided.");
                      }


                      if (sqlUpdateUser) { // Solo ejecutar UPDATE si se construyó un query
                           db.query(sqlUpdateUser, valuesUpdateUser, (err, resultUser) => {
                               if (err) {
                                    console.error(`Error updating user account (old: '${oldUsernameTrimmed}', new: '${newUsernameTrimmed}'):`, err); // LOG
                                    // Si el nuevo username ya existe
                                    if (err.code === 'ER_DUP_ENTRY' && usernameChanged) {
                                         message = `Colaborador actualizado, pero el nuevo nombre de usuario '${newUsernameTrimmed}' ya existe en el sistema de usuarios. La cuenta de usuario asociada no pudo ser renombrada.`;
                                         // Como la actualización del colaborador sí fue exitosa, hacemos commit de esa parte
                                         db.commit(commitErr => {
                                              if (commitErr) console.error("Error committing after user update error:", commitErr);
                                               res.json({ success: true, warning: true, message: message, errorDetails: err.message }); // Éxito con advertencia
                                         });
                                         return; // Salir de este callback
                                    } else {
                                         // Otro error al actualizar el usuario
                                         message = 'Colaborador actualizado, pero hubo un error al actualizar la cuenta de usuario asociada.';
                                          // Hacemos commit de la actualización del colaborador
                                          db.commit(commitErr => {
                                               if (commitErr) console.error("Error committing after user update error:", commitErr);
                                               res.json({ success: true, warning: true, message: message, errorDetails: err.message }); // Éxito con advertencia
                                          });
                                          return; // Salir de este callback
                                    }
                               }

                               if (resultUser.affectedRows === 0) {
                                    // La cuenta de usuario con oldUsername y rol 'colaborador' NO fue encontrada para actualizar.
                                    console.warn(`User account '${oldUsernameTrimmed}' with rol 'colaborador' not found for update. Attempting to CREATE instead.`); // LOG
                                    // --- INTENTAR CREAR USUARIO EN SU LUGAR ---
                                    // Necesitamos una contraseña para crear un usuario.
                                    // Si no se proporcionó una contraseña en el PUT, no podemos crear.
                                    if (!passwordProvided) {
                                        console.warn("Cannot create user account: Password was not provided in the update request.");
                                        message = `Colaborador actualizado, pero la cuenta de usuario asociada ('${oldUsernameTrimmed}') no fue encontrada.
                                        No se pudo crear una nueva cuenta de usuario porque no se proporcionó una contraseña en la actualización.`;
                                         // Hacemos commit de la actualización del colaborador
                                         db.commit(commitErr => {
                                              if (commitErr) console.error("Error committing after user update error:", commitErr);
                                              res.json({ success: true, warning: true, message: message }); // Éxito con advertencia
                                         });
                                         return; // Salir de este callback
                                    }

                                    // Intentar INSERT ya que el UPDATE no encontró usuario
                                    const sqlInsertUser = 'INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)';
                                    const valuesInsertUser = [newUsernameTrimmed, password, 'colaborador', true];

                                    console.log('Attempting to insert user with values:', [valuesInsertUser[0], '[PASSWORD_HASHED]', valuesInsertUser[2], valuesInsertUser[3]]);
                                    db.query(sqlInsertUser, valuesInsertUser, (insertErr, insertResult) => {
                                        if (insertErr) {
                                            console.error(`Error creating user account '${newUsernameTrimmed}' after failed update attempt:`, insertErr);
                                            if (insertErr.code === 'ER_DUP_ENTRY') {
                                                message = `Colaborador actualizado, pero el nombre de usuario '${newUsernameTrimmed}' ya existe en el sistema de usuarios. No se pudo crear/asociar una cuenta de usuario.`;
                                            } else {
                                                message = `Colaborador actualizado, pero hubo un error al crear la cuenta de usuario asociada '${newUsernameTrimmed}'.`;
                                            }
                                            // Hacemos commit de la actualización del colaborador
                                             db.commit(commitErr => {
                                                 if (commitErr) console.error("Error committing after user insert error:", commitErr);
                                                 res.json({ success: true, warning: true, message: message, errorDetails: insertErr.message }); // Éxito con advertencia
                                             });
                                             return; // Salir de este callback
                                        }

                                        console.log(`New user account '${newUsernameTrimmed}' created successfully after update attempt.`);
                                        message = `Colaborador actualizado. Se creó una nueva cuenta de usuario asociada ('${newUsernameTrimmed}').`;
                                        // Confirmar la transacción completa (colaborador + usuario creado)
                                        db.commit(commitErr => {
                                             if (commitErr) console.error("Error committing after user insert success:", commitErr);
                                             res.json({ success: true, message: message }); // Éxito
                                        });
                                    });
                                } else { // User account was found and updated (affectedRows > 0)
                                     console.log(`User account for '${oldUsernameTrimmed}' updated successfully. Affected rows: ${resultUser.affectedRows}`);
                                     // Actualizar mensaje de éxito si se hicieron cambios en el usuario
                                      if (usernameChanged && passwordProvided) message = 'Colaborador y usuario (nombre y contraseña) actualizados.';
                                      else if (usernameChanged) message = 'Colaborador y nombre de usuario actualizados.';
                                      else if (passwordProvided) message = 'Colaborador y contraseña de usuario actualizados.';
                                      // The case where neither changed is handled by the else block earlier

                                    // Confirmar la transacción completa (colaborador + usuario actualizado)
                                    db.commit(commitErr => {
                                         if (commitErr) console.error("Error committing after user update success:", commitErr);
                                         res.json({ success: true, message: message }); // Éxito
                                    });
                               }
                           });

                      } else { // No se intentó UPDATE porque oldUsername era null/vacío
                           // Procedemos directamente al intento de creación si se proveyó password
                           if (!passwordProvided) {
                               console.warn("Cannot create user account: Password was not provided in the update request, and no previous username found.");
                               message = `Colaborador actualizado, pero no se encontró una cuenta de usuario asociada previamente.
                               No se pudo crear una nueva cuenta porque no se proporcionó una contraseña en la actualización.`;
                                // Hacemos commit de la actualización del colaborador
                                db.commit(commitErr => {
                                     if (commitErr) console.error("Error committing after no user update/create:", commitErr);
                                     res.json({ success: true, warning: true, message: message }); // Éxito con advertencia
                                });
                                return; // Salir de este callback
                           }

                           // Intentar INSERT (crear usuario)
                           const sqlInsertUser = 'INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)';
                           const valuesInsertUser = [newUsernameTrimmed, password, 'colaborador', true];

                           console.log('Attempting to insert user (direct create) with values:', [valuesInsertUser[0], '[PASSWORD_HASHED]', valuesInsertUser[2], valuesInsertUser[3]]);
                           db.query(sqlInsertUser, valuesInsertUser, (insertErr, insertResult) => {
                               if (insertErr) {
                                   console.error(`Error creating user account '${newUsernameTrimmed}' (direct create):`, insertErr);
                                   if (insertErr.code === 'ER_DUP_ENTRY') {
                                        message = `Colaborador actualizado, pero el nombre de usuario '${newUsernameTrimmed}' ya existe en el sistema de usuarios. No se pudo crear/asociar una cuenta de usuario.`;
                                   } else {
                                        message = `Colaborador actualizado, pero hubo un error al crear la cuenta de usuario asociada '${newUsernameTrimmed}'.`;
                                   }
                                    // Hacemos commit de la actualización del colaborador
                                   db.commit(commitErr => {
                                        if (commitErr) console.error("Error committing after user direct insert error:", commitErr);
                                        res.json({ success: true, warning: true, message: message, errorDetails: insertErr.message }); // Éxito con advertencia
                                   });
                                   return; // Salir de este callback
                               }

                               console.log(`New user account '${newUsernameTrimmed}' created successfully.`);
                               message = `Colaborador actualizado. Se creó una nueva cuenta de usuario asociada ('${newUsernameTrimmed}').`;
                               // Confirmar la transacción completa (colaborador + usuario creado)
                               db.commit(commitErr => {
                                    if (commitErr) console.error("Error committing after user direct insert success:", commitErr);
                                    res.json({ success: true, message: message }); // Éxito
                               });
                           });
                      }


                 } else {
                      // No hubo cambio de username ni se proporcionó contraseña nueva
                      // Solo se actualizó el colaborador (commit ya se hizo en el callback de sqlUpdateColab)
                      console.log('No user account changes needed.');
                      res.json({ success: true, message: 'Colaborador actualizado exitosamente (datos de usuario sin cambios).' });
                 }
             });
         });
    });
});

// DELETE /api/colaboradores/:id - Eliminar empleado Y usuario asociado
app.delete('/api/colaboradores/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params; // id_empleado a eliminar

    if (!id) {
        return res.status(400).json({ success: false, message: 'Falta el ID del colaborador en la ruta.' });
    }

    // Iniciar Transacción
    db.beginTransaction(err => {
        if (err) {
            console.error("Error iniciando transacción para eliminar:", err);
            return res.status(500).json({ success: false, message: 'Error interno al iniciar la operación de eliminación.', error: err.message });
        }

        // 1. Obtener el usuario_empleado asociado antes de eliminar al colaborador
        const sqlGetUsername = 'SELECT usuario_empleado FROM colaboradores WHERE id_empleado = ?';
        db.query(sqlGetUsername, [id], (err, results) => {
            if (err) {
                 console.error("Error DB get username before delete:", err); // LOG
                 return db.rollback(() => {
                     res.status(500).json({ success: false, message: 'Error interno consultando datos del colaborador para eliminar.', error: err.message });
                 });
            }
            if (results.length === 0) {
                return db.rollback(() => {
                    res.status(404).json({ success: false, message: 'Colaborador no encontrado para eliminar.' });
                });
            }
            const usernameToDelete = results[0].usuario_empleado;
            const usernameToDeleteTrimmed = usernameToDelete ? usernameToDelete.trim() : '';
            console.log(`Deleting colaborador ID ${id} and associated user '${usernameToDeleteTrimmed}'`); // LOG

            // 2. Eliminar el registro de la tabla 'colaboradores'
            const sqlDeleteColaborador = 'DELETE FROM colaboradores WHERE id_empleado = ?';
            db.query(sqlDeleteColaborador, [id], (err, resultColaborador) => {
                if (err) {
                    console.error("Error DB delete colaborador:", err); // LOG
                    return db.rollback(() => { // Deshacer transacción
                         if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                             // Error de clave foránea, el colaborador está referenciado en otra tabla
                             return res.status(400).json({ success: false, message: 'No se puede eliminar el colaborador, tiene registros asociados en otras tablas (ej: historial, asignaciones).' });
                         }
                         res.status(500).json({ success: false, message: 'Error DB al eliminar colaborador.', error: err.message });
                    });
                }

                if (resultColaborador.affectedRows === 0) {
                    // Esto no debería pasar si la consulta SELECT previa encontró el ID, pero como seguridad
                     console.warn(`Colaborador con ID ${id} encontrado pero no eliminado (affectedRows 0).`); // LOG
                     return db.rollback(() => {
                         res.status(404).json({ success: false, message: 'Colaborador no encontrado durante la fase de eliminación.' });
                     });
                }

                console.log(`Colaborador with ID ${id} deleted. Affected rows: ${resultColaborador.affectedRows}`);

                // 3. Eliminar el registro de la tabla 'USUARIOS' usando el username obtenido
                // Eliminamos solo si el rol es 'colaborador' para no borrar accidentalmente cuentas de admin/otros
                const sqlDeleteUsuario = 'DELETE FROM USUARIOS WHERE usuario = ? AND rol = \'colaborador\'';
                db.query(sqlDeleteUsuario, [usernameToDeleteTrimmed], (err, resultUsuario) => {
                    if (err) {
                        console.error(`Error DB delete usuario asociado '${usernameToDeleteTrimmed}':`, err); // LOG
                         // No hacemos rollback automático aquí para mantener la eliminación del colaborador
                        // pero informamos del error con el usuario. Podrías decidir hacer rollback completo si prefieres consistencia total.
                        // Para simplicidad, loggeamos y respondemos el error principal.
                        const message = `Colaborador eliminado exitosamente, pero hubo un error al eliminar la cuenta de usuario asociada '${usernameToDeleteTrimmed}'. Es posible que deba eliminarla manualmente.`;
                        // Confirmar la transacción parcial (solo colaborador eliminado)
                        db.commit(commitErr => {
                            if (commitErr) console.error("Error confirmando transacción parcial después de error en usuario:", commitErr);
                             res.json({ success: true, warning: true, message: message, errorDetails: err.message }); // Éxito con advertencia
                        });
                        return; // Salir de este callback
                    }

                     if (resultUsuario.affectedRows === 0) {
                         console.warn(`Usuario asociado '${usernameToDeleteTrimmed}' con rol 'colaborador' no encontrado en tabla 'USUARIOS' para eliminar.`); // LOG
                         const message = `Colaborador eliminado exitosamente, pero el usuario asociado ('${usernameToDeleteTrimmed}') (con rol 'colaborador') no fue encontrado en el sistema.`;
                         // Confirmar transacción parcial (solo colaborador eliminado)
                         db.commit(commitErr => {
                             if (commitErr) console.error("Error confirmando transacción parcial después de usuario no encontrado:", commitErr);
                             res.json({ success: true, warning: true, message: message }); // Éxito con advertencia
                         });
                         return; // Salir de este callback
                     }

                    console.log(`User account for '${usernameToDeleteTrimmed}' deleted. Affected rows: ${resultUsuario.affectedRows}`);
                    // Si ambos OK (o usuario no encontrado pero colaborador sí), confirmar transacción
                    db.commit(commitErr => {
                        if (commitErr) {
                            console.error("Error confirmando transacción al eliminar colaborador y usuario:", commitErr); // LOG
                            return db.rollback(() => { // Intentar deshacer si falla el commit
                                res.status(500).json({ success: false, message: 'Error interno al finalizar la operación de eliminación (falló el commit).', error: commitErr.message });
                            });
                        }
                        // Éxito completo!
                        res.json({ success: true, message: 'Colaborador y usuario asociado eliminados exitosamente.' });
                    });
                });
            });
        });
    });
});


// --- API CRUD para Tipos de Contrato (Tabla contratos) ---
// Protegido por checkAdministrativoOrAdmin (o quizás solo Admin, dependiendo del diseño)
// Usaremos checkAdministrativoOrAdmin por ahora.
// GET /api/contratos - Listar todos los tipos de contrato
app.get('/api/contratos', checkAdministrativoOrAdmin, (req, res) => {
    const sql = 'SELECT * FROM contratos ORDER BY nombre_contrato ASC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error DB get all contratos:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al listar tipos de contrato.' });
        }
         res.json({ success: true, data: results });
    });
});

// GET /api/contratos/:id - Obtener un tipo de contrato por su ID
app.get('/api/contratos/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM contratos WHERE id_contrato = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error DB get contrato by id:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al obtener tipo de contrato.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado.' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// POST /api/contratos - Crear un nuevo tipo de contrato
app.post('/api/contratos', checkAdministrativoOrAdmin, (req, res) => {
    const { nombre_contrato, descripcion } = req.body;

    if (!nombre_contrato || nombre_contrato.trim() === '') {
        return res.status(400).json({ success: false, message: 'El nombre del contrato es obligatorio.' });
    }

    const sql = 'INSERT INTO contratos (nombre_contrato, descripcion) VALUES (?, ?)';
    const values = [nombre_contrato.trim(), descripcion ? descripcion.trim() : null];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error DB creating contrato:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(400).json({ success: false, message: 'Ya existe un tipo de contrato con este nombre.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al crear tipo de contrato.' });
        }
        res.status(201).json({ success: true, message: 'Tipo de contrato creado exitosamente.', data: { id_contrato: result.insertId, nombre_contrato, descripcion } });
    });
});

// PUT /api/contratos/:id - Actualizar un tipo de contrato
app.put('/api/contratos/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const { nombre_contrato, descripcion } = req.body;

    if (!nombre_contrato || nombre_contrato.trim() === '') {
        return res.status(400).json({ success: false, message: 'El nombre del contrato es obligatorio.' });
    }

    const sql = 'UPDATE contratos SET nombre_contrato = ?, descripcion = ? WHERE id_contrato = ?';
    const values = [nombre_contrato.trim(), descripcion ? descripcion.trim() : null, id];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error DB updating contrato:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(400).json({ success: false, message: 'Ya existe otro tipo de contrato con este nombre.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar tipo de contrato.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado para actualizar.' });
        }
        res.json({ success: true, message: 'Tipo de contrato actualizado exitosamente.' });
    });
});

// DELETE /api/contratos/:id - Eliminar un tipo de contrato
app.delete('/api/contratos/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM contratos WHERE id_contrato = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Error DB deleting contrato:", err);
            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                 return res.status(400).json({ success: false, message: 'No se puede eliminar el tipo de contrato, hay colaboradores asociados a él.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar tipo de contrato.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado para eliminar.' });
        }
        res.json({ success: true, message: 'Tipo de contrato eliminado exitosamente.' });
    });
});


// --- NUEVA API para datos del Colaborador Logueado (para colaborador.html) ---
// AGREGADO: Esta es la ruta API que usa la página colaborador.html
// Protegida por checkAuthenticated.
app.get('/api/colaborador/data', checkAuthenticated, (req, res) => {
    const loggedInUsername = req.session.user.usuario; // Obtener el usuario logueado de la sesión

    // 1. Encontrar el id_empleado asociado a este nombre de usuario
    const findEmpleadoIdSql = 'SELECT id_empleado FROM colaboradores WHERE usuario_empleado = ?';
    db.query(findEmpleadoIdSql, [loggedInUsername], (err, results) => {
        if (err) {
            console.error("Error DB finding id_empleado for logged in user:", err);
            return res.status(500).json({ success: false, message: 'Error interno al obtener ID de empleado.' });
        }

        if (results.length === 0) {
            console.error(`Inconsistencia de datos: Usuario logueado '${loggedInUsername}' con rol '${req.session.user.rol}' no tiene colaborador asociado.`);
            return res.status(404).json({ success: false, message: 'No se encontró información de colaborador asociada a su cuenta de usuario. Contacte al administrador.' });
        }

        const empleadoId = results[0].id_empleado; // Obtener el ID del empleado

        // 2. Obtener datos personales del colaborador
        const getPersonalInfoSql = 'SELECT id_empleado, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario_empleado, sexo, edad, id_contrato, puesto, estado_civil, fecha_nacimiento, ciudad_nacimiento, departamento, email, email_interno, telefono, direccion, status FROM colaboradores WHERE id_empleado = ?';
        db.query(getPersonalInfoSql, [empleadoId], (err, personalInfoResults) => {
            if (err) {
                console.error("Error DB getting personal info for id_empleado:", err);
                return res.status(500).json({ success: false, message: 'Error interno al obtener datos personales del colaborador.' });
            }

            if (personalInfoResults.length === 0) {
                 console.error(`Inconsistencia de datos: id_empleado ${empleadoId} encontrado en colaboradores por username, pero no al buscar por id.`);
                return res.status(404).json({ success: false, message: 'No se encontró información detallada del colaborador.' });
            }

             const personalInfo = personalInfoResults[0];
             // Formatear fecha_nacimiento a AAAA-MM-DD si existe
              if (personalInfo.fecha_nacimiento) {
                 try {
                      const date = new Date(personalInfo.fecha_nacimiento);
                       if (!isNaN(date.getTime())) {
                            const year = date.getFullYear();
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const day = date.getDate().toString().padStart(2, '0');
                            personalInfo.fecha_nacimiento = `${year}-${month}-${day}`;
                       } else {
                            personalInfo.fecha_nacimiento = null;
                       }
                 } catch (e) {
                      console.error("Error formateando fecha_nacimiento en API:", e);
                      personalInfo.fecha_nacimiento = null;
                 }
              }


            // 3. Obtener historial de pagos del colaborador
            // Selecciona las columnas incluyendo igss_descuento e isr_descuento (si existen en tu tabla)
            const getPaymentsSql = 'SELECT id_nomina, fecha_inicio, fecha_fin, tipo_pago, sueldo_base, horas_extra, bonificaciones, descuentos, total_pagado FROM nominas WHERE id_empleado = ? ORDER BY fecha_inicio ASC'; // <-- Asegúrate de seleccionar igss_descuento e isr_descuento aquí
            db.query(getPaymentsSql, [empleadoId], (err, paymentsResults) => {
                if (err) {
                    console.error("Error DB getting payments for id_empleado:", err);
                    return res.status(500).json({ success: false, message: 'Error interno al obtener historial de pagos.' });
                }

                 // Formatear fechas de pagos a AAAA-MM-DD si existen
                  const payments = paymentsResults.map(payment => {
                      const formattedPayment = { ...payment };
                      if (formattedPayment.fecha_inicio) {
                           try {
                                const date = new Date(formattedPayment.fecha_inicio);
                                 if (!isNaN(date.getTime())) {
                                      const year = date.getFullYear();
                                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                      const day = date.getDate().toString().padStart(2, '0');
                                      formattedPayment.fecha_inicio = `${year}-${month}-${day}`;
                                 } else {
                                      formattedPayment.fecha_inicio = null;
                                 }
                           } catch (e) {
                                console.error("Error formateando fecha_inicio pago:", e);
                                formattedPayment.fecha_inicio = null;
                           }
                      }
                       if (formattedPayment.fecha_fin) {
                           try {
                                const date = new Date(formattedPayment.fecha_fin);
                                 if (!isNaN(date.getTime())) {
                                      const year = date.getFullYear();
                                      const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                      const day = date.getDate().toString().padStart(2, '0');
                                      formattedPayment.fecha_fin = `${year}-${month}-${day}`;
                                 } else {
                                      formattedPayment.fecha_fin = null;
                                 }
                           } catch (e) {
                                console.error("Error formateando fecha_fin pago:", e);
                                formattedPayment.fecha_fin = null;
                           }
                      }
                      return formattedPayment;
                  });


                // 4. Enviar todos los datos al frontend como un solo objeto JSON
                // Incluimos también la info del usuario logueado para el header
                res.json({
                    success: true,
                    user: req.session.user, // <-- Enviamos la info del usuario logueado
                    personalInfo: personalInfo,
                    payments: payments
                });
            });
        });
    });
});


// --- API CRUD para Tipos de Contrato (Tabla contratos) ---
// Protegido por checkAdministrativoOrAdmin (o quizás solo Admin, dependiendo del diseño)
// Usaremos checkAdministrativoOrAdmin por ahora.
// GET /api/contratos - Listar todos los tipos de contrato
app.get('/api/contratos', checkAdministrativoOrAdmin, (req, res) => {
    const sql = 'SELECT * FROM contratos ORDER BY nombre_contrato ASC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error DB get all contratos:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al listar tipos de contrato.' });
        }
         res.json({ success: true, data: results });
    });
});

// GET /api/contratos/:id - Obtener un tipo de contrato por su ID
app.get('/api/contratos/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM contratos WHERE id_contrato = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error DB get contrato by id:", err);
            return res.status(500).json({ success: false, message: 'Error interno del servidor al obtener tipo de contrato.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado.' });
        }
        res.json({ success: true, data: results[0] });
    });
});

// POST /api/contratos - Crear un nuevo tipo de contrato
app.post('/api/contratos', checkAdministrativoOrAdmin, (req, res) => {
    const { nombre_contrato, descripcion } = req.body;

    if (!nombre_contrato || nombre_contrato.trim() === '') {
        return res.status(400).json({ success: false, message: 'El nombre del contrato es obligatorio.' });
    }

    const sql = 'INSERT INTO contratos (nombre_contrato, descripcion) VALUES (?, ?)';
    const values = [nombre_contrato.trim(), descripcion ? descripcion.trim() : null];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error DB creating contrato:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(400).json({ success: false, message: 'Ya existe un tipo de contrato con este nombre.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al crear tipo de contrato.' });
        }
        res.status(201).json({ success: true, message: 'Tipo de contrato creado exitosamente.', data: { id_contrato: result.insertId, nombre_contrato, descripcion } });
    });
});

// PUT /api/contratos/:id - Actualizar un tipo de contrato
app.put('/api/contratos/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;
    const { nombre_contrato, descripcion } = req.body;

    if (!nombre_contrato || nombre_contrato.trim() === '') {
        return res.status(400).json({ success: false, message: 'El nombre del contrato es obligatorio.' });
    }

    const sql = 'UPDATE contratos SET nombre_contrato = ?, descripcion = ? WHERE id_contrato = ?';
    const values = [nombre_contrato.trim(), descripcion ? descripcion.trim() : null, id];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Error DB updating contrato:", err);
            if (err.code === 'ER_DUP_ENTRY') {
                 return res.status(400).json({ success: false, message: 'Ya existe otro tipo de contrato con este nombre.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al actualizar tipo de contrato.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado para actualizar.' });
        }
        res.json({ success: true, message: 'Tipo de contrato actualizado exitosamente.' });
    });
});

// DELETE /api/contratos/:id - Eliminar un tipo de contrato
app.delete('/api/contratos/:id', checkAdministrativoOrAdmin, (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM contratos WHERE id_contrato = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Error DB deleting contrato:", err);
            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                 return res.status(400).json({ success: false, message: 'No se puede eliminar el tipo de contrato, hay colaboradores asociados a él.' });
            }
            return res.status(500).json({ success: false, message: 'Error interno del servidor al eliminar tipo de contrato.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Tipo de contrato no encontrado para eliminar.' });
        }
        res.json({ success: true, message: 'Tipo de contrato eliminado exitosamente.' });
    });
});


// --- Rutas de Logout ---
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error al destruir sesión:", err);
            // Aunque haya error al destruir, redirigir al login es lo esperado
            return res.redirect('/?error=Error+al+cerrar+sesión');
        }
        // Limpiar cookie de sesión (opcional, express-session suele encargarse)
        res.clearCookie('connect.sid'); // El nombre por defecto de la cookie de session
        res.redirect('/?message=Sesión+cerrada+correctamente'); // Redirigir al login
    });
});

// --- Manejo de 404 (Rutas no encontradas) ---
app.use((req, res, next) => {
    res.status(404).send('<!DOCTYPE html><html><head><title>404 - No Encontrado</title></head><body><h1>404 - Página No Encontrada</h1><p>La ruta solicitada no existe.</p><p><a href="/">Volver al inicio</a></p></body></html>');
});

// --- Manejo de Errores Generales ---
// Este middleware captura errores no manejados en las rutas
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack); // Log completo del stack trace
    res.status(500).send('<!DOCTYPE html><html><head><title>500 - Error del Servidor</title></head><body><h1>500 - Error Interno del Servidor</h1><p>Ha ocurrido un error inesperado.</p><p><a href="/">Volver al inicio</a></p></body></html>');
});

// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});