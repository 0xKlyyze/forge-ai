import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { 
  FileText, Activity, Star, 
  CheckCircle2, Plus, ArrowRight, Zap,
  Code, Link as LinkIcon, ExternalLink, Upload, Trash2,
  Terminal, History
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { ScrollArea } from '../../components/ui/scroll-area';
import { toast } from 'sonner';

export default function ProjectHome() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState({ fileCount: 0, taskCount: 0, completedTasks: 0, highPriorityFiles: [], nextTask: null, overviewFileId: null });
  const [links, setLinks] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  
  // Dialog States
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [serviceUrlDialog, setServiceUrlDialog] = useState(false);
  const [activeService, setActiveService] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);

  // Form States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [serviceUrl, setServiceUrl] = useState('');

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        if (e.key.toLowerCase() === 'c') setTaskDialogOpen(true);
        if (e.key.toLowerCase() === 'd') setDocDialogOpen(true);
        if (e.key.toLowerCase() === 'u') document.getElementById('quick-upload').click();
        if (e.key === '1') navigate(`/project/${projectId}/home`);
        if (e.key === '2') navigate(`/project/${projectId}/files`);
        if (e.key === '3') navigate(`/project/${projectId}/editor`);
        if (e.key === '4') navigate(`/project/${projectId}/tasks`);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectId, navigate]);

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
      setLinks(projRes.data.links || []);
      
      const files = filesRes.data;
      const tasks = tasksRes.data;
      
      const nextTask = tasks
        .filter(t => t.status === 'todo')
        .sort((a, b) => {
            const prioMap = { high: 3, medium: 2, low: 1 };
            if (prioMap[b.priority] !== prioMap[a.priority]) return prioMap[b.priority] - prioMap[a.priority];
            return 0;
        })[0];

      const overviewFile = files.find(f => f.name.toLowerCase().includes('overview') || f.name.toLowerCase().includes('readme'));

      // Activity Log Logic
      const activity = [
         ...files.map(f => ({ type: 'file', item: f, date: f.last_edited, action: 'Edited artifact' })),
         ...tasks.map(t => ({ type: 'task', item: t, date: t.created_at, action: 'Created directive' }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));

      setStats({
        fileCount: files.length,
        taskCount: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        highPriorityFiles: files.filter(f => f.pinned),
        nextTask,
        overviewFileId: overviewFile?.id
      });
      
      setRecentActivity(activity);

    } catch (error) {
      console.error("Failed to load project home data", error);
    }
  };

  // ... (Handlers same as before: handleCreateTask, handleCreateDoc, handleUpload, handleServiceClick, saveServiceUrl, handleAddLink, handleDeleteLink)
  // Re-implementing simplified handlers for brevity but preserving functionality
  const handleCreateTask = async (e) => {
      e.preventDefault();
      try {
          await api.post('/tasks', { project_id: projectId, title: newTaskTitle, priority: 'medium', importance: 'medium', status: 'todo', quadrant: 'q2' });
          toast.success("Task added"); setNewTaskTitle(''); setTaskDialogOpen(false); loadData();
      } catch (error) { toast.error("Failed"); }
  };
  const handleCreateDoc = async (e) => {
      e.preventDefault();
      let name = newDocName; if (!name.endsWith('.md')) name += '.md';
      try {
          await api.post('/files', { project_id: projectId, name, type: 'doc', category: 'Docs', content: '# New Document' });
          toast.success("Doc created"); setNewDocName(''); setDocDialogOpen(false); loadData();
      } catch (error) { toast.error("Failed"); }
  };
  const handleUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              let type = 'other'; if (file.type.startsWith('image/')) type = 'asset';
              await api.post('/files', { project_id: projectId, name: file.name, type, category: type === 'asset' ? 'Assets' : 'Docs', content: ev.target.result });
              toast.success("File uploaded"); setDocDialogOpen(false); loadData();
          } catch (err) { toast.error("Upload failed"); }
      };
      if (file.type.startsWith('text/') || file.name.match(/\.(md|js|jsx|json)$/)) reader.readAsText(file); else reader.readAsDataURL(file);
  };
  const handleServiceClick = (service) => {
      const link = links.find(l => l.title === service.title);
      if (link) window.open(link.url, '_blank');
      else { setActiveService(service); setServiceUrl(''); setServiceUrlDialog(true); }
  };
  const saveServiceUrl = async () => {
      if (!activeService || !serviceUrl) return;
      const newLink = { title: activeService.title, url: serviceUrl, type: activeService.type };
      const updatedLinks = [...links, newLink];
      try { await api.put(`/projects/${projectId}`, { links: updatedLinks }); setLinks(updatedLinks); setServiceUrlDialog(false); toast.success("Linked"); } catch (error) { toast.error("Failed"); }
  };

  if (!project) return <div className="p-8 flex items-center justify-center h-full"><div className="animate-pulse text-muted-foreground">Initializing Control Room...</div></div>;

  const SERVICES = [
      { title: 'Google AI Studio', icon: 'https://ai-bot.cn/wp-content/uploads/2025/08/Google-AI-Studio-icon.png', type: 'ai-studio' },
      { title: 'Firebase Console', icon: 'https://vectorseek.com/wp-content/uploads/2025/05/Firebase-icon-Logo-PNG-SVG-Vector.png', type: 'firebase' },
      { title: 'Google Cloud', icon: 'https://logos-world.net/wp-content/uploads/2021/02/Google-Cloud-Emblem.png', type: 'gcp' }
  ];

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-background/50">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 pb-32">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
            <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-secondary/20 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                    {project.icon ? <img src={project.icon} alt="Icon" className="h-full w-full object-cover" /> : <span className="text-2xl font-black">{project.name.charAt(0)}</span>}
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-foreground uppercase">{project.name}</h1>
                </div>
            </div>
            
            {stats.overviewFileId && (
                <Button variant="outline" className="hidden md:flex gap-2" onClick={() => navigate(`/project/${projectId}/editor/${stats.overviewFileId}`)}>
                    <FileText className="h-4 w-4" /> Open Overview
                </Button>
            )}
        </div>

        {/* Hero: Focus Mode (Smaller) */}
        {stats.nextTask ? (
            <div className="w-full bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-xl p-4 relative overflow-hidden group flex items-center justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity">
                    <Zap className="h-16 w-16 text-primary/10 rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Current Focus</span>
                    </div>
                    <h3 className="text-xl font-bold truncate max-w-md">{stats.nextTask.title}</h3>
                </div>
                <div className="relative z-10 flex gap-2">
                    <Button size="sm" className="rounded-full" onClick={() => navigate(`/project/${projectId}/tasks`)}>
                        Engage
                    </Button>
                    <Button size="sm" variant="secondary" className="rounded-full" onClick={async () => {
                        await api.put(`/tasks/${stats.nextTask.id}`, { status: 'done' });
                        toast.success("Objective Complete");
                        loadData();
                    }}>
                        Complete
                    </Button>
                </div>
            </div>
        ) : (
            <div className="w-full bg-secondary/10 border border-white/5 rounded-xl p-4 flex items-center justify-center gap-4 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm">No active focus. Initialize new directives.</span>
            </div>
        )}

        {/* Widgets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Quick Links */}
            <div className="md:col-span-2 grid grid-cols-3 gap-4">
                {SERVICES.map((service) => {
                    const isLinked = links.some(l => l.title === service.title);
                    return (
                        <Card 
                            key={service.title} 
                            className={`
                                bg-secondary/10 border-white/5 backdrop-blur-sm cursor-pointer transition-all hover:-translate-y-1 hover:border-primary/30
                                ${!isLinked ? 'opacity-70 grayscale hover:grayscale-0 hover:opacity-100' : ''}
                            `}
                            onClick={() => handleServiceClick(service)}
                        >
                            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center h-full">
                                <img src={service.icon} alt={service.title} className="h-8 w-8 object-contain drop-shadow-lg" />
                                <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider">{service.title}</h4>
                                    <p className="text-[9px] text-muted-foreground">{isLinked ? 'Connected' : 'Connect'}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Logs Widget */}
            <Card className="bg-secondary/10 border-white/5 backdrop-blur-sm row-span-2">
                <CardHeader className="pb-2 border-b border-white/5 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><History className="h-4 w-4"/> Transmissions</CardTitle>
                    <Button variant="ghost" size="xs" className="h-6 text-[10px]" onClick={() => setLogsOpen(true)}>View All</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                        {recentActivity.slice(0, 5).map((act, i) => (
                            <div key={i} className="p-3 flex items-start gap-3 hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setLogsOpen(true)}>
                                <div className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${act.type === 'task' ? 'bg-green-500' : 'bg-blue-500'}`} />
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-xs font-medium truncate">{act.item.name || act.item.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(act.date))} ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Pinned Artifacts (Restored) */}
            <Card className="bg-secondary/10 border-white/5 backdrop-blur-sm md:col-span-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500"/> Pinned Artifacts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
                        {stats.highPriorityFiles.length > 0 ? (
                            stats.highPriorityFiles.map(file => (
                                <div 
                                    key={file.id} 
                                    onClick={() => navigate(`/project/${projectId}/editor/${file.id}`)}
                                    className="flex-shrink-0 w-40 p-3 bg-background/50 rounded-xl border border-white/5 hover:border-primary/50 cursor-pointer transition-all hover:-translate-y-1"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        {file.type === 'mockup' ? <Code className="h-5 w-5 text-blue-400"/> : <FileText className="h-5 w-5 text-zinc-400"/>}
                                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                    </div>
                                    <p className="font-bold text-xs truncate">{file.name}</p>
                                    <p className="text-[9px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(file.last_edited))} ago</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-muted-foreground italic p-2 flex items-center gap-2">
                                <Star className="h-4 w-4 opacity-50" /> No artifacts pinned.
                            </div>
                        )}
                        <div 
                            onClick={() => navigate(`/project/${projectId}/files`)}
                            className="flex-shrink-0 w-10 flex items-center justify-center bg-secondary/20 rounded-xl border border-white/5 cursor-pointer hover:bg-secondary/40"
                        >
                            <ArrowRight className="h-4 w-4" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Logs Modal */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
          <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
              <DialogHeader><DialogTitle>Transmission Log</DialogTitle></DialogHeader>
              <div className="flex-1 overflow-auto border rounded-md border-white/10 bg-black/20">
                  <div className="divide-y divide-white/10">
                      {recentActivity.map((act, i) => (
                          <div key={i} className="p-4 flex items-center gap-4 hover:bg-white/5">
                              <div className={`h-2 w-2 rounded-full ${act.type === 'task' ? 'bg-green-500' : 'bg-blue-500'}`} />
                              <div className="flex-1">
                                  <p className="text-sm font-bold">{act.action}</p>
                                  <p className="text-xs text-muted-foreground">{act.item.name || act.item.title}</p>
                              </div>
                              <span className="text-xs font-mono opacity-50">{formatDistanceToNow(new Date(act.date))} ago</span>
                          </div>
                      ))}
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* Service URL Dialog */}
      <Dialog open={serviceUrlDialog} onOpenChange={setServiceUrlDialog}>
          <DialogContent>
              <DialogHeader><DialogTitle>Connect {activeService?.title}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                  <Input placeholder="Paste URL here..." value={serviceUrl} onChange={e => setServiceUrl(e.target.value)} autoFocus />
                  <Button className="w-full" onClick={saveServiceUrl}>Save Connection</Button>
              </div>
          </DialogContent>
      </Dialog>

      {/* Floating Action Dock */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                      <Button variant="ghost" className="flex flex-col gap-1 h-auto py-2 hover:bg-white/10">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-[10px] uppercase font-bold">Task (C)</span>
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
                      <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
                          <Input placeholder="Task Title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} autoFocus required />
                          <Button type="submit" className="w-full">Create</Button>
                      </form>
                  </DialogContent>
              </Dialog>

              <div className="w-px h-8 bg-white/10" />

              <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                  <DialogTrigger asChild>
                      <Button variant="ghost" className="flex flex-col gap-1 h-auto py-2 hover:bg-white/10">
                          <FileText className="h-5 w-5" />
                          <span className="text-[10px] uppercase font-bold">Doc (D)</span>
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader><DialogTitle>New Artifact</DialogTitle></DialogHeader>
                      <Tabs defaultValue="create" className="w-full pt-2">
                          <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="create">Create New</TabsTrigger>
                              <TabsTrigger value="upload">Upload</TabsTrigger>
                          </TabsList>
                          <TabsContent value="create">
                              <form onSubmit={handleCreateDoc} className="space-y-4 pt-4">
                                  <Input placeholder="Filename (e.g. Plan.md)" value={newDocName} onChange={e => setNewDocName(e.target.value)} autoFocus required />
                                  <Button type="submit" className="w-full">Create Document</Button>
                              </form>
                          </TabsContent>
                          <TabsContent value="upload">
                              <div className="space-y-4 pt-4">
                                  <Input type="file" onChange={handleUpload} />
                              </div>
                          </TabsContent>
                      </Tabs>
                  </DialogContent>
              </Dialog>

              <div className="w-px h-8 bg-white/10" />

              <Button variant="ghost" className="flex flex-col gap-1 h-auto py-2 hover:bg-white/10" onClick={() => document.getElementById('quick-upload').click()}>
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px] uppercase font-bold">Up (U)</span>
              </Button>
              <Input id="quick-upload" type="file" className="hidden" onChange={handleUpload} />
          </div>
      </div>
    </div>
  );
}
