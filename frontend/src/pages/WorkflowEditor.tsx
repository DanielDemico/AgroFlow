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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Play, Save, Plus, AlertCircle, Terminal, Info, Copy, Clipboard, Trash2, Clock, StopCircle } from 'lucide-react';
import api from '../api/apiClient';
import toast from 'react-hot-toast';
import { TriggerNode, ActionNode, ScheduleNode } from '../components/CustomNodes';

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  schedule: ScheduleNode,
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

  useEffect(() => {
    setLocalConfig(selectedNode?.data.config || {});
  }, [selectedNode?.id]);

  if (!selectedNode) return null;

  const isTrigger = selectedNode.data.category === 'trigger';
  const isSchedule = selectedNode.data.category === 'schedule';

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

        {!isTrigger && !isSchedule && (
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

  const loadWorkflow = async () => {
    try {
      const { data } = await api.get(`/workflows/${id}`);
      setWorkflowName(data.name);
      
      const flowNodes = data.nodes.map((n: any) => ({
        id: n.id.toString(),
        type: n.category === 'trigger' ? 'trigger' : (n.category === 'schedule' ? 'schedule' : 'action'),
        position: { x: n.positionX, y: n.positionY },
        data: { 
          label: n.category === 'trigger' ? 'Button Trigger' : (n.category === 'schedule' ? 'Schedule Trigger' : (JSON.parse(n.object).type === 'console_alert' ? 'Console Alert' : 'Print Log')),
          category: n.category,
          config: JSON.parse(n.object),
          onExecute: n.category === 'trigger' ? () => handleExecute(true) : undefined
        },
      }));

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
      } else {
        toast.success('Test mode deactivated.');
        if (testIntervalRef.current) clearInterval(testIntervalRef.current);
      }
    } catch (error) {
      toast.error('Failed to toggle test mode');
      setIsTesting(!newState);
    }
  }, [id, isTesting]);

  const onConnect = useCallback(
    async (params: Connection) => {
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
    [id, setEdges]
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

      const nodeConfig = type === 'trigger' 
        ? { type: 'button_trigger' }
        : (type === 'schedule' ? { type: 'interval_trigger', intervalValue: 1, intervalUnit: 'minutes' } : { type: actionType, message: 'New Message' });

      const tempId = `temp-${Date.now()}`;
      const newNode: Node = {
        id: tempId,
        type,
        position,
        data: { 
          label: type === 'trigger' ? 'Button Trigger' : (type === 'schedule' ? 'Schedule Trigger' : (actionType === 'console_alert' ? 'Console Alert' : 'Print Log')),
          category: type,
          config: nodeConfig,
          onExecute: type === 'trigger' ? () => handleExecute(true) : undefined
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
    [reactFlowInstance, id, setNodes, handleExecute]
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
          onExecute: clipboard.data.category === 'trigger' ? handleExecute : undefined
        },
      };

      setNodes((nds) => [...nds, newNode]);
      toast.success('Node pasted');
    } catch (error) {
      toast.error('Failed to paste node');
    }
  }, [clipboard, reactFlowInstance, id, handleExecute, setNodes]);

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
        <div className={isTesting ? 'opacity-50 pointer-events-none grayscale transition-all' : ''}>
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

        <div className={isTesting ? 'opacity-50 pointer-events-none' : ''}>
          <NodeConfigPanel 
            selectedNode={selectedNode}
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
