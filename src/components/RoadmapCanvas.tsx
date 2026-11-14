import React, { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import { AlertTriangle, ArrowRight, CheckCircle2, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import type { RoadmapDAG, RoadmapFlowNode } from '../types/careerloop';
import { CurriculumNode } from './CurriculumNode';

interface RoadmapCanvasProps {
  roadmap: RoadmapDAG | null;
  readinessScore: number;
  targetRole: string;
  roleSummary: string;
  verifiedCount: number;
  gapCount: number;
  selectedNodeId: string | null;
  onSelectNode: (node: RoadmapFlowNode) => void;
  onSimulateFail: () => void;
  onOpenSkillMatrix: () => void;
  isBusy: boolean;
}

const nodeTypes = {
  curriculumNode: CurriculumNode,
};

export const RoadmapCanvas: React.FC<RoadmapCanvasProps> = ({
  roadmap,
  readinessScore,
  targetRole,
  roleSummary,
  verifiedCount,
  gapCount,
  selectedNodeId,
  onSelectNode,
  onSimulateFail,
  onOpenSkillMatrix,
  isBusy,
}) => {
  const rfNodes: Node[] = useMemo(() => {
    if (!roadmap) return [];
    return roadmap.nodes.map((n) => ({
      id: n.id,
      type: 'curriculumNode',
      position: n.position,
      data: n.data,
      selected: n.id === selectedNodeId,
    }));
  }, [roadmap, selectedNodeId]);

  const rfEdges: Edge[] = useMemo(() => {
    if (!roadmap) return [];
    return roadmap.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated,
      label: e.label || undefined,
      style: {
        stroke: e.animated ? '#0071E3' : '#B8BDC7',
        strokeWidth: e.animated ? 2.2 : 1.6,
      },
      labelStyle: {
        fontSize: 11,
        fontWeight: 600,
        fill: '#B86200',
      },
    }));
  }, [roadmap]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top Bento Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-surface px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12.5px] font-medium text-[#6E6E73]">Career readiness</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[30px] font-semibold tracking-tight text-[#1D1D1F] tabular-nums">
                {Math.round(readinessScore)}%
              </span>
              <span className="text-[12.5px] text-[#6E6E73] truncate">{targetRole}</span>
            </div>
          </div>
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="rgba(0,0,0,0.07)"
                strokeWidth="3.2"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#0071E3"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeDasharray={`${Math.min(Math.max(readinessScore, 0), 100)}, 100`}
              />
            </svg>
          </div>
        </div>

        <div className="glass-surface px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-[#6E6E73]">Verified baseline</p>
            <CheckCircle2 className="h-4 w-4 text-[#28CD41]" />
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-[26px] font-semibold tracking-tight text-[#1D1D1F] tabular-nums">
              {verifiedCount} {verifiedCount === 1 ? 'skill' : 'skills'}
            </span>
            <button
              type="button"
              onClick={onOpenSkillMatrix}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#0071E3] hover:underline whitespace-nowrap"
            >
              <span>Inspect matrix</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="glass-surface px-5 py-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-[#6E6E73]">Priority skill gaps</p>
            <Layers className="h-4 w-4 text-[#FF9500]" />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-[26px] font-semibold tracking-tight text-[#1D1D1F] tabular-nums">
              {gapCount} {gapCount === 1 ? 'module' : 'modules'}
            </span>
            <span className="text-[12px] text-[#6E6E73] truncate">
              {roadmap?.rerouted ? 'Remediation active' : 'Adaptive path'}
            </span>
          </div>
        </div>
      </div>

      {/* Adaptive Re-route Notice Banner when <60% assessment injected a prerequisite */}
      {roadmap?.rerouted && roadmap.reroute_reason && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-[16px] bg-[#FFF8EB]/90 border border-[#FF9500]/40 px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-[13px] text-[#7A4100]">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF9500]" />
            <span>
              <strong className="font-semibold">Adaptive re-route applied:</strong>{' '}
              {roadmap.reroute_reason}
            </span>
          </div>
        </motion.div>
      )}

      {/* Main Interactive React Flow DAG Canvas */}
      <div className="glass-surface flex-1 min-h-[450px] flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-black/[0.06]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#1D1D1F]">
              Adaptive Learning Roadmap
            </h2>
            <p className="text-[12.5px] text-[#6E6E73] truncate max-w-2xl">
              {roleSummary ||
                `Click any node to inspect curated resources, start a skill check, or chat with your AI Mentor.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onSimulateFail}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#FFF4E5] border border-[#FF9500]/45 px-3.5 py-2 text-[12.5px] font-medium text-[#B86200] transition-colors hover:bg-[#FFEAD1] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Simulate 40% JS Quiz Fail</span>
          </button>
        </div>

        <div className="relative flex-1 min-h-[380px] bg-white/35">
          {rfNodes.length > 0 ? (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => {
                const matched = roadmap?.nodes.find((n) => n.id === node.id);
                if (matched) onSelectNode(matched);
              }}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.45}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.1} color="rgba(0,0,0,0.09)" />
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-[13.5px] text-[#6E6E73]">
              Generating your personalized learning roadmap...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
