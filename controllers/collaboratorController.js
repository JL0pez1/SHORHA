// controllers/collaboratorController.js
const db = require('../config/db');

// Helper para formatear fecha
const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        // Importante: Añadir 'T00:00:00' o manejar UTC para evitar desfases de día
        // Si la fecha viene de MySQL como objeto Date, puede que ya esté en UTC
        // Una forma robusta es extraer año, mes, día del objeto Date
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() es 0-indexed
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else {
            // Intentar parsear como AAAA-MM-DD si es string
            if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
                return dateString;
            }
            console.warn(`Fecha inválida recibida: ${dateString}`);
            return null;
        }
    } catch (e) {
        console.error(`Error formateando fecha "${dateString}":`, e);
        return null;
    }
};


// GET /api/colaboradores - Listar todos
const getAllCollaborators = (req, res) => {
    const sql = 'SELECT * FROM colaboradores ORDER BY primer_apellido ASC, primer_nombre ASC'; // [cite: 85]
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error DB get all colaboradores:", err); // [cite: 85]
            return res.status(500).json({ success: false, message: 'Error interno del servidor al listar colaboradores.' }); // [cite: 85]
        }
        // Formatear fechas en los resultados antes de enviar
        const formattedResults = results.map(emp => ({
            ...emp,
            fecha_nacimiento: formatDate(emp.fecha_nacimiento)
        }));
        res.json({ success: true, data: formattedResults }); // [cite: 86]
    });
};

// GET /api/colaboradores/:id - Obtener uno
const getCollaboratorById = (req, res) => {
    const { id } = req.params; // [cite: 76]
    const sql = 'SELECT * FROM colaboradores WHERE id_empleado = ?'; // [cite: 77]
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error("Error DB get colaborador by id:", err); // [cite: 77]
            return res.status(500).json({ success: false, message: 'Error interno del servidor al obtener colaborador.' }); // [cite: 77]
        }
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado.' }); // [cite: 77]
        }
        const empleado = results[0]; // [cite: 78]
        empleado.fecha_nacimiento = formatDate(empleado.fecha_nacimiento); // Formatear fecha [cite: 81]
        res.json({ success: true, data: empleado }); // [cite: 84]
    });
};

