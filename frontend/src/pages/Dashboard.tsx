import React, { useEffect, useState } from 'react';
import { Plus, Layout, Activity, EyeOff, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/apiClient';
import WorkflowCard from '../components/WorkflowCard';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

interface Stats {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
}

interface Workflow {
  id: number;
  name: string;
  isActive: boolean;
  isTesting: boolean;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName');
  const userId = localStorage.getItem('userId');

  const fetchData = async () => {
    try {
      const [statsRes, workflowsRes] = await Promise.all([
        api.get(`/users/${userId}/stats`),
        api.get('/workflows')
      ]);
      setStats(statsRes.data);
      setWorkflows(workflowsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName.trim()) return;

    setCreating(true);
    try {
      const { data } = await api.post('/workflows', { 
        name: newWorkflowName, 
        isActive: true, 
        userId: Number(userId) 
      });
      toast.success('Workflow created!');
      setWorkflows([...workflows, data]);
      setNewWorkflowName('');
      setIsModalOpen(false);
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error('Failed to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkflow = async (id: number) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      setWorkflows(workflows.filter(w => w.id !== id));
      toast.success('Workflow deleted');
      fetchData(); // Refresh stats
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-[#0f172a] text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center font-bold text-white">
              N8
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard</h1>
              <p className="text-xs text-slate-400">Welcome back, {userName}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 glass">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-primary-500/10 text-primary-400 rounded-xl">
                <Layout size={24} />
              </div>
              <span className="text-slate-400 font-medium">Total Workflows</span>
            </div>
            <p className="text-4xl font-bold text-white">{stats?.totalWorkflows ?? 0}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 glass">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-green-500/10 text-green-400 rounded-xl">
                <Activity size={24} />
              </div>
              <span className="text-slate-400 font-medium">Active</span>
            </div>
            <p className="text-4xl font-bold text-white">{stats?.activeWorkflows ?? 0}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 glass">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-xl">
                <EyeOff size={24} />
              </div>
              <span className="text-slate-400 font-medium">Inactive</span>
            </div>
            <p className="text-4xl font-bold text-white">{stats?.inactiveWorkflows ?? 0}</p>
          </div>
        </div>

        {/* Workflows Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">My Workflows</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/20"
          >
            <Plus size={20} /> New Workflow
          </button>
        </div>

        {/* Create Workflow Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Create New Workflow"
        >
          <form onSubmit={handleCreateWorkflow} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="Workflow name..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newWorkflowName.trim()}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Workflow'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Workflow Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-800">
            <Layout size={48} className="mx-auto text-slate-700 mb-4" />
            <p className="text-slate-400 text-lg">No workflows found. Create your first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workflows.map(w => (
              <WorkflowCard 
                key={w.id} 
                id={w.id} 
                name={w.name} 
                isActive={w.isActive}
                isTesting={w.isTesting}
                onDelete={() => handleDeleteWorkflow(w.id)}
                onUpdate={fetchData}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
