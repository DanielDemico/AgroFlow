import React from 'react';
import { Play, Edit2, Trash2, ExternalLink, Pause, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/apiClient';
import toast from 'react-hot-toast';

interface WorkflowCardProps {
  id: number;
  name: string;
  isActive: boolean;
  isTesting: boolean;
  onDelete: () => void;
  onUpdate: () => void;
}

const WorkflowCard: React.FC<WorkflowCardProps> = ({ id, name, isActive, isTesting, onDelete, onUpdate }) => {
  const [loading, setLoading] = React.useState(false);

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Se for ativar, executa as validações primeiro
    if (!isActive) {
      setLoading(true);
      try {
        const { data } = await api.get(`/workflows/${id}`);
        const nodes = data.nodes || [];
        const connections = data.connections || [];
        
        let hasErrors = false;
        
        // 1. Workflow vazio
        if (nodes.length === 0) {
          toast.error('O workflow está vazio. Adicione nós antes de ativar.');
          hasErrors = true;
        }

        // 2. Vários Scheculers
        const scheduleNodes = nodes.filter((n: any) => n.category === 'schedule');
        if (scheduleNodes.length > 1) {
          toast.error(`O workflow não deve ter mais de um agendador. Encontrados: ${scheduleNodes.length}.`);
          hasErrors = true;
        }
        
        // 3. Nós soltos (sem nenhuma conexão de entrada ou saída)
        if (nodes.length > 0) {
          const connectedNodeIds = new Set<string>();
          connections.forEach((c: any) => {
            connectedNodeIds.add(c.sourceNodeId.toString());
            connectedNodeIds.add(c.targetNodeId.toString());
          });
          
          let looseNodesCount = 0;
          nodes.forEach((n: any) => {
            if (!connectedNodeIds.has(n.id.toString())) {
              looseNodesCount++;
            }
          });
          
          if (looseNodesCount > 0) {
            toast.error(`Atenção: Existem ${looseNodesCount} nó(s) solto(s). Conecte-os ou exclua-os.`);
            hasErrors = true;
          }
        }
        
        // Libera o carregamento mas interrompe se houver erros
        setLoading(false);
        if (hasErrors) return;
      } catch (err) {
        toast.error('Falha ao validar o workflow.');
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      await api.put(`/workflows/${id}`, { id, name, isActive: !isActive });
      toast.success(isActive ? 'Workflow desativado' : 'Workflow ativado!');
      onUpdate();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await api.post(`/workflows/${id}/execute`);
      toast.success(`Execution successful!`);
    } catch (error) {
      toast.error('Execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-primary-500/50 transition-all hover:shadow-lg hover:shadow-primary-500/5 group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{name}</h3>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider ${isActive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-700/50 text-slate-500 border border-slate-700'}`}>
              {isActive ? 'Active' : 'Paused'}
            </span>
            {isTesting && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-[10px] uppercase font-black tracking-wider animate-pulse">
                <Activity size={10} /> Test Mode
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleActive}
            disabled={loading}
            className={`p-2 rounded-lg transition-all active:scale-90 ${
              isActive 
                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white' 
                : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white'
            }`}
            title={isActive ? "Pause Workflow" : "Resume Workflow"}
          >
            {isActive ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            onClick={handleRun}
            disabled={loading}
            className="p-2 bg-primary-600/10 text-primary-400 hover:bg-primary-600 hover:text-white rounded-lg transition-colors disabled:opacity-50"
            title="Fire Manual Trigger"
          >
            <Activity size={18} className={loading && !isActive ? 'animate-spin' : ''} />
          </button>
          <Link
            to={`/workflows/${id}`}
            className="p-2 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
            title="Edit Workflow"
          >
            <Edit2 size={18} />
          </Link>
          <button
            onClick={onDelete}
            className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
            title="Delete Workflow"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <Link 
        to={`/workflows/${id}`}
        className="flex items-center gap-2 text-primary-400 text-sm font-medium hover:text-primary-300 transition-colors"
      >
        Open Canvas <ExternalLink size={14} />
      </Link>
    </div>
  );
};

export default WorkflowCard;