// POST /api/colaboradores - Crear empleado y usuario
const createCollaborator = (req, res) => {
    const d = req.body; // [cite: 87]
    const { password } = req.body; // [cite: 87]
    console.log('Received POST body for colaborador:', d); // LOG para depuración [cite: 87]

    // --- Validación Backend ---
    if (!d.primer_nombre || d.primer_nombre.trim() === '' ||
        !d.primer_apellido || d.primer_apellido.trim() === '' ||
        !d.usuario_empleado || d.usuario_empleado.trim() === '' ||
        !d.status || d.status.trim() === '') // [cite: 88]
    {
        return res.status(400).json({ success: false, message: 'Primer Nombre, Primer Apellido, Usuario (Login) y Estado son obligatorios.' }); // [cite: 88]
    }
    if (!password || password.trim() === '') { // Requerir contraseña no vacía al crear [cite: 89]
        return res.status(400).json({ success: false, message: 'La contraseña es obligatoria y no puede estar vacía para crear el usuario asociado.' }); // [cite: 89]
    }
    const edadInt = d.edad ? parseInt(d.edad, 10) : null; // [cite: 90]
    if (d.edad && (isNaN(edadInt) || edadInt < 0)) { // Validar que sea número positivo si se ingresa [cite: 90]
        return res.status(400).json({ success: false, message: 'Edad inválida (debe ser un número positivo).' }); // [cite: 91]
    }
    // --- Fin Validación ---

    db.beginTransaction(err => { // [cite: 91]
        if (err) {
            console.error("Error iniciando transacción:", err); // [cite: 92]
            return res.status(500).json({ success: false, message: 'Error interno al iniciar la operación.', error: err.message }); // [cite: 92]
        }

        const sqlColaborador = `INSERT INTO colaboradores (id_empleado, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario_empleado, sexo, edad, id_contrato, puesto, estado_civil, fecha_nacimiento, ciudad_nacimiento, departamento, email, email_interno, telefono, direccion, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`; // [cite: 92]
        const valuesColaborador = [
            d.id_empleado || null, // [cite: 95]
            d.primer_nombre.trim(), d.segundo_nombre ? d.segundo_nombre.trim() : null, d.primer_apellido.trim(), d.segundo_apellido ? d.segundo_apellido.trim() : null, // [cite: 96]
            d.usuario_empleado.trim(), // [cite: 96]
            d.sexo || null, edadInt, d.id_contrato ? String(d.id_contrato).trim() : null, d.puesto ? d.puesto.trim() : null, // [cite: 97]
            d.estado_civil || null, formatDate(d.fecha_nacimiento) || null, d.ciudad_nacimiento ? d.ciudad_nacimiento.trim() : null, d.departamento ? d.departamento.trim() : null, // [cite: 98, 99] (Format date here)
            d.email ? d.email.trim() : null, d.email_interno ? d.email_interno.trim() : null, d.telefono ? d.telefono.trim() : null, d.direccion ? d.direccion.trim() : null, // [cite: 100, 101]
            d.status.trim() // [cite: 101]
        ];
        console.log('Inserting into colaboradores with values:', valuesColaborador); // [cite: 102]

        db.query(sqlColaborador, valuesColaborador, (err, resultColaborador) => { // [cite: 102]
            if (err) {
                console.error("Error insertando colaborador:", err); // [cite: 103]
                return db.rollback(() => { // [cite: 103]
                    let message = 'Error interno al crear colaborador.'; // [cite: 109]
                    if (err.code === 'ER_DUP_ENTRY') { // [cite: 103]
                         message = err.sqlMessage && err.sqlMessage.toLowerCase().includes('usuario_empleado')
                            ? 'El Usuario de Empleado ya existe para otro colaborador.' // [cite: 104]
                            : (err.sqlMessage && err.sqlMessage.toLowerCase().includes('for key')) // [cite: 105]
                                ? 'Error de clave foránea. Verifique el ID de contrato u otros datos relacionados.' // [cite: 105]
                                : (err.sqlMessage && err.sqlMessage.toLowerCase().includes('duplicate entry')) // [cite: 106]
                                    ? 'Error de duplicidad en la base de datos (posiblemente ID de empleado si es manual).' // [cite: 107]
                                    : 'Ya existe un registro con datos duplicados.'; // Fallback [cite: 107]
                        return res.status(400).json({ success: false, message: message, error: err.message }); // [cite: 108]
                    }
                    if (err.code === 'ER_NO_REFERENCED_ROW_2') { // [cite: 109]
                        message = 'ID de contrato inválido o no existe.'; // [cite: 109]
                        return res.status(400).json({ success: false, message: message, error: err.message }); // [cite: 109]
                    }
                    return res.status(500).json({ success: false, message: message, error: err.message }); // [cite: 110]
                });
            }

            const nuevoColaboradorId = (d.id_empleado !== null && d.id_empleado !== undefined && d.id_empleado !== '') ? d.id_empleado : resultColaborador.insertId; // [cite: 114]
            if (!nuevoColaboradorId) { // [cite: 115]
                console.error("Could not determine new colaborador ID after insert."); // [cite: 115]
                return db.rollback(() => { // [cite: 116]
                    res.status(500).json({ success: false, message: 'Error al obtener el ID del nuevo colaborador.', error: 'Could not determine new ID' }); // [cite: 116]
                });
            }
            console.log('Colaborador inserted successfully with ID:', nuevoColaboradorId); // [cite: 118]

            // 2. Insertar en 'usuarios'
            const sqlUsuario = 'INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)'; // [cite: 118]
            const valuesUsuario = [d.usuario_empleado.trim(), password, 'colaborador', true]; // [cite: 119]
            console.log('Attempting to insert user with values:', [valuesUsuario[0], '[PASSWORD_HASHED]', valuesUsuario[2], valuesUsuario[3]]); // [cite: 120]

            db.query(sqlUsuario, valuesUsuario, (err, resultUsuario) => { // [cite: 120]
                if (err) {
                    console.error("Error insertando usuario:", err); // [cite: 121]
                    return db.rollback(() => { // [cite: 121]
                        let message = 'Error interno al crear el usuario asociado. No se creó el colaborador.'; // [cite: 123]
                        if (err.code === 'ER_DUP_ENTRY') { // [cite: 121]
                            message = 'El nombre de usuario (Login) ya está registrado en el sistema de usuarios. No se creó el colaborador.'; // [cite: 122]
                            return res.status(400).json({ success: false, message: message, error: err.message }); // [cite: 122]
                        }
                        return res.status(500).json({ success: false, message: message, error: err.message }); // [cite: 123]
                    });
                }
                console.log('User created successfully with ID:', resultUsuario.insertId); // [cite: 125]

                db.commit(err => { // [cite: 125]
                    if (err) {
                        console.error("Error confirmando transacción:", err); // [cite: 126]
                        return db.rollback(() => { // [cite: 126]
                            res.status(500).json({ success: false, message: 'Error interno al finalizar la operación (falló el commit).', error: err.message }); // [cite: 126]
                        });
                    }
                    res.status(201).json({ success: true, message: 'Colaborador y usuario creados exitosamente.', idColaborador: nuevoColaboradorId }); // [cite: 127]
                });
            });
        });
    });
};

