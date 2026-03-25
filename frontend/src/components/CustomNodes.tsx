import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Play, AlertTriangle, FileText, Clock } from 'lucide-react';

export const TriggerNode = memo(({ data, selected }: any) => {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-blue-500/20' : 'border-blue-500'} text-white min-w-[150px] manual-trigger-node`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="rounded-full w-8 h-8 flex items-center justify-center bg-blue-500/20 text-blue-500 mr-2">
            <Play size={16} fill="currentColor" />
          </div>
          <div className="ml-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trigger</div>
            <div className="text-sm font-bold">{data.label || 'Button Trigger'}</div>
          </div>
        </div>
        {data.onExecute && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              data.onExecute();
            }}
            className="p-1.5 hover:bg-blue-500/20 rounded-full text-blue-500 transition-all active:scale-95 shadow-lg shadow-blue-500/10 border border-blue-500/30"
            title="Fire Manual Trigger"
          >
            <Play size={18} fill="currentColor" />
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
    </div>
  );
});

export const ActionNode = memo(({ data, selected }: any) => {
  const isAlert = data.type === 'console_alert';
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-green-500/20' : 'border-green-500'} text-white min-w-[150px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center">
        <div className={`rounded-full w-8 h-8 flex items-center justify-center bg-green-500/20 text-green-500 mr-2`}>
          {isAlert ? <AlertTriangle size={16} /> : <FileText size={16} />}
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action</div>
          <div className="text-sm font-bold">{data.label || (isAlert ? 'Console Alert' : 'Print Log')}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 border-2 border-slate-900" />
    </div>
  );
});
export const ScheduleNode = memo(({ data, selected }: any) => {
  const interval = data.config?.intervalValue || 1;
  const unit = data.config?.intervalUnit || 'minutes';
  
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-blue-500/20' : 'border-blue-500'} text-white min-w-[150px]`}>
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-blue-500/20 text-blue-500 mr-2">
          <Clock size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schedule</div>
          <div className="text-sm font-bold">Every {interval} {unit}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
    </div>
  );
});
