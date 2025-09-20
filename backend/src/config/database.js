const { Pool } = require('pg');
const { logger } = require('../utils/logger');

class Database {
  constructor() {
    this.config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'heartalk',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.NODE_ENV === 'production',
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };

    this.pool = new Pool(this.config);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.pool.on('connect', (client) => {
      logger.info('New database client connected');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database client error:', err);
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Client acquired from pool');
    });

    this.pool.on('release', (err, client) => {
      if (err) {
        logger.error('Client release error:', err);
      } else {
        logger.debug('Client released back to pool');
      }
    });
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms`, { text, params });
      return result;
    } catch (error) {
      logger.error('Database query error:', { error, text, params });
      throw error;
    }
  }

  async getClient() {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (error) {
      logger.error('Error getting database client:', error);
      throw error;
    }
  }

  async transaction(callback) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async testConnection() {
    try {
      const result = await this.query('SELECT NOW()');
      logger.info('Database connection test successful', result.rows[0]);
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async close() {
    try {
      await this.pool.end();
      logger.info('Database pool closed');
    } catch (error) {
      logger.error('Error closing database pool:', error);
      throw error;
    }
  }
}

const database = new Database();
module.exports = database;