// PUT /api/colaboradores/:id - Actualizar empleado y usuario
const updateCollaborator = (req, res) => {
    const { id } = req.params; // id_empleado a actualizar [cite: 128]
    const d = req.body; // Nuevos datos del colaborador [cite: 128]
    const { password } = req.body; // Nueva contraseña (opcional) [cite: 128]
    console.log('Received PUT body for colaborador:', d); // LOG [cite: 128]
    console.log('Updating colaborador ID:', id); // LOG [cite: 128]

    // --- Validación Backend ---
    if (!id) { // [cite: 129]
      return res.status(400).json({ success: false, message: 'Falta el ID del colaborador en la ruta.' }); // [cite: 129]
    }
    if (!d.primer_nombre || d.primer_nombre.trim() === '' ||
        !d.primer_apellido || d.primer_apellido.trim() === '' ||
        !d.usuario_empleado || d.usuario_empleado.trim() === '' ||
        !d.status || d.status.trim() === '') // [cite: 129]
    {
        return res.status(400).json({ success: false, message: 'Primer Nombre, Primer Apellido, Usuario (Login) y Estado son obligatorios.' }); // [cite: 130]
    }
    const edadInt = d.edad ? parseInt(d.edad, 10) : null; // [cite: 130]
    if (d.edad && (isNaN(edadInt) || edadInt < 0)) { // [cite: 131]
        return res.status(400).json({ success: false, message: 'Edad inválida (debe ser un número positivo).' }); // [cite: 132]
    }
    // --- Fin Validación ---

    // 1. Obtener el usuario_empleado *actual* antes de actualizar
    const sqlGetUsername = 'SELECT usuario_empleado FROM colaboradores WHERE id_empleado = ?'; // [cite: 132]
    db.query(sqlGetUsername, [id], (err, results) => { // [cite: 133]
        if (err) {
            console.error("Error DB get old username:", err); // [cite: 133]
            return res.status(500).json({ success: false, message: 'Error interno consultando datos actuales del colaborador y usuario.', error: err.message }); // [cite: 133]
        }
        if (results.length === 0) { // [cite: 134]
            return res.status(404).json({ success: false, message: 'Colaborador no encontrado para actualizar.' }); // [cite: 134]
        }
        const oldUsername = results[0].usuario_empleado; // [cite: 135]
        const oldUsernameTrimmed = oldUsername ? oldUsername.trim() : ''; // [cite: 135]
        const newUsernameTrimmed = d.usuario_empleado ? d.usuario_empleado.trim() : ''; // [cite: 135]
        console.log(`Old username for ID ${id}: '${oldUsernameTrimmed}'`); // LOG [cite: 135]

        db.beginTransaction(err => { // [cite: 135]
            if (err) {
                console.error("Error iniciando transacción para actualizar:", err); // [cite: 136]
                return res.status(500).json({ success: false, message: 'Error interno al iniciar la operación de actualización.', error: err.message }); // [cite: 136]
            }

            // 2. Actualizar la tabla 'colaboradores'
            const sqlUpdateColab = `UPDATE colaboradores SET primer_nombre=?, segundo_nombre=?, primer_apellido=?, segundo_apellido=?, usuario_empleado=?, sexo=?, edad=?, id_contrato=?, puesto=?, estado_civil=?, fecha_nacimiento=?, ciudad_nacimiento=?, departamento=?, email=?, email_interno=?, telefono=?, direccion=?, status=? WHERE id_empleado=?`; // [cite: 138]
            const valuesUpdateColab = [
                d.primer_nombre.trim(), d.segundo_nombre ? d.segundo_nombre.trim() : null, d.primer_apellido.trim(), d.segundo_apellido ? d.segundo_apellido.trim() : null, // [cite: 139]
                newUsernameTrimmed, // [cite: 139]
                d.sexo || null, edadInt, d.id_contrato ? String(d.id_contrato).trim() : null, d.puesto ? d.puesto.trim() : null, d.estado_civil || null, // [cite: 140, 141]
                formatDate(d.fecha_nacimiento) || null, d.ciudad_nacimiento ? d.ciudad_nacimiento.trim() : null, d.departamento ? d.departamento.trim() : null, d.email ? d.email.trim() : null, // [cite: 142, 143] (Format date)
                d.email_interno ? d.email_interno.trim() : null, d.telefono ? d.telefono.trim() : null, d.direccion ? d.direccion.trim() : null, d.status.trim(), // [cite: 144, 145]
                id // [cite: 146]
            ];
            console.log('Updating colaborador with values:', valuesUpdateColab); // LOG [cite: 146]

            db.query(sqlUpdateColab, valuesUpdateColab, (err, resultColab) => { // [cite: 146]
                if (err) {
                    console.error("Error actualizando colaborador:", err); // [cite: 147]
                    return db.rollback(() => { // [cite: 147]
                        let message = 'Error interno al actualizar datos del colaborador.'; // [cite: 151]
                        if (err.code === 'ER_DUP_ENTRY') { // [cite: 147]
                            message = err.sqlMessage && err.sqlMessage.toLowerCase().includes('usuario_empleado')
                                ? 'El nuevo Usuario de Empleado ya está en uso por otro colaborador.' // [cite: 148]
                                : 'Error de duplicidad al actualizar colaborador.'; // [cite: 148]
                            return res.status(400).json({ success: false, message: message, error: err.message }); // [cite: 149]
                        }
                        if (err.code === 'ER_NO_REFERENCED_ROW_2') { // [cite: 149]
                            message = 'ID de contrato inválido o no existe.'; // [cite: 150]
                            return res.status(400).json({ success: false, message: message, error: err.message }); // [cite: 150]
                        }
                        return res.status(500).json({ success: false, message: message, error: err.message }); // [cite: 151]
                    });
                }
                if (resultColab.affectedRows === 0) { // [cite: 151]
                    console.warn(`Colaborador con ID ${id} encontrado pero no actualizado (affectedRows 0).`); // [cite: 152]
                    return db.rollback(() => { // [cite: 154]
                        res.status(404).json({ success: false, message: 'Colaborador no encontrado o sin cambios para actualizar.' }); // [cite: 155]
                    });
                }
                console.log(`Colaborador with ID ${id} updated successfully. Affected rows: ${resultColab.affectedRows}`); // [cite: 156]

                // 3. Actualizar la tabla 'usuarios' (si cambió username o se proveyó nueva contraseña)
                let successMessage = 'Colaborador actualizado exitosamente'; // Mensaje base [cite: 156]
                let warningMessage = null; // Para mensajes de advertencia
                const usernameChanged = oldUsernameTrimmed !== newUsernameTrimmed; // [cite: 157]
                const passwordProvided = password && password.trim() !== ''; // [cite: 158]

                if (usernameChanged || passwordProvided) { // [cite: 158]
                    let sqlUpdateUser = null;
                    let valuesUpdateUser = [];
                    let attemptCreate = false; // Flag para saber si debemos intentar crear

                    if (oldUsernameTrimmed) { // Solo intentamos actualizar si había un nombre de usuario anterior [cite: 160]
                        if (usernameChanged && passwordProvided) { // [cite: 160]
                             console.log(`Attempting to update user '${oldUsernameTrimmed}' to '${newUsernameTrimmed}' and changing password.`); // [cite: 160]
                             sqlUpdateUser = `UPDATE USUARIOS SET usuario = ?, pass = SHA2(?, 256) WHERE usuario = ? AND rol = 'colaborador'`; // [cite: 163]
                             valuesUpdateUser = [newUsernameTrimmed, password, oldUsernameTrimmed]; // [cite: 163]
                        } else if (usernameChanged) { // [cite: 164]
                             console.log(`Attempting to update user username from '${oldUsernameTrimmed}' to '${newUsernameTrimmed}'.`); // [cite: 165]
                             sqlUpdateUser = `UPDATE USUARIOS SET usuario = ? WHERE usuario = ? AND rol = 'colaborador'`; // [cite: 166]
                             valuesUpdateUser = [newUsernameTrimmed, oldUsernameTrimmed]; // [cite: 167]
                        } else if (passwordProvided) { // [cite: 167]
                             console.log(`Attempting to change password for user '${oldUsernameTrimmed}'.`); // [cite: 168]
                             sqlUpdateUser = `UPDATE USUARIOS SET pass = SHA2(?, 256) WHERE usuario = ? AND rol = 'colaborador'`; // [cite: 170]
                             valuesUpdateUser = [password, oldUsernameTrimmed]; // [cite: 171]
                        }
                    } else {
                         console.log("No previous username found for this collaborator. Will attempt user creation directly if password provided."); // [cite: 174]
                         attemptCreate = passwordProvided; // Solo intentamos crear si no había username y se dio password
                    }

                    const executeUserUpdateOrCreate = (callback) => {
                        if (sqlUpdateUser) { // Intentar UPDATE primero si aplica
                            db.query(sqlUpdateUser, valuesUpdateUser, (err, resultUser) => { // [cite: 174]
                                if (err) { // Error al actualizar usuario [cite: 175]
                                    console.error(`Error updating user account (old: '${oldUsernameTrimmed}', new: '${newUsernameTrimmed}'):`, err); // [cite: 175]
                                    if (err.code === 'ER_DUP_ENTRY' && usernameChanged) { // [cite: 176]
                                        warningMessage = `Colaborador actualizado, pero el nuevo nombre de usuario '${newUsernameTrimmed}' ya existe. La cuenta de usuario asociada no pudo ser renombrada.`; // [cite: 177]
                                    } else {
                                        warningMessage = 'Colaborador actualizado, pero hubo un error al actualizar la cuenta de usuario asociada.'; // [cite: 182]
                                    }
                                    return callback(null); // Continuar para hacer commit con advertencia
                                }

                                if (resultUser.affectedRows === 0 && oldUsernameTrimmed) { // Usuario no encontrado para UPDATE, intentar CREAR si aplica [cite: 187]
                                     console.warn(`User account '${oldUsernameTrimmed}' with rol 'colaborador' not found for update. Attempting to CREATE instead.`); // [cite: 188]
                                     if (!passwordProvided) { // [cite: 191]
                                         console.warn("Cannot create user account: Password was not provided."); // [cite: 191]
                                         warningMessage = `Colaborador actualizado, pero la cuenta de usuario asociada ('${oldUsernameTrimmed}') no fue encontrada y no se proporcionó contraseña para crear una nueva.`; // [cite: 194]
                                         return callback(null); // Continuar para hacer commit con advertencia
                                     }
                                     attemptCreate = true; // Intentar crear ahora
                                     executeUserCreation(callback); // Llamar a la función de creación
                                } else if (resultUser.affectedRows > 0) { // Usuario actualizado correctamente [cite: 211]
                                     console.log(`User account for '${oldUsernameTrimmed}' updated successfully. Affected rows: ${resultUser.affectedRows}`); // [cite: 212]
                                     if (usernameChanged && passwordProvided) successMessage = 'Colaborador y usuario (nombre y contraseña) actualizados.'; // [cite: 212]
                                     else if (usernameChanged) successMessage = 'Colaborador y nombre de usuario actualizados.'; // [cite: 213]
                                     else if (passwordProvided) successMessage = 'Colaborador y contraseña de usuario actualizados.'; // [cite: 214]
                                     callback(null); // Todo OK, commit final
                                } else {
                                    // Caso raro: ni error ni affectedRows > 0 ni oldUsername para intentar crear
                                    callback(null); // Continuar con commit
                                }
                            });
                        } else if (attemptCreate) { // Intentar CREAR directamente
                            executeUserCreation(callback);
                        } else { // No hubo cambios de usuario ni contraseña
                            console.log('No user account changes needed.'); // [cite: 240]
                            successMessage = 'Colaborador actualizado exitosamente (datos de usuario sin cambios).'; // [cite: 241]
                            callback(null); // Todo OK, commit final
                        }
                    };

                    const executeUserCreation = (callback) => {
                         const sqlInsertUser = 'INSERT INTO USUARIOS (usuario, pass, rol, activo) VALUES (?, SHA2(?, 256), ?, ?)'; // [cite: 197]
                         const valuesInsertUser = [newUsernameTrimmed, password, 'colaborador', true]; // [cite: 198]
                         console.log('Attempting to insert user with values:', [valuesInsertUser[0], '[PASSWORD_HASHED]', valuesInsertUser[2], valuesInsertUser[3]]); // [cite: 199]
                         db.query(sqlInsertUser, valuesInsertUser, (insertErr, insertResult) => { // [cite: 199]
                             if (insertErr) { // Error al crear usuario [cite: 200]
                                 console.error(`Error creating user account '${newUsernameTrimmed}':`, insertErr); // [cite: 200]
                                 if (insertErr.code === 'ER_DUP_ENTRY') { // [cite: 201]
                                     warningMessage = `Colaborador actualizado, pero el nombre de usuario '${newUsernameTrimmed}' ya existe. No se pudo crear/asociar una cuenta de usuario.`; // [cite: 201]
                                 } else {
                                     warningMessage = `Colaborador actualizado, pero hubo un error al crear la cuenta de usuario asociada '${newUsernameTrimmed}'.`; // [cite: 202]
                                 }
                             } else { // Usuario creado [cite: 208]
                                 console.log(`New user account '${newUsernameTrimmed}' created successfully.`); // [cite: 208]
                                 successMessage = `Colaborador actualizado. Se creó una nueva cuenta de usuario asociada ('${newUsernameTrimmed}').`; // [cite: 208]
                             }
                             callback(null); // Continuar para hacer commit (con o sin advertencia)
                         });
                    };

                    // Ejecutar la lógica de actualización/creación de usuario
                    executeUserUpdateOrCreate((err) => {
                        if (err) { // Si hubo algún error irrecuperable en los callbacks (no debería pasar con el manejo actual)
                            return db.rollback(() => res.status(500).json({ success: false, message: 'Error inesperado procesando usuario asociado.' }));
                        }
                        // Siempre intentar hacer commit
                        db.commit(commitErr => { // [cite: 178, 183, 195, 204, 210, 216, 224, 232, 238]
                            if (commitErr) {
                                console.error("Error committing transaction:", commitErr); // [cite: 178, 184, 195, 204, 210, 216, 224, 232, 238]
                                // Rollback no es posible aquí si el commit falla, pero loggeamos
                                return res.status(500).json({ success: false, message: 'Error al finalizar la operación (falló el commit).', error: commitErr.message });
                            }
                            // Enviar respuesta final
                            if (warningMessage) {
                                res.json({ success: true, warning: true, message: warningMessage }); // [cite: 179, 185, 196, 205, 224, 233]
                            } else {
                                res.json({ success: true, message: successMessage }); // [cite: 209, 216, 238, 241]
                            }
                        });
                    });

                } else { // No hubo cambios de usuario ni contraseña
                     // El commit se hace implícitamente si no hubo error en la query del colaborador
                     db.commit(commitErr => { // Necesitamos commit aquí también
                         if (commitErr) {
                             console.error("Error committing transaction (no user changes):", commitErr);
                             return res.status(500).json({ success: false, message: 'Error al finalizar la operación (falló el commit).', error: commitErr.message });
                         }
                         console.log('No user account changes needed.'); // [cite: 240]
                         res.json({ success: true, message: 'Colaborador actualizado exitosamente (datos de usuario sin cambios).' }); // [cite: 241]
                     });
                 }
            }); // Fin query update colaborador
        }); // Fin beginTransaction
    }); // Fin query get username
};


