import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  ReactFlowProvider,
  Node,
  Edge,
  Connection,
  ConnectionLineType,
  BackgroundVariant,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Play, Save, Plus, AlertCircle, Terminal, Info, Copy, Clipboard, Trash2, Clock, StopCircle, Map as MapIcon, Leaf, TrendingUp, BarChart3, Activity, Mail } from 'lucide-react';
import api from '../api/apiClient';
import toast from 'react-hot-toast';
import { TriggerNode, ActionNode, ScheduleNode, AreasNode, NdviNode, AnalysisTemporalNode, AnalysisBoxplotNode, AnalysisBarNode, EmailNode, getNdviDataForNode, getEmailBodyForNode } from '../components/CustomNodes';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as toGeoJSON from '@tmcw/togeojson';
// @ts-ignore
import shp from 'shpjs';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  schedule: ScheduleNode,
  areas: AreasNode,
  ndvi: NdviNode,
  analysis_temporal: AnalysisTemporalNode,
  analysis_boxplot: AnalysisBoxplotNode,
  analysis_bar: AnalysisBarNode,
  email: EmailNode,
};

const RawLeafletMap = ({ data }: { data: any }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      mapRef.current = L.map(containerRef.current, { 
        zoomControl: false,
        attributionControl: false 
      }).setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
    }
    
    const map = mapRef.current;
    if (map) {
      if (geoJsonLayerRef.current) {
        map.removeLayer(geoJsonLayerRef.current);
        geoJsonLayerRef.current = null;
      }
      
      if (data && data.features && data.features.length > 0) {
        try {
          const layer = L.geoJSON(data, {
            style: { color: '#3b82f6', weight: 2, fillOpacity: 0.3 }
          }).addTo(map);
          geoJsonLayerRef.current = layer;
          
          if (layer.getLayers().length > 0) {
            map.fitBounds(layer.getBounds(), { padding: [20, 20] });
          }
        } catch (e) {
          console.error("Failed to update map", e);
        }
      }
    }
    
    return () => {
      // We don't necessarily want to destroy the map on every re-render of data, 
      // but we might want to on unmount.
    };
  }, [data]);

  // Handle unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

