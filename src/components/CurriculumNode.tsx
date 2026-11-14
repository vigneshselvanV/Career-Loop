import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, CheckCircle2, Clock, Compass, Lock } from 'lucide-react';
import type { RoadmapNodeData } from '../types/careerloop';

export const CurriculumNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as RoadmapNodeData;
  const status = nodeData.status;

  const statusConfig = {
    verified: {
      ring: selected ? 'ring-2 ring-[#28CD41]/50 border-[#28CD41]/60' : 'border-[#28CD41]/45',
      bg: 'bg-white/90',
      icon: CheckCircle2,
      iconColor: 'text-[#28CD41]',
      statusLabel: 'Verified',
      accentText: 'text-[#1D7A2F]',
    },
    in_progress: {
      ring: selected ? 'ring-2 ring-[#0071E3]/45 border-[#0071E3]' : 'border-[#0071E3]/55',
      bg: 'bg-white/95',
      icon: Compass,
      iconColor: 'text-[#0071E3]',
      statusLabel: 'Active module',
      accentText: 'text-[#0071E3]',
    },
    remediation: {
      ring: selected ? 'ring-2 ring-[#FF9500]/50 border-[#FF9500]' : 'border-[#FF9500]/75',
      bg: 'bg-[#FFFBF2]/95',
      icon: AlertTriangle,
      iconColor: 'text-[#FF9500]',
      statusLabel: 'Prerequisite',
      accentText: 'text-[#B86200]',
    },
    locked: {
      ring: selected ? 'ring-2 ring-[#0071E3]/35 border-[#0071E3]/45' : 'border-black/[0.08]',
      bg: 'bg-white/75',
      icon: Lock,
      iconColor: 'text-[#6E6E73]',
      statusLabel: 'Upcoming',
      accentText: 'text-[#6E6E73]',
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={`w-[248px] rounded-[18px] border backdrop-blur-xl px-4 py-3.5 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.09)] transition-all duration-150 ${statusConfig.bg} ${statusConfig.ring}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#0071E3]"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium">
          <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${statusConfig.iconColor}`} />
          <span className={statusConfig.accentText}>{statusConfig.statusLabel}</span>
        </div>
        <span className="flex items-center gap-1 text-[11.5px] text-[#6E6E73] tabular-nums shrink-0">
          <Clock className="h-3 w-3" />
          {nodeData.estimated_hours}h
        </span>
      </div>

      <h3 className="mt-1.5 text-[14.5px] font-semibold leading-snug text-[#1D1D1F]">
        {nodeData.label}
      </h3>

      {nodeData.badge_text && (
        <p
          className={`mt-1.5 text-[12px] font-medium leading-snug tabular-nums ${
            status === 'remediation'
              ? 'text-[#B86200]'
              : status === 'verified'
                ? 'text-[#1D7A2F]'
                : 'text-[#6E6E73]'
          }`}
        >
          {nodeData.badge_text}
        </p>
      )}

      {nodeData.resources && nodeData.resources.length > 0 && (
        <p className="mt-2 pt-2 border-t border-black/[0.06] text-[11.5px] text-[#6E6E73] tabular-nums">
          {nodeData.resources.length} curated {nodeData.resources.length === 1 ? 'resource' : 'resources'}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#0071E3]"
      />
    </div>
  );
};
