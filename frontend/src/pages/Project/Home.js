import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { 
  FileText, Clock, Activity, Star, 
  CheckCircle2, Plus, ArrowRight, Zap,
  Code, Image as ImageIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

export default function ProjectHome() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState({ fileCount: 0, taskCount: 0, completedTasks: 0, highPriorityFiles: [], nextTask: null });
  const [recentActivity, setRecentActivity] = useState([]);
  
  // Quick Action State
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projRes, filesRes, tasksRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/files`),
        api.get(`/projects/${projectId}/tasks`)
      ]);

      setProject(projRes.data);
      const files = filesRes.data;
      const tasks = tasksRes.data;
      
      // Logic for "Next Task" (Highest priority, todo)
      const nextTask = tasks
        .filter(t => t.status === 'todo')
        .sort((a, b) => {
            const prioMap = { high: 3, medium: 2, low: 1 };
            if (prioMap[b.priority] !== prioMap[a.priority]) return prioMap[b.priority] - prioMap[a.priority];
            return 0; // could add creation date sort
        })[0];

      setStats({
        fileCount: files.length,
        taskCount: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        highPriorityFiles: files.filter(f => f.pinned),
        nextTask
      });
      
      const activity = [
         ...files.map(f => ({ type: 'file', item: f, date: f.last_edited })),
         ...tasks.map(t => ({ type: 'task', item: t, date: t.created_at }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
      setRecentActivity(activity);

    } catch (error) {
      console.error("Failed to load project home data", error);
    }
  };

  const handleQuickTask = async (e) => {
      e.preventDefault();
      try {
          await api.post('/tasks', {
              project_id: projectId,
              title: quickTaskTitle,
              priority: 'medium',
              importance: 'medium',
              status: 'todo',
              quadrant: 'q2'
          });
          toast.success("Task added");
          setQuickTaskTitle('');
          setIsActionOpen(false);
          loadData();
      } catch (error) {
          toast.error("Failed");
      }
  };

  if (!project) return <div className="p-8 flex items-center justify-center h-full"><div className="animate-pulse text-muted-foreground">Initializing Control Room...</div></div>;

  const completionRate = stats.taskCount > 0 ? (stats.completedTasks / stats.taskCount) * 100 : 0;

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-background/50">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 pb-24">
        
        {/* Header */}
        <div className="flex flex-col gap-1">
            <h2 className="text-xs font-mono text-primary uppercase tracking-widest mb-2">Project Dashboard</h2>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground uppercase">{project.name}</h1>
            <p className="text-muted-foreground max-w-xl">
                Status: <span className="text-foreground font-medium">{project.status}</span> • Last active {formatDistanceToNow(new Date(project.last_edited))} ago.
            </p>
        </div>

        {/* Hero: Focus Mode */}
        {stats.nextTask ? (
            <div className="w-full bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/20 rounded-3xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                    <Zap className="h-24 w-24 text-primary/10 rotate-12" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Current Focus</span>
                        <span className="text-xs text-primary font-mono uppercase">High Priority</span>
                    </div>
                    <h3 className="text-3xl font-bold mb-2">{stats.nextTask.title}</h3>
                    <p className="text-muted-foreground mb-6 max-w-2xl">{stats.nextTask.description || "No description provided. Execute immediately."}</p>
                    <div className="flex gap-3">
                        <Button size="lg" className="rounded-full font-bold" onClick={() => navigate(`/project/${projectId}/tasks`)}>
                            Start Mission <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button size="lg" variant="secondary" className="rounded-full" onClick={async () => {
                            await api.put(`/tasks/${stats.nextTask.id}`, { status: 'done' });
                            toast.success("Objective Complete");
                            loadData();
                        }}>
                            Mark Complete
                        </Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="w-full bg-secondary/10 border border-white/5 rounded-3xl p-8 flex items-center justify-center flex-col text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-2xl font-bold">All Clear</h3>
                <p className="text-muted-foreground">No pending high-priority tasks. Initialize new directives.</p>
            </div>
        )}

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stats */}
            <Card className="bg-secondary/10 border-white/5 backdrop-blur-sm">
                <CardContent className="p-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2"><Activity className="h-4 w-4"/> Velocity</h4>
                    <div className="text-4xl font-mono font-bold mb-2">{Math.round(completionRate)}%</div>
                    <Progress value={completionRate} className="h-2 mb-4" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{stats.completedTasks} Complete</span>
                        <span>{stats.taskCount} Total</span>
                    </div>
                </CardContent>
            </Card>

            {/* Pinned Files */}
            <Card className="bg-secondary/10 border-white/5 backdrop-blur-sm md:col-span-2">
                <CardContent className="p-6">
                    <h4 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500"/> Pinned Artifacts</h4>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {stats.highPriorityFiles.length > 0 ? (
                            stats.highPriorityFiles.map(file => (
                                <div 
                                    key={file.id} 
                                    onClick={() => navigate(`/project/${projectId}/editor/${file.id}`)}
                                    className="flex-shrink-0 w-48 p-4 bg-background/50 rounded-xl border border-white/5 hover:border-primary/50 cursor-pointer transition-all hover:-translate-y-1"
                                >
                                    {file.type === 'mockup' ? <Code className="h-6 w-6 text-blue-400 mb-2"/> : <FileText className="h-6 w-6 text-zinc-400 mb-2"/>}
                                    <p className="font-bold text-sm truncate">{file.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(file.last_edited))} ago</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-muted-foreground italic">No artifacts pinned.</div>
                        )}
                        <div 
                            onClick={() => navigate(`/project/${projectId}/files`)}
                            className="flex-shrink-0 w-12 flex items-center justify-center bg-secondary/20 rounded-xl border border-white/5 cursor-pointer hover:bg-secondary/40"
                        >
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Activity Feed */}
        <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Recent Transmissions</h4>
            <div className="space-y-2">
                {recentActivity.map((act, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-secondary/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-4">
                            <div className={`h-2 w-2 rounded-full ${act.type === 'task' ? 'bg-green-500' : 'bg-blue-500'}`} />
                            <div>
                                <p className="font-medium text-sm">{act.item.name || act.item.title}</p>
                                <p className="text-xs text-muted-foreground">{act.type === 'task' ? 'Directive Updated' : 'Artifact Modified'}</p>
                            </div>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{formatDistanceToNow(new Date(act.date))} ago</span>
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* Floating Action Dock */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-full shadow-2xl">
              <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
                  <DialogTrigger asChild>
                      <Button size="icon" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-12 shadow-lg shadow-primary/20">
                          <Plus className="h-6 w-6" />
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader>
                          <DialogTitle>Quick Action</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                          <div className="col-span-2 space-y-4">
                              <h4 className="text-sm font-medium">New Directive</h4>
                              <form onSubmit={handleQuickTask} className="flex gap-2">
                                  <Input placeholder="What needs to be done?" value={quickTaskTitle} onChange={e => setQuickTaskTitle(e.target.value)} required />
                                  <Button type="submit">Add</Button>
                              </form>
                          </div>
                          <div className="col-span-2 h-px bg-white/10 my-2" />
                          <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate(`/project/${projectId}/files`)}>
                              <FileText className="h-6 w-6" />
                              New Document
                          </Button>
                          <Button variant="outline" className="h-20 flex flex-col gap-2" onClick={() => navigate(`/project/${projectId}/files`)}>
                              <Code className="h-6 w-6" />
                              New Mockup
                          </Button>
                      </div>
                  </DialogContent>
              </Dialog>
              
              <div className="w-px h-8 bg-white/10 mx-2" />
              
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/project/${projectId}/files`)}>
                  <FileText className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/project/${projectId}/editor`)}>
                  <Code className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/project/${projectId}/tasks`)}>
                  <CheckCircle2 className="h-5 w-5" />
              </Button>
          </div>
      </div>
    </div>
  );
}
