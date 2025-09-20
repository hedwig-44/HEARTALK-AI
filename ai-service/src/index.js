// HearTalk AI MVP Service Entry Point
import express from 'express';
import dotenv from 'dotenv';
import { getLogger } from './utils/Logger.js';
import { defaultMiddlewareStack } from './middleware/MiddlewareStack.js';
import apiRoutes from './routes/api.js';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = getLogger('server');

const app = express();
const PORT = process.env.PORT || 8001;
const HOST = process.env.HOST || 'localhost';

// Configure middleware stack
defaultMiddlewareStack.configure(app);

// API Routes
app.use('/api/v1', apiRoutes);

// Internal API Routes for testing
app.get('/internal/api/v1/test', (req, res) => {
  res.json({
    success: true,
    message: 'Internal service authentication test successful',
    serviceAuth: req.serviceAuth,
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

// Configure error handling (must be after all routes)
defaultMiddlewareStack.configurePostRoutes(app);

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, HOST, () => {
    logger.info('HearTalk AI MVP Server started successfully', {
      host: HOST,
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      nodeVersion: process.version
    });
  });
}

export default app;