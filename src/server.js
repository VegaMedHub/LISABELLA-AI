/**
 * SERVER - SERVIDOR PRINCIPAL DE LISABELLA
 * Maneja las rutas API y sirve el frontend
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  PORT, 
  HOST, 
  CORS_ORIGIN, 
  CORS_METHODS, 
  CORS_HEADERS,
  log,
  validateQuestion 
} from './config.js';
import Wrapper from './wrapper.js';
import MistralClient from './mistral.js';

// Configuración para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LisabellaServer {
  constructor() {
    this.app = express();
    this.wrapper = new Wrapper();
    this.mistralClient = new MistralClient();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: CORS_ORIGIN,
      methods: CORS_METHODS,
      allowedHeaders: CORS_HEADERS,
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Logging middleware
    this.app.use((req, res, next) => {
      log('info', `${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'Lisabella Medical AI',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // Stats endpoint
    this.app.get('/api/stats', (req, res) => {
      const stats = this.wrapper.getStats();
      res.json({
        ...stats,
        mistral_model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        server_status: 'running'
      });
    });

    // Main API endpoint for medical questions
    this.app.post('/api/ask', async (req, res) => {
      try {
        const { question } = req.body;

        // Validación básica
        if (!validateQuestion(question)) {
          return res.status(400).json({
            success: false,
            error: "Pregunta inválida",
            message: "La pregunta debe tener al menos 3 caracteres"
          });
        }

        log('info', 'Procesando pregunta', { question: question.substring(0, 100) });

        // Clasificar la pregunta
        const classification = this.wrapper.classify(question);

        // Manejar diferentes resultados de clasificación
        if (classification.result === "RECHAZADA") {
          return res.json({
            success: false,
            classification: classification,
            response: null
          });
        }

        if (classification.result === "REFORMULAR") {
          return res.json({
            success: false,
            classification: classification,
            response: null
          });
        }

        // Generar respuesta con Mistral
        const domain = classification.domain || "medicina general";
        const specialCommand = classification.special_command || null;

        log('info', 'Generando respuesta con Mistral', { domain, specialCommand });
        
        const response = await this.mistralClient.generate(
          question, 
          domain, 
          specialCommand
        );

        // Retornar respuesta exitosa
        res.json({
          success: true,
          classification: classification,
          response: response,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        log('error', 'Error en endpoint /api/ask', { error: error.message });
        res.status(500).json({
          success: false,
          error: "Error interno del servidor",
          message: error.message
        });
      }
    });

    // Serve frontend for all other routes (SPA support)
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  start() {
    this.server = this.app.listen(PORT, HOST, () => {
      log('info', `🚀 Lisabella Server ejecutándose en http://${HOST}:${PORT}`);
      log('info', `📚 Dominios médicos cargados: ${Object.keys(this.wrapper.domains).length}`);
      log('info', `🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  shutdown() {
    log('info', 'Apagando servidor Lisabella...');
    this.server?.close(() => {
      log('info', 'Servidor apagado correctamente');
      process.exit(0);
    });
  }
}

// Inicializar y ejecutar servidor
const server = new LisabellaServer();
server.start();

export default LisabellaServer;
