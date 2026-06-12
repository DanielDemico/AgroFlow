import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Play, AlertTriangle, FileText, Clock, Map, Leaf, TrendingUp, BarChart3, Activity, Mail } from 'lucide-react';

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

export const AreasNode = memo(({ data, selected }: any) => {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-blue-500/20' : 'border-blue-500'} text-white min-w-[150px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-blue-500/20 text-blue-500 mr-2">
          <Map size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Geodata</div>
          <div className="text-sm font-bold">{data.config?.areaName || data.label || 'Areas Node'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-slate-900" />
    </div>
  );
});

// Helper function to extract and generate deterministic NDVI data in frontend
export const getNdviDataForNode = (nodeId: string, getNodes: () => any[], getEdges: () => any[]) => {
  const nodes = getNodes();
  const edges = getEdges();
  
  const incomingEdges = edges.filter(e => e.target === nodeId);
  const connectedSources = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean);
  
  let allFeatures: any[] = [];
  let periodMonths = 6;
  
  const ndviNode = connectedSources.find(n => n.type === 'ndvi');
  if (ndviNode) {
    periodMonths = ndviNode.data?.config?.periodMonths || 6;
    const ndviIncomingEdges = edges.filter(e => e.target === ndviNode.id);
    const areasNodes = ndviIncomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(n => n && n.type === 'areas');
    areasNodes.forEach((areasNode: any) => {
      const features = areasNode.data?.config?.areasData?.features;
      if (Array.isArray(features)) {
        const mapped = features.map((f: any, idx: number) => ({
          ...f,
          _sourceNodeId: areasNode.id,
          _sourceNodeName: areasNode.data?.config?.areaName || 'Área',
          _featureIndex: idx
        }));
        allFeatures = [...allFeatures, ...mapped];
      }
    });
  } else {
    const areasNodes = connectedSources.filter(n => n && n.type === 'areas');
    areasNodes.forEach((areasNode: any) => {
      const features = areasNode.data?.config?.areasData?.features;
      if (Array.isArray(features)) {
        const mapped = features.map((f: any, idx: number) => ({
          ...f,
          _sourceNodeId: areasNode.id,
          _sourceNodeName: areasNode.data?.config?.areaName || 'Área',
          _featureIndex: idx
        }));
        allFeatures = [...allFeatures, ...mapped];
      }
    });
    // We are the NDVI node itself
    const selfNode = nodes.find(n => n.id === nodeId);
    if (selfNode) {
      periodMonths = selfNode.data?.config?.periodMonths || 6;
    }
  }

  if (allFeatures.length === 0) return [];

  return allFeatures.map((f: any, idx: number) => {
    const sourceName = f._sourceNodeName || 'Área';
    const subName = f.properties?.name || f.properties?.Name || `Talhão ${f._featureIndex + 1}`;
    const name = `${sourceName} - ${subName}`;
    
    // Deterministic seed based on unique ID + featureIndex + name
    let seedStr = `${f._sourceNodeId || 'node'}-${f._featureIndex || idx}-${name}`;
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const rand = () => {
      const x = Math.sin(hash++) * 10000;
      return x - Math.floor(x);
    };

    // Make the NDVI distinct and well distributed
    const currentNdvi = Math.round((0.12 + rand() * 0.78) * 100) / 100;
    
    let classification = "Baixo";
    let color = "#eab308"; // yellow-500
    if (currentNdvi >= 0.7) {
      classification = "Muito Alto";
      color = "#047857"; // emerald-700
    } else if (currentNdvi >= 0.5) {
      classification = "Alto";
      color = "#10b981"; // emerald-500
    } else if (currentNdvi >= 0.3) {
      classification = "Moderado";
      color = "#84cc16"; // lime-500
    } else if (currentNdvi >= 0.1) {
      classification = "Baixo";
      color = "#eab308"; // yellow-500
    } else {
      classification = "Nulo/Água";
      color = "#3b82f6"; // blue-500
    }

    let months: string[] = [];
    if (periodMonths === 3) {
      months = ["Abr", "Mai", "Jun"];
    } else if (periodMonths === 12) {
      months = ["Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    } else {
      months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    }

    const temporalSeries = months.map((m, mIdx) => {
      // Seasonal curve with unique phase shift and amplitude per area
      const phase = rand() * 2;
      const amplitude = 0.1 + rand() * 0.15;
      const seasonal = Math.sin(mIdx * 0.8 + phase) * amplitude;
      const trend = (rand() - 0.5) * 0.1;
      const val = Math.min(1.0, Math.max(-1.0, currentNdvi + seasonal + trend));
      return { date: m, ndvi: Math.round(val * 100) / 100 };
    });

    const min = Math.round(Math.max(-1.0, currentNdvi - 0.15 - rand() * 0.15) * 100) / 100;
    const q1 = Math.round((currentNdvi - 0.05 - rand() * 0.05) * 100) / 100;
    const median = currentNdvi;
    const q3 = Math.round(Math.min(1.0, currentNdvi + 0.05 + rand() * 0.05) * 100) / 100;
    const max = Math.round(Math.min(1.0, currentNdvi + 0.15 + rand() * 0.15) * 100) / 100;

    return {
      name,
      currentNdvi,
      classification,
      color,
      temporalSeries,
      boxplot: { min, q1, median, q3, max }
    };
  });
};

