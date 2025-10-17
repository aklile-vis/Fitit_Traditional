'use client';

import React, { useState, useEffect } from 'react';
import type { ProcessedModel } from '@/lib/database';
import { EyeIcon, TrashIcon, DocumentIcon } from '@heroicons/react/24/outline';

export default function ModelsPage() {
  const [models, setModels] = useState<ProcessedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      
      const data = await response.json();
      setModels(data.models);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  };

  const deleteModel = async (id: string) => {
    // TODO: Replace with proper confirmation modal
    console.log('Delete model:', id);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)]">
        <div className="text-xl text-secondary">Loading models...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)] text-primary">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-4xl font-bold">Processed Models</h1>
          <p className="text-secondary">Manage your processed design files</p>
        </div>

        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="surface-soft p-6">
              <div className="text-2xl font-bold text-[color:var(--accent-500)]">{stats.totalProcessed}</div>
              <div className="text-secondary">Total Models</div>
            </div>
            <div className="surface-soft p-6">
              <div className="text-2xl font-bold text-[color:var(--success-500)]">{stats.completed}</div>
              <div className="text-secondary">Completed</div>
            </div>
            <div className="surface-soft p-6">
              <div className="text-2xl font-bold text-[color:var(--danger-500)]">{stats.failed}</div>
              <div className="text-secondary">Failed</div>
            </div>
            <div className="surface-soft p-6">
              <div className="text-2xl font-bold text-[color:var(--warning-500)]">{stats.currentlyProcessing}</div>
              <div className="text-secondary">Processing</div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 p-4 text-secondary">
            {error}
          </div>
        )}

        {models.length === 0 ? (
          <div className="py-12 text-center">
            <DocumentIcon className="mx-auto mb-4 h-16 w-16 text-muted" />
            <div className="mb-2 text-xl text-secondary">No models found</div>
            <div className="text-muted">Upload a design file to get started</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <div key={model.id} className="surface-soft space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-primary">
                    <span className="truncate">{model.fileName}</span>
                  </h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    model.status === 'completed'
                      ? 'border-[color:var(--success-500)]/40 bg-[color:var(--success-500)]/12 text-[color:var(--success-500)]'
                      : model.status === 'processing'
                        ? 'border-[color:var(--warning-500)]/40 bg-[color:var(--warning-500)]/12 text-[color:var(--warning-500)]'
                        : 'border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 text-[color:var(--danger-500)]'
                  }`}>
                    {model.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-secondary">
                  <div className="flex justify-between">
                    <span>Elements:</span>
                    <span className="text-primary">{model.elementsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="text-primary">
                      {new Date(model.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Updated:</span>
                    <span className="text-primary">
                      {new Date(model.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {model.error && (
                  <div className="mb-4 rounded border border-[color:var(--danger-500)]/40 bg-[color:var(--danger-500)]/12 p-3">
                    <div className="text-[color:var(--danger-500)] text-sm">{model.error}</div>
                  </div>
                )}

                <div className="flex space-x-2">
                  {model.status === 'completed' && (
                    <a
                      href={`/agent/viewer/${model.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary flex flex-1 items-center justify-center gap-2"
                    >
                      <EyeIcon className="h-4 w-4" />
                      View 3D
                    </a>
                  )}
                  <button
                    onClick={() => deleteModel(model.id)}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