// DELETE /api/colaboradores/:id - Eliminar empleado y usuario
const deleteCollaborator = (req, res) => {
    const { id } = req.params; // id_empleado a eliminar [cite: 243]
    if (!id) {
        return res.status(400).json({ success: false, message: 'Falta el ID del colaborador en la ruta.' }); // [cite: 243]
    }

    db.beginTransaction(err => { // [cite: 244]
        if (err) {
            console.error("Error iniciando transacción para eliminar:", err); // [cite: 244]
            return res.status(500).json({ success: false, message: 'Error interno al iniciar la operación de eliminación.', error: err.message }); // [cite: 244]
        }

        // 1. Obtener el usuario_empleado asociado antes de eliminar
        const sqlGetUsername = 'SELECT usuario_empleado FROM colaboradores WHERE id_empleado = ?'; // [cite: 245]
        db.query(sqlGetUsername, [id], (err, results) => { // [cite: 245]
            if (err) {
                console.error("Error DB get username before delete:", err); // [cite: 245]
                return db.rollback(() => { // [cite: 245]
                    res.status(500).json({ success: false, message: 'Error interno consultando datos del colaborador para eliminar.', error: err.message }); // [cite: 246]
                });
            }
            if (results.length === 0) { // [cite: 246]
                return db.rollback(() => { // [cite: 246]
                    res.status(404).json({ success: false, message: 'Colaborador no encontrado para eliminar.' }); // [cite: 247]
                });
            }
            const usernameToDelete = results[0].usuario_empleado; // [cite: 247]
            const usernameToDeleteTrimmed = usernameToDelete ? usernameToDelete.trim() : ''; // [cite: 248]
            console.log(`Deleting colaborador ID ${id} and associated user '${usernameToDeleteTrimmed}'`); // [cite: 249]

            // 2. Eliminar el registro de 'colaboradores'
            const sqlDeleteColaborador = 'DELETE FROM colaboradores WHERE id_empleado = ?'; // [cite: 249]
            db.query(sqlDeleteColaborador, [id], (err, resultColaborador) => { // [cite: 250]
                if (err) {
                    console.error("Error DB delete colaborador:", err); // [cite: 250]
                    return db.rollback(() => { // [cite: 251]
                        let message = 'Error DB al eliminar colaborador.'; // [cite: 252]
                        if (err.code === 'ER_ROW_IS_REFERENCED_2') { // [cite: 251]
                            message = 'No se puede eliminar el colaborador, tiene registros asociados en otras tablas (ej: historial, asignaciones).'; // [cite: 251]
                            return res.status(400).json({ success: false, message: message }); // [cite: 252]
                        }
                        res.status(500).json({ success: false, message: message, error: err.message }); // [cite: 252]
                    });
                }
                if (resultColaborador.affectedRows === 0) { // [cite: 253]
                    console.warn(`Colaborador con ID ${id} encontrado pero no eliminado (affectedRows 0).`); // [cite: 254]
                    return db.rollback(() => { // [cite: 254]
                        res.status(404).json({ success: false, message: 'Colaborador no encontrado durante la fase de eliminación.' }); // [cite: 255]
                    });
                }
                console.log(`Colaborador with ID ${id} deleted. Affected rows: ${resultColaborador.affectedRows}`); // [cite: 256]

                // 3. Eliminar el registro de 'USUARIOS' (solo si rol es 'colaborador')
                if (!usernameToDeleteTrimmed) {
                    // Si no había username asociado, solo confirma el commit del colaborador
                    console.warn(`Colaborador ID ${id} no tenía usuario_empleado asociado. No se eliminará usuario.`);
                    db.commit(commitErr => {
                        if (commitErr) {
                            console.error("Error confirmando transacción (sin usuario asociado):", commitErr);
                            return res.status(500).json({ success: false, message: 'Error interno al finalizar la operación (falló el commit).', error: commitErr.message });
                        }
                         res.json({ success: true, message: 'Colaborador eliminado (no tenía usuario asociado).' });
                    });
                    return; // Salir aquí
                }

                const sqlDeleteUsuario = 'DELETE FROM USUARIOS WHERE usuario = ? AND rol = \'colaborador\''; // [cite: 257]
                db.query(sqlDeleteUsuario, [usernameToDeleteTrimmed], (err, resultUsuario) => { // [cite: 257]
                    let finalMessage = 'Colaborador y usuario asociado eliminados exitosamente.'; // [cite: 271]
                    let isWarning = false;

                    if (err) { // Error eliminando usuario [cite: 258]
                        console.error(`Error DB delete usuario asociado '${usernameToDeleteTrimmed}':`, err); // [cite: 258]
                        finalMessage = `Colaborador eliminado exitosamente, pero hubo un error al eliminar la cuenta de usuario asociada '${usernameToDeleteTrimmed}'. Es posible que deba eliminarla manualmente.`; // [cite: 259]
                        isWarning = true; // [cite: 261]
                    } else if (resultUsuario.affectedRows === 0) { // Usuario no encontrado [cite: 263]
                        console.warn(`Usuario asociado '${usernameToDeleteTrimmed}' con rol 'colaborador' no encontrado para eliminar.`); // [cite: 264]
                        finalMessage = `Colaborador eliminado exitosamente, pero el usuario asociado ('${usernameToDeleteTrimmed}') (con rol 'colaborador') no fue encontrado en el sistema.`; // [cite: 265]
                        isWarning = true; // [cite: 266]
                    } else {
                        console.log(`User account for '${usernameToDeleteTrimmed}' deleted. Affected rows: ${resultUsuario.affectedRows}`); // [cite: 268]
                    }

                    // Confirmar la transacción (parcial o completa)
                    db.commit(commitErr => { // [cite: 260, 265, 268]
                        if (commitErr) {
                            console.error("Error confirmando transacción al eliminar:", commitErr); // [cite: 269]
                            // Ya no se puede hacer rollback aquí, solo informar
                            return res.status(500).json({ success: false, message: 'Error interno al finalizar la operación de eliminación (falló el commit).', error: commitErr.message }); // [cite: 270]
                        }
                        // Enviar respuesta final
                        if (isWarning) {
                            res.json({ success: true, warning: true, message: finalMessage }); // [cite: 261, 266]
                        } else {
                            res.json({ success: true, message: finalMessage }); // [cite: 271]
                        }
                    });
                });
            });
        });
    });
};


