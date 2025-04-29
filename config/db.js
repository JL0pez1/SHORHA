// config/db.js
require('dotenv').config(); // Asegura que las variables de entorno estén disponibles
const mysql = require('mysql2');

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

module.exports = db; // Exporta la conexión para que otros módulos la usen