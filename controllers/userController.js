// controllers/userController.js
const db = require('../config/db');

// GET /api/users - Listar todos los usuarios
const getAllUsers = (req, res) => {
    db.query('SELECT id, usuario, rol, activo, fecha_creacion FROM USUARIOS ORDER BY usuario', (err, results) => { // [cite: 51]
        if (err) {
            console.error("Error DB get users:", err); // [cite: 52]
            return res.status(500).json({ success: false, message: 'Error DB al obtener usuarios.' }); // [cite: 52]
        }
        res.json({ success: true, data: results }); // [cite: 52]
    });
};

// GET /api/users/:id - Obtener un usuario
const getUserById = (req, res) => {
    db.query('SELECT id, usuario, rol, activo FROM USUARIOS WHERE id = ?', [req.params.id], (err, results) => { // [cite: 53]
        if (err) { console.error("Error DB get user by id:", err); return res.status(500).json({ success: false, message: 'Error DB.' }); } // [cite: 53]
        if (results.length === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); } // [cite: 53]
        res.json({ success: true, data: results[0] }); // [cite: 53]
    });
};

// POST /api/users - Crear usuario
const createUser = (req, res) => {
    const { usuario, password, rol, activo = true } = req.body; // [cite: 54]
    const activoBool = ['true', '1', 1, true].includes(String(activo).toLowerCase()); // [cite: 54]
    if (!usuario || !password || !rol) { return res.status(400).json({ success: false, message: 'Usuario, contraseña y rol son requeridos.' }); } // [cite: 55]

    const rolesPermitidos = ['admin', 'administrativo', 'colaborador', 'reportes', 'productividad', 'recursos', 'nominas']; // [cite: 55]
    if (!rolesPermitidos.includes(rol)) { // [cite: 55]
        return res.status(400).json({ success: false, message: `Rol '${rol}' no es válido.` }); // [cite: 55]
    }

    db.query('SELECT id FROM USUARIOS WHERE usuario = ?', [usuario], (err, results) => { // Check duplicado [cite: 55]
        if (err) { console.error("Error DB check user exists:", err); return res.status(500).json({ success: false, message: 'Error DB check.' }); } // [cite: 56]
        if (results.length > 0) { return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe.' }); } // [cite: 57]

        // Insertar nuevo usuario
        db.query('INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)', // [cite: 57]
            [usuario, password, rol, activoBool], (err, result) => { // [cite: 58]
                if (err) {
                    console.error("Error DB create user:", err); // [cite: 58]
                    if (err.code === 'ER_DUP_ENTRY') { // Doble check por si acaso [cite: 58]
                        return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe.' }); // [cite: 59]
                    }
                    return res.status(500).json({ success: false, message: 'Error DB al crear usuario.' }); // [cite: 59]
                }
                res.status(201).json({ success: true, message: 'Usuario creado exitosamente.', data: { id: result.insertId, usuario, rol, activo: activoBool } }); // [cite: 59]
            }
        );
    });
};

// PUT /api/users/:id - Actualizar usuario
const updateUser = (req, res) => {
    const { usuario, password, rol, activo } = req.body; // [cite: 60]
    const { id } = req.params; // [cite: 60]

    if (!usuario || !rol || activo === undefined || activo === null) { // [cite: 61]
        return res.status(400).json({ success: false, message: 'Usuario, rol y estado activo son requeridos.' }); // [cite: 61]
    }
    const activoBool = ['true', '1', 1, true].includes(String(activo).toLowerCase()); // [cite: 61]

    const rolesPermitidos = ['admin', 'administrativo', 'colaborador', 'reportes', 'productividad', 'recursos', 'nominas']; // [cite: 61]
    if (!rolesPermitidos.includes(rol)) { // [cite: 61]
        return res.status(400).json({ success: false, message: `Rol '${rol}' no es válido.` }); // [cite: 61]
    }

    // Prevenir que el admin se desactive a sí mismo o cambie su propio rol
    if (req.session.user && req.session.user.id == id) { // [cite: 62]
        if (rol !== 'admin') { // [cite: 62]
            return res.status(400).json({ success: false, message: 'No puedes cambiar tu propio rol de administrador.' }); // [cite: 63]
        }
        if (!activoBool) { // [cite: 63]
            return res.status(400).json({ success: false, message: 'No puedes desactivar tu propia cuenta de administrador.' }); // [cite: 64]
        }
    }

    let query, params;
    if (password && password.trim() !== '') { // Actualizar contraseña si se provee una no vacía [cite: 65]
        query = 'UPDATE USUARIOS SET usuario = ?, pass = SHA2(?, 256), rol = ?, activo = ? WHERE id = ?'; // [cite: 66]
        params = [usuario, password, rol, activoBool, id]; // [cite: 67]
    } else { // No actualizar contraseña [cite: 67]
        query = 'UPDATE USUARIOS SET usuario = ?, rol = ?, activo = ? WHERE id = ?'; // [cite: 68]
        params = [usuario, rol, activoBool, id]; // [cite: 69]
    }

    db.query(query, params, (err, result) => { // [cite: 69]
        if (err) {
            console.error("Error DB update user:", err); // [cite: 70]
            if (err.code === 'ER_DUP_ENTRY') { return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso por otra cuenta.' }); } // [cite: 70]
            return res.status(500).json({ success: false, message: 'Error DB al actualizar usuario.' }); // [cite: 70]
        }
        if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); } // [cite: 70]
        res.json({ success: true, message: 'Usuario actualizado exitosamente.' }); // [cite: 70]
    });
};

// DELETE /api/users/:id - Eliminar usuario
const deleteUser = (req, res) => {
    const { id } = req.params; // [cite: 71]
    // Prevenir que el admin se elimine a sí mismo
    if (req.session.user && req.session.user.id == id) { // [cite: 71]
        return res.status(400).json({ success: false, message: 'No puedes eliminar tu propia cuenta de administrador.' }); // [cite: 71]
    }
    db.query('DELETE FROM USUARIOS WHERE id = ?', [id], (err, result) => { // [cite: 72]
        if (err) {
            console.error("Error DB delete user:", err); // [cite: 72]
            if (err.code === 'ER_ROW_IS_REFERENCED_2') { // [cite: 72]
                return res.status(400).json({ success: false, message: 'No se puede eliminar, el usuario tiene registros asociados en otras tablas.' }); // [cite: 73]
            }
            return res.status(500).json({ success: false, message: 'Error DB al eliminar usuario.' }); // [cite: 73]
        }
        if (result.affectedRows === 0) { return res.status(404).json({ success: false, message: 'Usuario no encontrado.' }); } // [cite: 74]
        res.json({ success: true, message: 'Usuario eliminado exitosamente.' }); // [cite: 74]
    });
};


module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};