import fs from 'fs';
import path from 'path';

import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';

export interface ProcessedModel {
  id: string;
  fileName: string;
  originalPath: string;
  status: 'processing' | 'completed' | 'failed';
  elements: unknown[];
  rooms: unknown[];
  agentParams: Record<string, unknown>;
  ifcPath?: string;
  glbPath?: string;
  usdPath?: string;
  summaryPath?: string;
  elementsCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ProcessingJob {
  id: string;
  fileName: string;
  originalPath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

type DbProcessedModelRow = {
  id: string;
  fileName: string;
  originalPath: string;
  status: ProcessedModel['status'];
  elements?: string | null;
  rooms?: string | null;
  agentParams?: string | null;
  ifcPath?: string | null;
  glbPath?: string | null;
  usdPath?: string | null;
  summaryPath?: string | null;
  elementsCount: number;
  createdAt: string;
  updatedAt: string;
  error?: string | null;
};

class DatabaseManager {
  private db: Database.Database;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'models.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Create processed_models table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_models (
        id TEXT PRIMARY KEY,
        fileName TEXT NOT NULL,
        originalPath TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
        elements TEXT, -- JSON string
        rooms TEXT, -- JSON string
        agentParams TEXT, -- JSON string
        ifcPath TEXT,
        glbPath TEXT,
        usdPath TEXT,
        summaryPath TEXT,
        elementsCount INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        error TEXT
      )
    `);

    // Create processing_jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processing_jobs (
        id TEXT PRIMARY KEY,
        fileName TEXT NOT NULL,
        originalPath TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        progress INTEGER DEFAULT 0,
        message TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        error TEXT
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_processed_models_status ON processed_models(status);
      CREATE INDEX IF NOT EXISTS idx_processed_models_created_at ON processed_models(createdAt);
      CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(createdAt);
    `);
  }

  // Processed Models CRUD operations
  createProcessedModel(model: Omit<ProcessedModel, 'createdAt' | 'updatedAt'>): ProcessedModel {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO processed_models (
        id, fileName, originalPath, status, elements, rooms, agentParams,
        ifcPath, glbPath, usdPath, summaryPath, elementsCount, createdAt, updatedAt, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      model.id,
      model.fileName,
      model.originalPath,
      model.status,
      JSON.stringify(model.elements),
      JSON.stringify(model.rooms),
      JSON.stringify(model.agentParams),
      model.ifcPath || null,
      model.glbPath || null,
      model.usdPath || null,
      model.summaryPath || null,
      model.elementsCount,
      now,
      now,
      model.error || null
    );

    return {
      ...model,
      createdAt: now,
      updatedAt: now
    };
  }

  getProcessedModel(id: string): ProcessedModel | null {
    const stmt = this.db.prepare('SELECT * FROM processed_models WHERE id = ?');
    const row = stmt.get(id) as DbProcessedModelRow | undefined;

    if (!row) return null;

    return {
      id: row.id,
      fileName: row.fileName,
      originalPath: row.originalPath,
      status: row.status,
      elements: JSON.parse(row.elements ?? '[]') as unknown[],
      rooms: JSON.parse(row.rooms ?? '[]') as unknown[],
      agentParams: JSON.parse(row.agentParams ?? '{}') as Record<string, unknown>,
      ifcPath: row.ifcPath ?? undefined,
      glbPath: row.glbPath ?? undefined,
      usdPath: row.usdPath ?? undefined,
      summaryPath: row.summaryPath ?? undefined,
      elementsCount: row.elementsCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      error: row.error ?? undefined,
    };
  }

  updateProcessedModel(id: string, updates: Partial<ProcessedModel>): ProcessedModel | null {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.elements !== undefined) {
      fields.push('elements = ?');
      values.push(JSON.stringify(updates.elements));
    }
    if (updates.rooms !== undefined) {
      fields.push('rooms = ?');
      values.push(JSON.stringify(updates.rooms));
    }
    if (updates.agentParams !== undefined) {
      fields.push('agentParams = ?');
      values.push(JSON.stringify(updates.agentParams));
    }
    if (updates.ifcPath !== undefined) {
      fields.push('ifcPath = ?');
      values.push(updates.ifcPath);
    }
    if (updates.glbPath !== undefined) {
      fields.push('glbPath = ?');
      values.push(updates.glbPath);
    }
    if (updates.usdPath !== undefined) {
      fields.push('usdPath = ?');
      values.push(updates.usdPath);
    }
    if (updates.summaryPath !== undefined) {
      fields.push('summaryPath = ?');
      values.push(updates.summaryPath);
    }
    if (updates.elementsCount !== undefined) {
      fields.push('elementsCount = ?');
      values.push(updates.elementsCount);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (fields.length === 0) return this.getProcessedModel(id);

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    const stmt = this.db.prepare(`UPDATE processed_models SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getProcessedModel(id);
  }

  getAllProcessedModels(limit = 50, offset = 0): ProcessedModel[] {
    const stmt = this.db.prepare(`
      SELECT * FROM processed_models 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as DbProcessedModelRow[];

    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      originalPath: row.originalPath,
      status: row.status,
      elements: JSON.parse(row.elements ?? '[]') as unknown[],
      rooms: JSON.parse(row.rooms ?? '[]') as unknown[],
      agentParams: JSON.parse(row.agentParams ?? '{}') as Record<string, unknown>,
      ifcPath: row.ifcPath ?? undefined,
      glbPath: row.glbPath ?? undefined,
      usdPath: row.usdPath ?? undefined,
      summaryPath: row.summaryPath ?? undefined,
      elementsCount: row.elementsCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      error: row.error ?? undefined,
    }));
  }

  deleteProcessedModel(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM processed_models WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Processing Jobs CRUD operations
  createProcessingJob(job: Omit<ProcessingJob, 'createdAt' | 'updatedAt'>): ProcessingJob {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO processing_jobs (
        id, fileName, originalPath, status, progress, message, createdAt, updatedAt, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.fileName,
      job.originalPath,
      job.status,
      job.progress,
      job.message,
      now,
      now,
      job.error || null
    );

    return {
      ...job,
      createdAt: now,
      updatedAt: now
    };
  }

  getProcessingJob(id: string): ProcessingJob | null {
    const stmt = this.db.prepare('SELECT * FROM processing_jobs WHERE id = ?');
    return stmt.get(id) as ProcessingJob | null;
  }

  updateProcessingJob(id: string, updates: Partial<ProcessingJob>): ProcessingJob | null {
    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.progress !== undefined) {
      fields.push('progress = ?');
      values.push(updates.progress);
    }
    if (updates.message !== undefined) {
      fields.push('message = ?');
      values.push(updates.message);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }

    if (fields.length === 0) return this.getProcessingJob(id);

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    const stmt = this.db.prepare(`UPDATE processing_jobs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getProcessingJob(id);
  }

  getAllProcessingJobs(limit = 50, offset = 0): ProcessingJob[] {
    const stmt = this.db.prepare(`
      SELECT * FROM processing_jobs 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as ProcessingJob[];
  }

  getActiveProcessingJobs(): ProcessingJob[] {
    const stmt = this.db.prepare(`
      SELECT * FROM processing_jobs 
      WHERE status IN ('pending', 'processing')
      ORDER BY createdAt ASC
    `);
    return stmt.all() as ProcessingJob[];
  }

  deleteProcessingJob(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM processing_jobs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Utility methods
  getStats() {
    const processedCount = this.db.prepare('SELECT COUNT(*) as count FROM processed_models').get() as { count: number };
    const completedCount = this.db.prepare("SELECT COUNT(*) as count FROM processed_models WHERE status = 'completed'").get() as { count: number };
    const failedCount = this.db.prepare("SELECT COUNT(*) as count FROM processed_models WHERE status = 'failed'").get() as { count: number };
    const processingCount = this.db.prepare("SELECT COUNT(*) as count FROM processing_jobs WHERE status IN ('pending', 'processing')").get() as { count: number };

    return {
      totalProcessed: processedCount.count,
      completed: completedCount.count,
      failed: failedCount.count,
      currentlyProcessing: processingCount.count
    };
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: DatabaseManager | null = null;
// Prisma singleton (prevent hot-reload multiple instances)
declare global {
  var __prisma__: PrismaClient | undefined;
}

let prismaClient: PrismaClient;
if (global.__prisma__) {
  prismaClient = global.__prisma__;
} else {
  prismaClient = new PrismaClient();
  global.__prisma__ = prismaClient;
}

export const prisma = prismaClient;

export function getDatabase(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
