const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { logger } = require('../utils/logger');

// Load OpenAPI specification
const swaggerDocument = YAML.load(path.join(__dirname, '../../docs/backend-api.yaml'));

// Swagger UI options
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    // Display operation IDs
    displayOperationId: true,
    // Display request duration
    displayRequestDuration: true,
    // Try it out enabled by default
    tryItOutEnabled: true,
    // Show request/response examples
    showExtensions: true,
    showCommonExtensions: true,
    // Enable filtering
    filter: true,
    // Theme
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #3b82f6; }
    `,
    customSiteTitle: 'HearTalk API Documentation',
    customfavIcon: '/favicon.ico'
  }
};

// Setup Swagger middleware
const setupSwagger = (app) => {
  try {
    // Serve swagger docs at /api-docs
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
    
    // Serve raw OpenAPI spec at /api-docs.json
    app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerDocument);
    });

    // Serve raw OpenAPI spec at /api-docs.yaml  
    app.get('/api-docs.yaml', (req, res) => {
      res.setHeader('Content-Type', 'text/yaml');
      res.sendFile(path.join(__dirname, '../../docs/backend-api.yaml'));
    });

    logger.info('Swagger UI configured successfully');
    logger.info('API Documentation available at /api-docs');
    logger.info('OpenAPI JSON spec available at /api-docs.json');
    logger.info('OpenAPI YAML spec available at /api-docs.yaml');
    
  } catch (error) {
    logger.error('Failed to setup Swagger UI:', error);
  }
};

module.exports = {
  setupSwagger,
  swaggerDocument,
  swaggerOptions
};