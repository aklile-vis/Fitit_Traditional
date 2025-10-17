'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

import DualViewSystem from '@/components/agent/DualViewSystem';
import type { ProcessedModel } from '@/lib/database';
import { AgentParameters, FloorPlanElement, RoomDefinition } from '@/services/floorPlanAnalyzer';

export default function ModelViewerPage() {
  const params = useParams();
  const modelId = params.id as string;
  
  const [model, setModel] = useState<ProcessedModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!modelId) return;

    const fetchModel = async () => {
      try {
        const response = await fetch(`/api/models/${modelId}`);
        if (!response.ok) {
          throw new Error('Model not found');
        }
        
        const modelData = await response.json();
        setModel(modelData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [modelId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)]">
        <div className="text-xl text-secondary">Loading model...</div>
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)]">
        <div className="text-center">
          <div className="mb-2 text-xl text-[color:var(--danger-500)]">Error</div>
          <div className="text-secondary">{error || 'Model not found'}</div>
        </div>
      </div>
    );
  }

  if (model.status !== 'completed') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--app-background)]">
        <div className="text-center">
          <div className="mb-2 text-xl text-[color:var(--warning-500)]">
            {model.status === 'processing' ? 'Processing...' : 'Failed'}
          </div>
          <div className="text-secondary">
            {model.status === 'processing'
              ? 'This model is still being processed. Please wait...'
              : model.error || 'Processing failed'}
          </div>
        </div>
      </div>
    );
  }

  const elements = useMemo(() => (Array.isArray(model.elements) ? (model.elements as FloorPlanElement[]) : []), [model.elements]);
  const rooms = useMemo(() => (Array.isArray(model.rooms) ? (model.rooms as RoomDefinition[]) : []), [model.rooms]);

  const agentParamsRaw = (model.agentParams ?? {}) as Partial<AgentParameters>
  const normalizedAgentParams: AgentParameters = {
    wallHeight: typeof agentParamsRaw.wallHeight === 'number' ? agentParamsRaw.wallHeight : 3.0,
    wallThickness: typeof agentParamsRaw.wallThickness === 'number' ? agentParamsRaw.wallThickness : 0.2,
    floorThickness: typeof agentParamsRaw.floorThickness === 'number' ? agentParamsRaw.floorThickness : 0.15,
    ceilingHeight: typeof agentParamsRaw.ceilingHeight === 'number' ? agentParamsRaw.ceilingHeight : 2.8,
    doorHeight: typeof agentParamsRaw.doorHeight === 'number' ? agentParamsRaw.doorHeight : 2.1,
    windowHeight: typeof agentParamsRaw.windowHeight === 'number' ? agentParamsRaw.windowHeight : 1.2,
    windowSillHeight: typeof agentParamsRaw.windowSillHeight === 'number' ? agentParamsRaw.windowSillHeight : 0.9,
  }

  return (
    <div className="min-h-screen bg-[color:var(--app-background)]">
      <DualViewSystem
        elements={elements}
        rooms={rooms}
        agentParams={normalizedAgentParams}
        onElementSelect={(element) => {
          console.log('Selected element:', element);
        }}
        onMaterialChange={(elementId, materialId) => {
          console.log('Material change:', elementId, materialId);
        }}
        onParameterChange={(params) => {
          console.log('Parameter change:', params);
        }}
      />
    </div>
  );
}