export const NdviNode = memo(({ id, selected, data }: any) => {
  const { getNodes, getEdges } = useReactFlow();
  const ndviData = getNdviDataForNode(id, getNodes, getEdges);
  const isConnected = ndviData.length > 0;
  const isExecuted = data?.isExecuted || false;

  const avgNdvi = isConnected 
    ? Math.round((ndviData.reduce((acc: number, d: any) => acc + d.currentNdvi, 0) / ndviData.length) * 100) / 100 
    : 0;

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-emerald-500/20' : 'border-emerald-500'} text-white min-w-[200px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center mb-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-emerald-500/20 text-emerald-500 mr-2">
          <Leaf size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">NDVI Processor</div>
          <div className="text-sm font-bold">Processador NDVI</div>
        </div>
      </div>
      
      <div className="text-xs space-y-1 bg-slate-950/50 p-2 rounded border border-slate-800">
        {isConnected ? (
          isExecuted ? (
            <>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">Áreas:</span>
                <span className="text-emerald-400">{ndviData.length}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400">NDVI Médio:</span>
                <span className="text-emerald-400">{avgNdvi}</span>
              </div>
              <div className="pt-1 border-t border-slate-800/80 max-h-[80px] overflow-y-auto space-y-0.5 custom-scrollbar text-[10px]">
                {ndviData.map((d: any, idx: number) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-slate-400 truncate max-w-[100px]">{d.name}</span>
                    <span style={{ color: d.color }}>{d.currentNdvi}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 py-3 font-medium">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Aguardando Execução...</span>
            </div>
          )
        ) : (
          <div className="text-[10px] text-amber-500 flex items-center gap-1 py-1 font-medium">
            <AlertTriangle size={12} />
            <span>Conectar a um nó de Áreas</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-emerald-500 border-2 border-slate-900" />
    </div>
  );
});

export const AnalysisTemporalNode = memo(({ id, selected, data }: any) => {
  const { getNodes, getEdges } = useReactFlow();
  const ndviData = getNdviDataForNode(id, getNodes, getEdges);
  const isConnected = ndviData.length > 0;
  const isExecuted = data?.isExecuted || false;

  // Find range from the connected NDVI node to display in label
  const nodes = getNodes();
  const edges = getEdges();
  const incomingEdges = edges.filter(e => e.target === id);
  const ndviNode = incomingEdges.map(e => nodes.find(n => n.id === e.source)).find(n => n && n.type === 'ndvi');
  const periodMonths = (ndviNode?.data as any)?.config?.periodMonths || 6;

  const renderChart = () => {
    if (!isConnected) return null;
    const width = 200;
    const height = 90;
    const paddingLeft = 25;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    // Get the actual months from first area's data
    const months = ndviData[0]?.temporalSeries.map((t: any) => t.date) || [];
    const pointsCount = months.length;
    
    const getX = (index: number) => paddingLeft + index * (chartWidth / Math.max(1, pointsCount - 1));
    const getY = (val: number) => {
      const clamped = Math.min(1.0, Math.max(0.0, val));
      return paddingTop + chartHeight - (clamped * chartHeight);
    };

    return (
      <svg width={width} height={height} className="mt-2 bg-slate-950/40 rounded border border-slate-800/60 p-1">
        {[0, 0.5, 1.0].map((val, idx) => {
          const y = getY(val);
          return (
            <g key={idx}>
              <line 
                x1={paddingLeft} 
                y1={y} 
                x2={width - paddingRight} 
                y2={y} 
                stroke="#334155" 
                strokeWidth="0.5" 
                strokeDasharray="2,2" 
              />
              <text 
                x={paddingLeft - 5} 
                y={y + 3} 
                fill="#64748b" 
                fontSize="8" 
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}
        
        {ndviData.map((area: any, areaIdx: number) => {
          const points = area.temporalSeries.map((p: any, idx: number) => {
            return `${getX(idx)},${getY(p.ndvi)}`;
          }).join(' ');
          
          return (
            <g key={areaIdx}>
              <polyline
                fill="none"
                stroke={area.color}
                strokeWidth="1.5"
                points={points}
              />
              {area.temporalSeries.map((p: any, idx: number) => (
                <circle
                  key={idx}
                  cx={getX(idx)}
                  cy={getY(p.ndvi)}
                  r="2"
                  fill="#0f172a"
                  stroke={area.color}
                  strokeWidth="1.5"
                >
                  <title>{`${area.name}: ${p.ndvi} (${p.date})`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {months.map((m, idx) => {
          // If we have 12 months, skip every second label to avoid cluttering
          if (pointsCount === 12 && idx % 2 !== 0) return null;
          return (
            <text
              key={idx}
              x={getX(idx)}
              y={height - 5}
              fill="#64748b"
              fontSize="8"
              textAnchor="middle"
            >
              {m[0]} {/* Use single letter for clean fit */}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-indigo-500/20' : 'border-indigo-500'} text-white min-w-[220px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center mb-1">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-indigo-500/20 text-indigo-500 mr-2">
          <TrendingUp size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis</div>
          <div className="text-sm font-bold">Análise Temporal</div>
        </div>
      </div>

      {isConnected ? (
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium">Histórico de NDVI ({periodMonths} Meses):</span>
          {isExecuted ? (
            <>
              {renderChart()}
              <div className="mt-1.5 flex flex-wrap gap-1 max-h-[40px] overflow-y-auto pt-1 border-t border-slate-800/40 text-[8px]">
                {ndviData.map((area: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
                    <span className="text-slate-400 font-medium truncate max-w-[50px]">{area.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-2 bg-slate-950/40 rounded border border-slate-800/60 p-4 text-center text-[10px] text-slate-400 flex flex-col items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Aguardando Execução do Fluxo</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs space-y-1 bg-slate-950/50 p-2 rounded border border-slate-800 mt-2">
          <div className="text-[10px] text-amber-500 flex items-center gap-1 py-1 font-medium">
            <AlertTriangle size={12} />
            <span>Conectar a um nó de NDVI</span>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-slate-900" />
    </div>
  );
});

export const AnalysisBoxplotNode = memo(({ id, selected, data }: any) => {
  const { getNodes, getEdges } = useReactFlow();
  const ndviData = getNdviDataForNode(id, getNodes, getEdges);
  const isConnected = ndviData.length > 0;
  const isExecuted = data?.isExecuted || false;

  const renderBoxplot = () => {
    if (!isConnected) return null;
    const width = 200;
    const rowHeight = 24;
    const headerHeight = 15;
    const paddingLeft = 45;
    const paddingRight = 10;
    const height = headerHeight + ndviData.length * rowHeight + 10;

    const chartWidth = width - paddingLeft - paddingRight;
    const getX = (val: number) => {
      const clamped = Math.min(1.0, Math.max(0.0, val));
      return paddingLeft + clamped * chartWidth;
    };

    return (
      <svg width={width} height={height} className="mt-2 bg-slate-950/40 rounded border border-slate-800/60 p-1">
        {[0, 0.5, 1.0].map((val, idx) => {
          const x = getX(val);
          return (
            <g key={idx}>
              <line x1={x} y1={headerHeight} x2={x} y2={height - 10} stroke="#334155" strokeWidth="0.5" strokeDasharray="1,2" />
              <text x={x} y={10} fill="#64748b" fontSize="8" textAnchor="middle">{val}</text>
            </g>
          );
        })}

        {ndviData.map((area: any, idx: number) => {
          const bp = area.boxplot;
          const y = headerHeight + idx * rowHeight + 12;
          const boxHeight = 10;
          
          return (
            <g key={idx}>
              <text 
                x={paddingLeft - 5} 
                y={y + 3} 
                fill="#94a3b8" 
                fontSize="8" 
                textAnchor="end" 
                className="font-semibold"
              >
                {area.name.length > 7 ? `${area.name.substring(0, 6)}…` : area.name}
                <title>{area.name}</title>
              </text>

              <line 
                x1={getX(bp.min)} 
                y1={y} 
                x2={getX(bp.max)} 
                y2={y} 
                stroke="#64748b" 
                strokeWidth="1.5" 
              />
              
              <line 
                x1={getX(bp.min)} 
                y1={y - boxHeight / 2} 
                x2={getX(bp.min)} 
                y2={y + boxHeight / 2} 
                stroke="#64748b" 
                strokeWidth="1.5" 
              />
              
              <line 
                x1={getX(bp.max)} 
                y1={y - boxHeight / 2} 
                x2={getX(bp.max)} 
                y2={y + boxHeight / 2} 
                stroke="#64748b" 
                strokeWidth="1.5" 
              />

              <rect 
                x={getX(bp.q1)} 
                y={y - boxHeight / 2} 
                width={getX(bp.q3) - getX(bp.q1)} 
                height={boxHeight} 
                fill={area.color} 
                fillOpacity="0.4"
                stroke={area.color} 
                strokeWidth="1.5" 
                rx="1"
              />

              <line 
                x1={getX(bp.median)} 
                y1={y - boxHeight / 2} 
                x2={getX(bp.median)} 
                y2={y + boxHeight / 2} 
                stroke="#ffffff" 
                strokeWidth="1.5" 
              />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-fuchsia-500/20' : 'border-fuchsia-500'} text-white min-w-[220px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center mb-1">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-fuchsia-500/20 text-fuchsia-500 mr-2">
          <Activity size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis</div>
          <div className="text-sm font-bold">Dispersão Boxplot</div>
        </div>
      </div>

      {isConnected ? (
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium">Distribuição do NDVI (Min / Q1 / Med / Q3 / Max):</span>
          {isExecuted ? (
            renderBoxplot()
          ) : (
            <div className="mt-2 bg-slate-950/40 rounded border border-slate-800/60 p-4 text-center text-[10px] text-slate-400 flex flex-col items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Aguardando Execução do Fluxo</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs space-y-1 bg-slate-950/50 p-2 rounded border border-slate-800 mt-2">
          <div className="text-[10px] text-amber-500 flex items-center gap-1 py-1 font-medium">
            <AlertTriangle size={12} />
            <span>Conectar a um nó de NDVI</span>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-fuchsia-500 border-2 border-slate-900" />
    </div>
  );
});

export const AnalysisBarNode = memo(({ id, selected, data }: any) => {
  const { getNodes, getEdges } = useReactFlow();
  const ndviData = getNdviDataForNode(id, getNodes, getEdges);
  const isConnected = ndviData.length > 0;
  const isExecuted = data?.isExecuted || false;

  const renderBarChart = () => {
    if (!isConnected) return null;
    const width = 200;
    const height = 95;
    const paddingLeft = 20;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const barSpacing = 8;
    const barWidth = Math.max(12, Math.min(28, (chartWidth / ndviData.length) - barSpacing));
    const totalBarsWidth = ndviData.length * (barWidth + barSpacing) - barSpacing;
    const startX = paddingLeft + (chartWidth - totalBarsWidth) / 2;

    const getY = (val: number) => {
      const clamped = Math.min(1.0, Math.max(0.0, val));
      return paddingTop + chartHeight - (clamped * chartHeight);
    };

    return (
      <svg width={width} height={height} className="mt-2 bg-slate-950/40 rounded border border-slate-800/60 p-1">
        {[0, 0.5, 1.0].map((val, idx) => {
          const y = getY(val);
          return (
            <g key={idx}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="1,2" />
              <text x={paddingLeft - 4} y={y + 3} fill="#64748b" fontSize="8" textAnchor="end">{val}</text>
            </g>
          );
        })}

        {ndviData.map((area: any, idx: number) => {
          const x = startX + idx * (barWidth + barSpacing);
          const y = getY(area.currentNdvi);
          const barHeight = Math.max(2, paddingTop + chartHeight - y);

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={area.color}
                rx="1.5"
              >
                <title>{`${area.name}: ${area.currentNdvi} (${area.classification})`}</title>
              </rect>
              <text
                x={x + barWidth / 2}
                y={height - 5}
                fill="#94a3b8"
                fontSize="7"
                textAnchor="middle"
                className="font-bold"
              >
                {area.name.length > 5 ? `${area.name.substring(0, 4)}…` : area.name}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-orange-500/20' : 'border-orange-500'} text-white min-w-[220px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center mb-1">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-orange-500/20 text-orange-500 mr-2">
          <BarChart3 size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Analysis</div>
          <div className="text-sm font-bold">Gráfico de Barra</div>
        </div>
      </div>

      {isConnected ? (
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium">NDVI Atual por Área:</span>
          {isExecuted ? (
            renderBarChart()
          ) : (
            <div className="mt-2 bg-slate-950/40 rounded border border-slate-800/60 p-4 text-center text-[10px] text-slate-400 flex flex-col items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Aguardando Execução do Fluxo</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs space-y-1 bg-slate-950/50 p-2 rounded border border-slate-800 mt-2">
          <div className="text-[10px] text-amber-500 flex items-center gap-1 py-1 font-medium">
            <AlertTriangle size={12} />
            <span>Conectar a um nó de NDVI</span>
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500 border-2 border-slate-900" />
    </div>
  );
});

export const getEmailBodyForNode = (nodeId: string, getNodes: () => any[], getEdges: () => any[]) => {
  const nodes = getNodes();
  const edges = getEdges();
  
  const getUpstreamNdviData = (startNodeId: string): any[] => {
    const incomingEdges = edges.filter(e => e.target === startNodeId);
    const sources = incomingEdges.map(e => nodes.find(n => n.id === e.source)).filter(Boolean);
    
    const ndviNode = sources.find(n => n.type === 'ndvi');
    if (ndviNode) {
      return getNdviDataForNode(ndviNode.id, getNodes, getEdges);
    }
    
    for (const src of sources) {
      const ndviData = getNdviDataForNode(src.id, getNodes, getEdges);
      if (ndviData.length > 0) {
        return ndviData;
      }
    }
    
    for (const src of sources) {
      const recursiveData = getUpstreamNdviData(src.id);
      if (recursiveData.length > 0) {
        return recursiveData;
      }
    }
    
    return [];
  };

  const ndviData = getUpstreamNdviData(nodeId);
  if (ndviData.length === 0) return "";

  const selfNode = nodes.find(n => n.id === nodeId);
  const recipient = selfNode?.data?.config?.to || "produtor@agroflow.com";
  const subject = selfNode?.data?.config?.subject || "Relatório de Monitoramento NDVI - AgroFlow";
  
  const hasLowNdvi = ndviData.some((d: any) => d.currentNdvi < 0.3);

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b; text-align: left;">
      <div style="background-color: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.05em;">AgroFlow</h1>
        <p style="color: #10b981; margin: 5px 0 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase;">Relatório Executivo de Saúde Vegetal</p>
      </div>
      
      <div style="padding: 24px 20px;">
        <h2 style="color: #0f172a; margin-top: 0; font-size: 16px; font-weight: bold; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Monitoramento NDVI</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #475569;">
          Olá, este é o relatório automatizado gerado pelo seu fluxo de trabalho AgroFlow.
        </p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; text-align: left; font-weight: bold; color: #475569;">Área / Talhão</th>
              <th style="padding: 10px; text-align: center; font-weight: bold; color: #475569;">NDVI Médio</th>
              <th style="padding: 10px; text-align: right; font-weight: bold; color: #475569;">Classificação</th>
            </tr>
          </thead>
          <tbody>
            ${ndviData.map((d: any) => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px; font-weight: 600; color: #334155;">${d.name}</td>
                <td style="padding: 10px; text-align: center; font-weight: bold; color: ${d.color};">${d.currentNdvi}</td>
                <td style="padding: 10px; text-align: right; font-weight: 600; color: ${d.color};">${d.classification}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div style="margin-top: 25px; padding: 15px; border-radius: 8px; background-color: ${hasLowNdvi ? '#fffbeb' : '#ecfdf5'}; border: 1px solid ${hasLowNdvi ? '#fef3c7' : '#d1fae5'};">
          <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 14px; font-weight: bold; color: ${hasLowNdvi ? '#b45309' : '#047857'};">
            ${hasLowNdvi ? '⚠️ Recomendações Críticas' : '✅ Status Saudável'}
          </h3>
          <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${hasLowNdvi ? '#d97706' : '#065f46'};">
            ${hasLowNdvi 
              ? 'Atenção: Um ou mais talhões apresentam NDVI crítico (menor que 0.3), indicando solo exposto ou vegetação rala/sofrida. Recomenda-se realizar verificação presencial para avaliar necessidades de irrigação e nutrientes.'
              : 'Excelente! Todos os talhões monitorados encontram-se em condições vegetativas estáveis e saudáveis. Nenhuma ação imediata é necessária.'
            }
          </p>
        </div>
      </div>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8;">
        Este e-mail é gerado automaticamente pelo motor do AgroFlow. Não responda a este endereço.
      </div>
    </div>
  `;
};

export const EmailNode = memo(({ id, selected, data }: any) => {
  const { getNodes, getEdges } = useReactFlow();
  const emailBody = getEmailBodyForNode(id, getNodes, getEdges);
  const isConnected = emailBody.length > 0;
  const isExecuted = data?.isExecuted || false;

  return (
    <div className={`px-4 py-3 shadow-md rounded-md bg-slate-900 border-2 ${selected ? 'border-primary-500 shadow-lg shadow-purple-500/20' : 'border-purple-500'} text-white min-w-[200px]`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-slate-500 border-2 border-slate-900" />
      <div className="flex items-center mb-2">
        <div className="rounded-full w-8 h-8 flex items-center justify-center bg-purple-500/20 text-purple-500 mr-2">
          <Mail size={16} />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Action</div>
          <div className="text-sm font-bold">Email Node</div>
        </div>
      </div>
      
      <div className="text-xs space-y-1 bg-slate-950/50 p-2 rounded border border-slate-800">
        {isConnected ? (
          isExecuted ? (
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-[10px]">
                <span className="text-slate-400">Status:</span>
                <span className="text-purple-400">Corpo Gerado</span>
              </div>
              <div className="text-[9px] text-slate-500 truncate">
                Para: {data.config?.to || 'produtor@agroflow.com'}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5 py-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span>Aguardando Execução...</span>
            </div>
          )
        ) : (
          <div className="text-[10px] text-amber-500 flex items-center gap-1 py-1 font-medium">
            <AlertTriangle size={12} />
            <span>Conectar a NDVI ou Análise</span>
          </div>
        )}
      </div>
    </div>
  );
});
