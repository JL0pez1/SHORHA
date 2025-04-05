require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de conexión a MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Umg123',
    database: process.env.DB_NAME || 'SORHA'
});

// Conectar a MySQL
db.connect(err => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
    } else {
        console.log('Conectado a MySQL');
    }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración de sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'tu_secreto_seguro',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Middleware para verificar admin
const checkAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.rol !== 'admin') {
        return res.status(403).json({ success: false, message: 'Acceso no autorizado' });
    }
    next();
};

// Ruta principal
app.get('/', (req, res) => {
    if (req.session.user) return redirectByRole(req.session.user.rol, res);
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Login
app.post('/login', (req, res) => {
    console.log(req.body, 'el req');

    const { usuario, pass } = req.body;
    console.log(usuario, 'usuario');
    console.log(pass, 'password')
    if (!usuario || !pass) {
        return res.redirect('/?error=Usuario+y+contraseña+son+requeridos');
    }

    db.query(
        'SELECT * FROM USUARIOS WHERE usuario = ? AND pass = SHA2(?, 256) AND activo = TRUE',
        [usuario, pass],
        (err, results) => {
            if (err) {
                console.error('Error en la consulta:', err);
                return res.redirect('/?error=Error+interno+del+servidor');
            }
            if (results.length > 0) {
                req.session.user = results[0];
                redirectByRole(results[0].rol, res);
            } else {
                res.redirect('/?error=Usuario+o+contraseña+incorrectos');
            }
        }
    );
});

// Redirección por rol
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
    return res.redirect(routes[rol] || '/');
}

// Rutas protegidas
const protectedRoutes = {
    '/reportes': 'reportes',
    '/productividad': 'productividad',
    '/recursos': 'recursos',
    '/administrativo': 'administrativo',
    '/colaborador': 'colaborador',
    '/admin': 'admin',
    '/nominas': 'nominas'
};

Object.entries(protectedRoutes).forEach(([route, role]) => {
    app.get(route, (req, res) => {
        if (!req.session.user || req.session.user.rol !== role) {
            return res.redirect('/');
        }
        res.sendFile(path.join(__dirname, 'views', `${role}.html`));
    });
});

// API CRUD para usuarios
app.get('/api/users', checkAdmin, (req, res) => {
    console.log(req.body)
    db.query('SELECT id, usuario, rol, activo FROM USUARIOS', (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        res.json({ success: true, data: results });
    });
});


app.get('/api/users/:id', checkAdmin, (req, res) => {
    db.query('SELECT id, usuario, rol, activo FROM USUARIOS WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        if (results.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        res.json({ success: true, data: results[0] });
    });
});

app.post('/api/users', checkAdmin, (req, res) => {
    const { usuario, password, rol, activo = true } = req.body;
    
    if (!usuario || !password || !rol) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
    }

    // Verificar si el usuario ya existe
    db.query('SELECT id FROM USUARIOS WHERE usuario = ?', [usuario], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error en la base de datos' });
        if (results.length > 0) return res.status(400).json({ success: false, message: 'El usuario ya existe' });

        // Crear nuevo usuario
        db.query(
            'INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)',
            [usuario, password, rol, activo],
            (err, results) => {
                if (err) return res.status(500).json({ success: false, message: 'Error al crear usuario' });
                res.json({ 
                    success: true, 
                    message: 'Usuario creado exitosamente',
                    data: { id: results.insertId }
                });
            }
        );
    });
});

app.put('/api/users/:id', checkAdmin, (req, res) => {
    const { usuario, password, rol, activo } = req.body;
    const { id } = req.params;

    if (!usuario || !rol) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
    }

    let query, params;
    if (password) {
        query = 'UPDATE USUARIOS SET usuario = ?, pass = SHA2(?, 256), rol = ?, activo = ? WHERE id = ?';
        params = [usuario, password, rol, activo, id];
    } else {
        query = 'UPDATE USUARIOS SET usuario = ?, rol = ?, activo = ? WHERE id = ?';
        params = [usuario, rol, activo, id];
    }

    db.query(query, params, (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
        res.json({ success: true, message: 'Usuario actualizado correctamente' });
    });
});

app.delete('/api/users/:id', checkAdmin, (req, res) => {
    db.query('DELETE FROM USUARIOS WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
        res.json({ success: true, message: 'Usuario eliminado correctamente' });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error al cerrar sesión:', err);
        res.redirect('/');
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});