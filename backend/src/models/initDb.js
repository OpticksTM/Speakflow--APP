const db = require('../config/db');

async function createTables() {
    try {
        // Tabela de Utilizadores
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Tabela de Conversas/Histórico de Mensagens com as IAs
        await db.query(`
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                ai_model VARCHAR(50) NOT NULL,
                prompt TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Insere um utilizador padrão (ID 1) se ele não existir
        await db.query(`
            INSERT INTO users (id, username, email)
            VALUES (1, 'Utilizador Padrão', 'padrao@speakflow.com')
            ON CONFLICT (id) DO NOTHING;
        `);

        console.log('Tabelas verificadas e utilizador padrão criado com sucesso no PostgreSQL.');
    } catch (error) {
        console.error('Erro ao criar tabelas na base de dados:', error);
    }
}

module.exports = { createTables };