// GET /api/colaborador/data - Obtener datos para perfil colaborador
const getCollaboratorProfileData = (req, res) => {
    const loggedInUsername = req.session.user.usuario; // [cite: 289]

    // 1. Encontrar el id_empleado asociado
    const findEmpleadoIdSql = 'SELECT id_empleado FROM colaboradores WHERE usuario_empleado = ?'; // [cite: 289]
    db.query(findEmpleadoIdSql, [loggedInUsername], (err, results) => { // [cite: 289]
        if (err) {
            console.error("Error DB finding id_empleado for logged in user:", err); // [cite: 290]
            return res.status(500).json({ success: false, message: 'Error interno al obtener ID de empleado.' }); // [cite: 290]
        }
        if (results.length === 0) { // [cite: 290]
            console.error(`Inconsistencia de datos: Usuario logueado '${loggedInUsername}' con rol '${req.session.user.rol}' no tiene colaborador asociado.`); // [cite: 291]
            return res.status(404).json({ success: false, message: 'No se encontró información de colaborador asociada a su cuenta de usuario. Contacte al administrador.' }); // [cite: 291]
        }
        const empleadoId = results[0].id_empleado; // [cite: 292]

        // 2. Obtener datos personales
        const getPersonalInfoSql = 'SELECT id_empleado, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, usuario_empleado, sexo, edad, id_contrato, puesto, estado_civil, fecha_nacimiento, ciudad_nacimiento, departamento, email, email_interno, telefono, direccion, status FROM colaboradores WHERE id_empleado = ?'; // [cite: 292]
        db.query(getPersonalInfoSql, [empleadoId], (err, personalInfoResults) => { // [cite: 293]
            if (err) {
                console.error("Error DB getting personal info for id_empleado:", err); // [cite: 293]
                return res.status(500).json({ success: false, message: 'Error interno al obtener datos personales del colaborador.' }); // [cite: 293]
            }
            if (personalInfoResults.length === 0) { // [cite: 294]
                 console.error(`Inconsistencia de datos: id_empleado ${empleadoId} encontrado por username, pero no al buscar por id.`); // [cite: 294]
                 return res.status(404).json({ success: false, message: 'No se encontró información detallada del colaborador.' }); // [cite: 295]
             }
            const personalInfo = {
                ...personalInfoResults[0],
                fecha_nacimiento: formatDate(personalInfoResults[0].fecha_nacimiento) // Formatear fecha [cite: 298]
            };

            // 3. Obtener historial de pagos
            const getPaymentsSql = 'SELECT id_nomina, fecha_inicio, fecha_fin, tipo_pago, sueldo_base, horas_extra, bonificaciones, descuentos, total_pagado FROM nominas WHERE id_empleado = ? ORDER BY fecha_inicio DESC'; // [cite: 301] (Added DESC)
            db.query(getPaymentsSql, [empleadoId], (err, paymentsResults) => { // [cite: 301]
                if (err) {
                    console.error("Error DB getting payments for id_empleado:", err); // [cite: 302]
                    return res.status(500).json({ success: false, message: 'Error interno al obtener historial de pagos.' }); // [cite: 302]
                }
                // Formatear fechas de pagos
                const payments = paymentsResults.map(payment => ({ // [cite: 303]
                     ...payment,
                     fecha_inicio: formatDate(payment.fecha_inicio), // [cite: 306]
                     fecha_fin: formatDate(payment.fecha_fin) // [cite: 312]
                 })); // [cite: 315]

                // 4. Enviar todos los datos
                res.json({ // [cite: 315]
                     success: true, // [cite: 316]
                     user: req.session.user, // Enviar info del usuario logueado [cite: 316]
                     personalInfo: personalInfo, // [cite: 317]
                     payments: payments // [cite: 317]
                });
            });
        });
    });
};


module.exports = {
    getAllCollaborators,
    getCollaboratorById,
    createCollaborator,
    updateCollaborator,
    deleteCollaborator,
    getCollaboratorProfileData
};