// Memoized Sub-components to prevent re-renders during node dragging
const EditorHeader = React.memo(({ workflowName, executing, handleExecute, handleCopy, handlePaste, selectedNode, clipboard, navigate }: any) => (
  <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between z-20">
    <div className="flex items-center gap-4">
      <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
        <ArrowLeft size={20} />
      </button>
      <div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          {workflowName || 'Workflow Editor'}
        </h1>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-tighter text-slate-500 font-bold">
          <span className="text-blue-500">Auto-save active</span>
          <span>•</span>
          <span>SQLite DB</span>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 mr-2">
        <button
          onClick={handleCopy}
          disabled={!selectedNode || executing}
          className="p-2.5 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-all active:scale-90"
          title="Copy Node (Ctrl+C)"
        >
          <Copy size={18} />
        </button>
        <button
          onClick={handlePaste}
          disabled={!clipboard || executing}
          className="p-2.5 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-all active:scale-90"
          title="Paste Node (Ctrl+V)"
        >
          <Clipboard size={18} />
        </button>
      </div>

      <button 
        onClick={() => handleExecute()}
        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black transition-all shadow-lg active:scale-95 ${
          executing 
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20' 
            : 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/20'
        }`}
      >
        {executing ? (
          <StopCircle size={20} />
        ) : (
          <Play size={20} fill="currentColor" />
        )}
        {executing ? 'STOP TEST' : 'EXECUTE TEST'}
      </button>
    </div>
  </header>
));

const SidebarItem = React.memo(({ type, actionType, icon: Icon, title, description, colorClass, hoverClass }: any) => (
  <div 
    draggable 
    onDragStart={(e) => {
      e.dataTransfer.setData('application/nodeType', type);
      e.dataTransfer.setData('application/actionType', actionType);
    }}
    className={`p-4 bg-slate-800/80 border border-slate-700/50 rounded-xl cursor-grab hover:border-${hoverClass} group`}
  >
    <div className={`flex items-center gap-3 text-${colorClass} mb-1`}>
      <Icon size={18} />
      <span className="font-bold">{title}</span>
    </div>
    <p className="text-xs text-slate-500">{description}</p>
  </div>
));

const NodeConfigPanel = React.memo(({ selectedNode, onSave, onDelete, onClose }: any) => {
  const [localConfig, setLocalConfig] = useState(selectedNode?.data.config || {});
  const { getNodes, getEdges } = useReactFlow();

  useEffect(() => {
    setLocalConfig(selectedNode?.data.config || {});
  }, [selectedNode?.id]);

  const ndviData = selectedNode ? getNdviDataForNode(selectedNode.id, getNodes, getEdges) : [];
  const isConnected = ndviData.length > 0;
  const isExecuted = selectedNode?.data?.isExecuted || false;
  const emailBody = selectedNode && selectedNode.data.category === 'email' ? getEmailBodyForNode(selectedNode.id, getNodes, getEdges) : '';
  const isEmailConnected = emailBody.length > 0;

  const renderLargeTemporalChart = () => {
    if (!isConnected) return <p className="text-xs text-amber-500">Nenhum dado de NDVI disponível. Conecte a um nó de NDVI.</p>;
    if (!isExecuted) return <p className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 text-center font-medium">Aguardando execução do workflow para exibir o gráfico.</p>;

    const width = 270;
    const height = 150;
    const paddingLeft = 30;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    const months = ndviData[0]?.temporalSeries.map((t: any) => t.date) || [];
    const pointsCount = months.length;
    
    const getX = (index: number) => paddingLeft + index * (chartWidth / Math.max(1, pointsCount - 1));
    const getY = (val: number) => {
      const clamped = Math.min(1.0, Math.max(0.0, val));
      return paddingTop + chartHeight - (clamped * chartHeight);
    };

    return (
      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 mt-2">
        <svg width={width} height={height}>
          {[0, 0.25, 0.5, 0.75, 1.0].map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
                <text x={paddingLeft - 5} y={y + 3} fill="#64748b" fontSize="8" textAnchor="end">{val}</text>
              </g>
            );
          })}
          
          {ndviData.map((area: any, areaIdx: number) => {
            const points = area.temporalSeries.map((p: any, idx: number) => {
              return `${getX(idx)},${getY(p.ndvi)}`;
            }).join(' ');
            
            return (
              <g key={areaIdx}>
                <polyline fill="none" stroke={area.color} strokeWidth="2" points={points} />
                {area.temporalSeries.map((p: any, idx: number) => (
                  <circle key={idx} cx={getX(idx)} cy={getY(p.ndvi)} r="3" fill="#0f172a" stroke={area.color} strokeWidth="2" />
                ))}
              </g>
            );
          })}

          {months.map((m, idx) => {
            if (pointsCount === 12 && idx % 2 !== 0) return null;
            return (
              <text key={idx} x={getX(idx)} y={height - 5} fill="#64748b" fontSize="8" textAnchor="middle">{m}</text>
            );
          })}
        </svg>
        
        <div className="mt-2 flex flex-wrap gap-2 max-h-[60px] overflow-y-auto pt-1 border-t border-slate-800/60">
          {ndviData.map((area: any, idx: number) => (
            <div key={idx} className="flex items-center gap-1 text-[10px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />
              <span className="text-slate-400 font-semibold truncate max-w-[80px]">{area.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLargeBoxplot = () => {
    if (!isConnected) return <p className="text-xs text-amber-500">Nenhum dado de NDVI disponível. Conecte a um nó de NDVI.</p>;
    if (!isExecuted) return <p className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 text-center font-medium">Aguardando execução do workflow para exibir o gráfico.</p>;

    const width = 270;
    const rowHeight = 30;
    const headerHeight = 20;
    const paddingLeft = 60;
    const paddingRight = 15;
    const height = headerHeight + ndviData.length * rowHeight + 15;

    const chartWidth = width - paddingLeft - paddingRight;
    const getX = (val: number) => {
      const clamped = Math.min(1.0, Math.max(0.0, val));
      return paddingLeft + clamped * chartWidth;
    };

    return (
      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 mt-2 max-h-[260px] overflow-y-auto custom-scrollbar">
        <svg width={width} height={height}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((val, idx) => {
            const x = getX(val);
            return (
              <g key={idx}>
                <line x1={x} y1={headerHeight} x2={x} y2={height - 15} stroke="#334155" strokeWidth="0.5" strokeDasharray="1,2" />
                <text x={x} y={12} fill="#64748b" fontSize="8" textAnchor="middle">{val}</text>
              </g>
            );
          })}

          {ndviData.map((area: any, idx: number) => {
            const bp = area.boxplot;
            const y = headerHeight + idx * rowHeight + 15;
            const boxHeight = 12;
            
            return (
              <g key={idx}>
                <text 
                  x={paddingLeft - 8} 
                  y={y + 3} 
                  fill="#94a3b8" 
                  fontSize="9" 
                  textAnchor="end" 
                  className="font-bold truncate"
                >
                  {area.name.length > 9 ? `${area.name.substring(0, 8)}…` : area.name}
                  <title>{area.name}</title>
                </text>

                <line x1={getX(bp.min)} y1={y} x2={getX(bp.max)} y2={y} stroke="#64748b" strokeWidth="1.5" />
                <line x1={getX(bp.min)} y1={y - boxHeight / 2} x2={getX(bp.min)} y2={y + boxHeight / 2} stroke="#64748b" strokeWidth="1.5" />
                <line x1={getX(bp.max)} y1={y - boxHeight / 2} x2={getX(bp.max)} y2={y + boxHeight / 2} stroke="#64748b" strokeWidth="1.5" />

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

                <line x1={getX(bp.median)} y1={y - boxHeight / 2} x2={getX(bp.median)} y2={y + boxHeight / 2} stroke="#ffffff" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderLargeBarChart = () => {
    if (!isConnected) return <p className="text-xs text-amber-500">Nenhum dado de NDVI disponível. Conecte a um nó de NDVI.</p>;
    if (!isExecuted) return <p className="text-xs text-slate-500 bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 text-center font-medium">Aguardando execução do workflow para exibir o gráfico.</p>;

    const width = 270;
    const height = 150;
    const paddingLeft = 30;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const barSpacing = 10;
    const barWidth = Math.max(15, Math.min(35, (chartWidth / ndviData.length) - barSpacing));
    const totalBarsWidth = ndviData.length * (barWidth + barSpacing) - barSpacing;
    const startX = paddingLeft + (chartWidth - totalBarsWidth) / 2;

    const getY = (val: number) => {
      const clamped = Math.min(1.0, Math.max(0.0, val));
      return paddingTop + chartHeight - (clamped * chartHeight);
    };

    return (
      <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 mt-2">
        <svg width={width} height={height}>
          {[0, 0.25, 0.5, 0.75, 1.0].map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#334155" strokeWidth="0.5" strokeDasharray="1,2" />
                <text x={paddingLeft - 5} y={y + 3} fill="#64748b" fontSize="8" textAnchor="end">{val}</text>
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
                  rx="2"
                  className="transition-all duration-300 hover:brightness-110"
                />
                <text
                  x={x + barWidth / 2}
                  y={height - 10}
                  fill="#94a3b8"
                  fontSize="8"
                  textAnchor="middle"
                  className="font-bold"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-2 flex flex-col gap-1 max-h-[70px] overflow-y-auto pt-1 border-t border-slate-800/60 text-[10px]">
          {ndviData.map((area: any, idx: number) => (
            <div key={idx} className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1.5 font-medium truncate max-w-[170px]">
                <span className="w-2.5 h-2.5 text-center flex items-center justify-center font-bold text-[8px] bg-slate-800 rounded border border-slate-700 text-slate-300">{idx + 1}</span>
                {area.name}
              </span>
              <span className="font-bold" style={{ color: area.color }}>{area.currentNdvi} ({area.classification})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.kml')) {
      reader.onload = (event) => {
        try {
          const kmlContent = event.target?.result as string;
          const parser = new DOMParser();
          const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
          const geoJson = toGeoJSON.kml(kmlDoc);
          setLocalConfig({ ...localConfig, areasData: geoJson });
          toast.success('KML parsed correctly');
        } catch (err) {
          toast.error('Failed to parse KML');
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.zip')) {
      reader.onload = async (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const geoJson = await shp(buffer);
          setLocalConfig({ ...localConfig, areasData: geoJson });
          toast.success('Shapefile (ZIP) parsed correctly');
        } catch (err) {
          toast.error('Failed to parse Shapefile ZIP');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error('Unsupported format. Use .kml or .zip for Shapefiles');
    }
  };

  if (!selectedNode) return null;

  const isTrigger = selectedNode.data.category === 'trigger';
  const isSchedule = selectedNode.data.category === 'schedule';
  const isAreas = selectedNode.data.category === 'areas';
  const isNdvi = selectedNode.data.category === 'ndvi';
  const isAnalysisTemporal = selectedNode.data.category === 'analysis_temporal';
  const isAnalysisBoxplot = selectedNode.data.category === 'analysis_boxplot';
  const isAnalysisBar = selectedNode.data.category === 'analysis_bar';
  const isEmail = selectedNode.data.category === 'email';

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900 p-6 overflow-y-auto animate-in slide-in-from-right duration-200 shadow-2xl z-20">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-lg font-bold">Node Config</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-2xl">×</button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(localConfig);
        }}
        className="space-y-6"
      >
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Category</label>
          <div className="px-3 py-2 bg-slate-800 rounded-lg text-slate-400 text-sm border border-slate-700">
            {selectedNode.data.category}
          </div>
        </div>

        {isSchedule && (
          <>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Interval Value</label>
              <input
                type="number"
                min="1"
                value={localConfig.intervalValue || 1}
                onChange={(e) => setLocalConfig({ ...localConfig, intervalValue: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Interval Unit</label>
              <select
                value={localConfig.intervalUnit || 'minutes'}
                onChange={(e) => setLocalConfig({ ...localConfig, intervalUnit: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              >
                <option value="seconds">Seconds (for test)</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </>
        )}

        {isAreas && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome da Área</label>
              <input
                type="text"
                value={localConfig.areaName || ''}
                onChange={(e) => setLocalConfig({ ...localConfig, areaName: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                placeholder="Ex: Talhão A, Fazenda Sul"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Upload Areas</label>
              <div className="p-4 bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl text-center">
                 <p className="text-[10px] text-slate-400 mb-3">
                   Accepts <b>.kml</b> or <b>.zip</b> (containing .shp, .dbf, .shx)
                 </p>
                 <input 
                   type="file" 
                   accept=".kml,.zip" 
                   onChange={handleFileUpload}
                   className="hidden" 
                   id="geo-upload"
                 />
                 <label 
                   htmlFor="geo-upload"
                   className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors inline-block"
                 >
                   Select File
                 </label>
              </div>
            </div>

            <div className="h-48 w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
               <RawLeafletMap data={localConfig.areasData} />
            </div>
          </div>
        )}

        {isNdvi && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Método de Cálculo</label>
              <select
                value={localConfig.ndviMethod || 'sentinel'}
                onChange={(e) => setLocalConfig({ ...localConfig, ndviMethod: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm mb-4"
              >
                <option value="sentinel">Sentinel-2 (Red-NIR)</option>
                <option value="landsat">Landsat-8 (Red-NIR)</option>
                <option value="simulation">Simulação Local</option>
              </select>

              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Range de Tempo (Histórico)</label>
              <select
                value={localConfig.periodMonths || 6}
                onChange={(e) => setLocalConfig({ ...localConfig, periodMonths: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              >
                <option value={3}>Últimos 3 meses</option>
                <option value={6}>Últimos 6 meses</option>
                <option value={12}>Último ano (12 meses)</option>
              </select>
            </div>
            <p className="text-xs text-slate-400">
              O processador NDVI calculará automaticamente os índices vegetativos de todas as feições geográficas conectadas no período histórico selecionado.
            </p>
            {isExecuted && isConnected && (
              <div className="space-y-4">
                {/* Visual Distribution Bar */}
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 mt-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Distribuição de Saúde</span>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                    {(() => {
                      const total = ndviData.length;
                      const counts = {
                        MuitoAlto: ndviData.filter((d: any) => d.classification === 'Muito Alto').length,
                        Alto: ndviData.filter((d: any) => d.classification === 'Alto').length,
                        Moderado: ndviData.filter((d: any) => d.classification === 'Moderado').length,
                        Baixo: ndviData.filter((d: any) => d.classification === 'Baixo').length,
                        Nulo: ndviData.filter((d: any) => d.classification === 'Nulo/Água').length,
                      };
                      return (
                        <>
                          {counts.MuitoAlto > 0 && <div className="h-full bg-[#047857]" style={{ width: `${(counts.MuitoAlto / total) * 100}%` }} title={`Muito Alto: ${counts.MuitoAlto}`} />}
                          {counts.Alto > 0 && <div className="h-full bg-[#10b981]" style={{ width: `${(counts.Alto / total) * 100}%` }} title={`Alto: ${counts.Alto}`} />}
                          {counts.Moderado > 0 && <div className="h-full bg-[#84cc16]" style={{ width: `${(counts.Moderado / total) * 100}%` }} title={`Moderado: ${counts.Moderado}`} />}
                          {counts.Baixo > 0 && <div className="h-full bg-[#eab308]" style={{ width: `${(counts.Baixo / total) * 100}%` }} title={`Baixo: ${counts.Baixo}`} />}
                          {counts.Nulo > 0 && <div className="h-full bg-[#3b82f6]" style={{ width: `${(counts.Nulo / total) * 100}%` }} title={`Nulo/Água: ${counts.Nulo}`} />}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400 flex-wrap gap-2">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#047857]" /> Muito Alto</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Alto</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]" /> Moderado</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" /> Baixo</span>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 mt-2 space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Resultados das Áreas</span>
                  {ndviData.map((area: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs font-semibold py-1 border-b border-slate-900 last:border-0 text-[10px]">
                      <span className="text-slate-400 truncate max-w-[130px]">{area.name}</span>
                      <span style={{ color: area.color }}>{area.currentNdvi} ({area.classification})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isConnected && !isExecuted && (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
                <p className="text-xs text-slate-500 font-medium">Aguardando execução do workflow para calcular o NDVI.</p>
              </div>
            )}
          </div>
        )}

        {isAnalysisTemporal && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Análise Temporal de NDVI</label>
              <div className="px-3 py-2 bg-slate-800 rounded-lg text-slate-400 text-xs border border-slate-700">
                Dados vinculados ao processador NDVI.
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Plota curvas temporais comparativas de NDVI obtidos a partir do nó NDVI conectado. O período histórico é herdado do nó de NDVI.
            </p>
            {renderLargeTemporalChart()}
          </div>
        )}

        {isAnalysisBoxplot && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Opções Estatísticas</label>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-outliers"
                  checked={localConfig.showOutliers ?? true}
                  onChange={(e) => setLocalConfig({ ...localConfig, showOutliers: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-900"
                />
                <label htmlFor="show-outliers" className="text-sm text-slate-300">Mostrar Outliers</label>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Exibe a distribuição de dispersão estatística (Mín, Q1, Mediana, Q3, Máx) do NDVI por talhão.
            </p>
            {renderLargeBoxplot()}
          </div>
        )}

        {isAnalysisBar && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Cor do Gráfico</label>
              <select
                value={localConfig.barColorTheme || 'emerald'}
                onChange={(e) => setLocalConfig({ ...localConfig, barColorTheme: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              >
                <option value="emerald">Verde Vegetação (Emerald)</option>
                <option value="blue">Azul Água (Sky)</option>
                <option value="orange">Laranja Solo (Orange)</option>
              </select>
            </div>
            <p className="text-xs text-slate-400">
              Exibe a comparação direta do nível médio atual de NDVI entre os talhões.
            </p>
            {renderLargeBarChart()}
          </div>
        )}

        {isEmail && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Destinatário (To)</label>
              <input
                type="email"
                value={localConfig.to || 'produtor@agroflow.com'}
                onChange={(e) => setLocalConfig({ ...localConfig, to: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm mb-4"
                placeholder="destinatario@agroflow.com"
              />

              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Assunto (Subject)</label>
              <input
                type="text"
                value={localConfig.subject || 'Relatório de Monitoramento NDVI - AgroFlow'}
                onChange={(e) => setLocalConfig({ ...localConfig, subject: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm"
              />
            </div>
            <p className="text-xs text-slate-400">
              Gera um relatório formatado em HTML com base nos dados vegetativos do fluxo conectado.
            </p>
            {isExecuted && isEmailConnected ? (
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Visualização do E-mail</span>
                <div 
                  className="bg-white rounded-xl border border-slate-700 overflow-hidden max-h-[350px] overflow-y-auto p-3 custom-scrollbar scale-95 origin-top text-black"
                  dangerouslySetInnerHTML={{ __html: emailBody }}
                />
              </div>
            ) : isEmailConnected && !isExecuted ? (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center">
                <p className="text-xs text-slate-500 font-medium">Aguardando execução do workflow para exibir o e-mail.</p>
              </div>
            ) : (
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 text-center text-amber-500 text-xs">
                <p className="font-medium">Nenhum dado recebido. Conecte o nó de e-mail ao NDVI ou a um nó de análise.</p>
              </div>
            )}
          </div>
        )}

        {!isTrigger && !isSchedule && !isAreas && !isNdvi && !isAnalysisTemporal && !isAnalysisBoxplot && !isAnalysisBar && !isEmail && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Message</label>
            <textarea
              value={localConfig.message || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, message: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm resize-none"
            />
          </div>
        )}

        <div className="pt-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-4">
            <Info size={14} />
            <span>Changes are saved locally first.</span>
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-500/20"
          >
            <Save size={18} /> Save Config
          </button>
          <button
            type="button"
            onClick={() => onDelete(selectedNode.id)}
            className="w-full mt-3 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Trash2 size={18} /> Delete Node
          </button>
        </div>
      </form>
    </aside>
  );
});
const LeftSidebar = React.memo(() => (
  <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6 z-10 flex flex-col overflow-y-auto">
    <div className="mb-8">
      <h2 className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-4">Triggers</h2>
      <div className="space-y-3">
        <SidebarItem 
          type="trigger" 
          actionType="button_trigger" 
          icon={Plus} 
          title="Button Trigger" 
          description="Starts execution manually" 
          colorClass="blue-400" 
          hoverClass="blue-500/50" 
        />
        <SidebarItem 
          type="schedule" 
          actionType="interval_trigger" 
          icon={Clock} 
          title="Schedule Trigger" 
          description="Run at specific intervals" 
          colorClass="blue-400" 
          hoverClass="blue-500/50" 
        />
      </div>
    </div>

    <div className="mb-8">
      <h2 className="text-xs font-bold text-green-500 uppercase tracking-widest mb-4">Actions</h2>
      <div className="space-y-3">
        <SidebarItem 
          type="action" 
          actionType="console_alert" 
          icon={AlertCircle} 
          title="Console Alert" 
          description="Shows an alert in console" 
          colorClass="green-400" 
          hoverClass="green-500/50" 
        />
        <SidebarItem 
          type="action" 
          actionType="print_log" 
          icon={Terminal} 
          title="Print Log" 
          description="Prints formatted log" 
          colorClass="green-400" 
          hoverClass="green-500/50" 
        />
        <SidebarItem 
          type="areas" 
          actionType="areas" 
          icon={MapIcon} 
          title="Areas" 
          description="Manage geographical areas" 
          colorClass="green-400" 
          hoverClass="green-500/50" 
        />
        <SidebarItem 
          type="email" 
          actionType="email" 
          icon={Mail} 
          title="Email Node" 
          description="Produces HTML report email" 
          colorClass="purple-400" 
          hoverClass="purple-500/50" 
        />
      </div>
    </div>

    <div className="mb-8">
      <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">NDVI & Análise</h2>
      <div className="space-y-3">
        <SidebarItem 
          type="ndvi" 
          actionType="ndvi" 
          icon={Leaf} 
          title="NDVI Node" 
          description="Processamento de NDVI" 
          colorClass="emerald-400" 
          hoverClass="emerald-500/50" 
        />
        <SidebarItem 
          type="analysis_temporal" 
          actionType="analysis_temporal" 
          icon={TrendingUp} 
          title="Análise Temporal" 
          description="Evolução temporal do NDVI" 
          colorClass="indigo-400" 
          hoverClass="indigo-500/50" 
        />
        <SidebarItem 
          type="analysis_boxplot" 
          actionType="analysis_boxplot" 
          icon={Activity} 
          title="Análise Boxplot" 
          description="Dispersão estatística" 
          colorClass="fuchsia-400" 
          hoverClass="fuchsia-500/50" 
        />
        <SidebarItem 
          type="analysis_bar" 
          actionType="analysis_bar" 
          icon={BarChart3} 
          title="Gráfico de Barras" 
          description="Comparativo de NDVI por área" 
          colorClass="orange-400" 
          hoverClass="orange-500/50" 
        />
      </div>
    </div>
    
    <div className="mt-auto pt-6 border-t border-slate-800 text-xs text-slate-500">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span>Canvas Sync Active</span>
      </div>
      <p>Drag nodes to add them to your workflow.</p>
    </div>
  </aside>
));

const WorkflowEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [executing, setExecuting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const testIntervalRef = useRef<any>(null);
  const [clipboard, setClipboard] = useState<Node | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const handleExecuteRef = useRef<any>(null);

  const loadWorkflow = async () => {
    try {
      const { data } = await api.get(`/workflows/${id}`);
      setWorkflowName(data.name);
      
      const flowNodes = data.nodes.map((n: any) => {
        const category = n.category;
        const config = JSON.parse(n.object);
        let type = 'action';
        let label = 'Print Log';
        
        if (category === 'trigger') {
          type = 'trigger';
          label = 'Button Trigger';
        } else if (category === 'schedule') {
          type = 'schedule';
          label = 'Schedule Trigger';
        } else if (category === 'areas') {
          type = 'areas';
          label = 'Areas Node';
        } else if (category === 'ndvi') {
          type = 'ndvi';
          label = 'NDVI Node';
        } else if (category === 'analysis_temporal') {
          type = 'analysis_temporal';
          label = 'Análise Temporal';
        } else if (category === 'analysis_boxplot') {
          type = 'analysis_boxplot';
          label = 'Análise Boxplot';
        } else if (category === 'analysis_bar') {
          type = 'analysis_bar';
          label = 'Gráfico de Barra';
        } else if (category === 'email') {
          type = 'email';
          label = 'Email Node';
        } else {
          label = config.type === 'console_alert' ? 'Console Alert' : 'Print Log';
        }

        return {
          id: n.id.toString(),
          type,
          position: { x: n.positionX, y: n.positionY },
          data: { 
            label,
            category,
            config,
            isExecuted: false,
            onExecute: category === 'trigger' ? () => handleExecuteRef.current?.(true) : undefined
          },
        };
      });

      const flowEdges = data.connections.map((c: any) => ({
        id: c.id.toString(),
        source: c.sourceNodeId.toString(),
        target: c.targetNodeId.toString(),
        animated: true,
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    } catch (error) {
      toast.error('Failed to load workflow');
    }
  };

  useEffect(() => {
    loadWorkflow();
    return () => {
      if (testIntervalRef.current) clearInterval(testIntervalRef.current);
    };
  }, [id]);

  const handleStopExecution = useCallback(() => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    setIsTesting(false);
    toast.success('Execution stopped');
  }, []);

  const handleExecute = useCallback(async (isManualCall = false) => {
    if (isManualCall) {
      try {
        await api.post(`/workflows/${id}/execute`);
        toast.success('Manual trigger fired!');
        setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, isExecuted: true } })));
      } catch (error) {
        toast.error('Trigger failed');
      }
      return;
    }

    const newState = !isTesting;
    setIsTesting(newState);
    
    try {
      await api.post(`/workflows/${id}/toggle-test?active=${newState}`);
      if (newState) {
        toast.success('Test mode activated. Scheduler is now running in backend.');
        setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, isExecuted: true } })));
      } else {
        toast.success('Test mode deactivated.');
        if (testIntervalRef.current) clearInterval(testIntervalRef.current);
        setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, isExecuted: false } })));
      }
    } catch (error) {
      toast.error('Failed to toggle test mode');
      setIsTesting(!newState);
    }
  }, [id, isTesting, setNodes]);

  useEffect(() => {
    handleExecuteRef.current = handleExecute;
  }, [handleExecute]);

  const onConnect = useCallback(
    async (params: Connection) => {
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      if (sourceNode?.type === 'trigger' && targetNode?.type === 'email') {
        toast.error('O nó de Gatilho de Botão não pode se conectar diretamente ao nó de E-mail.');
        return;
      }

      try {
        const { data } = await api.post('/connections', {
          sourceNodeId: parseInt(params.source!),
          targetNodeId: parseInt(params.target!),
          workflowId: parseInt(id!),
          path: '[]'
        });
        setEdges((eds) => addEdge({ ...params, id: data.id.toString(), animated: true }, eds));
        toast.success('Connection created');
      } catch (error) {
        toast.error('Failed to create connection');
      }
    },
    [id, setEdges, nodes]
  );

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);
      if (sourceNode?.type === 'trigger' && targetNode?.type === 'email') {
        return false;
      }
      return true;
    },
    [nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/nodeType');
      const actionType = event.dataTransfer.getData('application/actionType');

      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let nodeConfig: any = {};
      let label = 'Print Log';

      if (type === 'trigger') {
        nodeConfig = { type: 'button_trigger' };
        label = 'Button Trigger';
      } else if (type === 'schedule') {
        nodeConfig = { type: 'interval_trigger', intervalValue: 1, intervalUnit: 'minutes' };
        label = 'Schedule Trigger';
      } else if (type === 'areas') {
        nodeConfig = { type: 'areas', areasData: null, areaName: 'Nova Área' };
        label = 'Areas Node';
      } else if (type === 'ndvi') {
        nodeConfig = { type: 'ndvi', ndviMethod: 'sentinel' };
        label = 'NDVI Node';
      } else if (type === 'analysis_temporal') {
        nodeConfig = { type: 'analysis_temporal', periodMonths: 6 };
        label = 'Análise Temporal';
      } else if (type === 'analysis_boxplot') {
        nodeConfig = { type: 'analysis_boxplot', showOutliers: true };
        label = 'Análise Boxplot';
      } else if (type === 'analysis_bar') {
        nodeConfig = { type: 'analysis_bar', barColorTheme: 'emerald' };
        label = 'Gráfico de Barra';
      } else if (type === 'email') {
        nodeConfig = { type: 'email', to: 'produtor@agroflow.com', subject: 'Relatório de Monitoramento NDVI - AgroFlow' };
        label = 'Email Node';
      } else {
        nodeConfig = { type: actionType, message: 'New Message' };
        label = actionType === 'console_alert' ? 'Console Alert' : 'Print Log';
      }

      const tempId = `temp-${Date.now()}`;
      const newNode: Node = {
        id: tempId,
        type,
        position,
        data: { 
          label,
          category: type,
          config: nodeConfig,
          isExecuted: false,
          onExecute: type === 'trigger' ? () => handleExecuteRef.current?.(true) : undefined
        },
      };

      setNodes((nds) => [...nds, newNode]);

      try {
        const { data } = await api.post('/nodes', {
          category: type,
          object: JSON.stringify(nodeConfig),
          positionX: position.x,
          positionY: position.y,
          workflowId: parseInt(id!)
        });

        // Update the temporary ID with the real ID from the server
        setNodes((nds) => 
          nds.map(n => n.id === tempId ? { ...n, id: data.id.toString() } : n)
        );
        toast.success('Node added');
      } catch (error) {
        setNodes((nds) => nds.filter(n => n.id !== tempId));
        toast.error('Failed to add node');
      }
    },
    [reactFlowInstance, id, setNodes]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleSaveNodeConfig = useCallback(async (newConfig: any) => {
    if (!selectedNode) return;

    try {
      await api.put(`/nodes/${selectedNode.id}`, {
        id: parseInt(selectedNode.id),
        category: selectedNode.data.category,
        object: JSON.stringify(newConfig),
        positionX: selectedNode.position.x,
        positionY: selectedNode.position.y,
        workflowId: parseInt(id!)
      });
      
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id ? { ...node, data: { ...node.data, config: newConfig } } : node
        )
      );
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, config: newConfig } } : null);
      toast.success('Node updated');
    } catch (error) {
      toast.error('Failed to update node');
    }
  }, [selectedNode, id, setNodes]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    try {
      await api.delete(`/nodes/${nodeId}`);
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(prev => prev?.id === nodeId ? null : prev);
      toast.success('Node deleted');
    } catch (error) {
      toast.error('Failed to delete node');
    }
  }, [setNodes, setEdges, id]);

  const handleCopy = useCallback(() => {
    if (selectedNode) {
      setClipboard(selectedNode);
      toast.success('Node copied to clipboard');
    } else {
      toast.error('Please select a node to copy');
    }
  }, [selectedNode]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !reactFlowInstance) return;

    const position = {
      x: clipboard.position.x + 50,
      y: clipboard.position.y + 50,
    };

    try {
      const { data } = await api.post('/nodes', {
        category: clipboard.data.category,
        object: JSON.stringify(clipboard.data.config),
        positionX: position.x,
        positionY: position.y,
        workflowId: parseInt(id!)
      });

      const newNode = {
        id: data.id.toString(),
        type: clipboard.type,
        position,
        data: { 
          ...clipboard.data,
          isExecuted: false,
          onExecute: clipboard.data.category === 'trigger' ? () => handleExecuteRef.current?.(true) : undefined
        },
      };

      setNodes((nds) => [...nds, newNode]);
      toast.success('Node pasted');
    } catch (error) {
      toast.error('Failed to paste node');
    }
  }, [clipboard, reactFlowInstance, id, setNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode) handleDeleteNode(selectedNode.id);
      }
      
      if (e.ctrlKey && e.key === 'c') {
        handleCopy();
      }
      
      if (e.ctrlKey && e.key === 'v') {
        handlePaste();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, clipboard, reactFlowInstance, handleDeleteNode, handleCopy, handlePaste]);

  const onNodeDragStop = useCallback(async (_: any, node: Node) => {
    try {
      await api.put(`/nodes/${node.id}`, {
        id: parseInt(node.id),
        category: node.data.category,
        object: JSON.stringify(node.data.config),
        positionX: node.position.x,
        positionY: node.position.y,
        workflowId: parseInt(id!)
      });
    } catch (error) {
      console.error('Failed to sync node position');
    }
  }, [id]);

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-200 overflow-hidden relative">
      <EditorHeader 
        workflowName={workflowName}
        executing={executing || isTesting}
        handleExecute={handleExecute}
        handleCopy={handleCopy}
        handlePaste={handlePaste}
        selectedNode={selectedNode}
        clipboard={clipboard}
        navigate={navigate}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className={`h-full flex flex-col ${isTesting ? 'opacity-50 pointer-events-none grayscale transition-all' : ''}`}>
          <LeftSidebar />
        </div>

        {/* Canvas Area */}
        <div 
          className={`flex-1 relative transition-all duration-500 overflow-hidden ${isTesting ? 'test-mode-active bg-slate-950/40 ring-4 ring-blue-500/20' : ''}`} 
          ref={reactFlowWrapper}
        >
          {isTesting && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
              <div className="px-6 py-3 bg-slate-900/90 backdrop-blur-xl border border-blue-500/50 rounded-2xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)] flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping absolute opacity-75" />
                    <div className="w-3 h-3 bg-blue-500 rounded-full relative shadow-lg shadow-blue-500/50" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] text-blue-400 uppercase tracking-[0.2em]">Live Test Mode</span>
                    <span className="text-xs text-slate-400 font-medium tracking-tight">Backend scheduler active • Canvas locked</span>
                  </div>
                </div>
                <div className="h-8 w-[1px] bg-slate-800" />
                <div className="flex items-center gap-2">
                   <div className="flex -space-x-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-5 h-5 rounded-full border-2 border-slate-900 bg-blue-500/20 flex items-center justify-center">
                           <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                        </div>
                      ))}
                   </div>
                   <span className="text-[10px] font-bold text-slate-500 uppercase">Polling backend...</span>
                </div>
                <div className="h-8 w-[1px] bg-slate-800" />
                <button 
                  onClick={() => handleExecute()}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-red-500/20 active:scale-95"
                >
                  <StopCircle size={16} /> Stop Test
                </button>
              </div>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            fitView
            style={{
              transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: true,
              style: { strokeWidth: 2, stroke: '#38bdf8' }
            }}
            colorMode="dark"
            nodeDragThreshold={0}
            onlyRenderVisibleElements={true}
            translateExtent={[[-10000, -10000], [10000, 10000]]}
            selectNodesOnDrag={false}
            // Interactive Lock during Test Mode
            nodesDraggable={!isTesting}
            nodesConnectable={!isTesting}
            elementsSelectable={!isTesting}
            zoomOnScroll={true}
            panOnDrag={true}
          >
            <Background color="#1e293b" gap={20} variant={BackgroundVariant.Dots} />
            <Controls className="!bg-slate-800 !border-slate-700 !fill-slate-300 !shadow-none" />
            <MiniMap 
              className="!bg-slate-900 !border-slate-800 !rounded-xl !overflow-hidden" 
              nodeColor="#38bdf8" 
              maskColor="rgba(15, 23, 42, 0.7)" 
            />
          </ReactFlow>
        </div>

        <div className={`h-full flex flex-col ${isTesting ? 'opacity-50 pointer-events-none' : ''}`}>
          <NodeConfigPanel 
            selectedNode={nodes.find(n => n.id === selectedNode?.id) || selectedNode}
            onSave={handleSaveNodeConfig}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      </div>
    </div>
  );
};

const WorkflowPage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <WorkflowEditor />
    </ReactFlowProvider>
  );
};

export default WorkflowPage;
