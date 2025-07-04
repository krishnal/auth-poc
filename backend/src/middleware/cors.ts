import { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AppConfig } from '../config';

/**
 * Registers CORS middleware with the Fastify app
 */
export function registerCors(app: FastifyInstance, config: AppConfig): void {
  app.register(cors, {
    origin: config.cors.allowedDomains,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
} 