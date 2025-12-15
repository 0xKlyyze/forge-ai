import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { 
  FileText, Activity, Star, 
  CheckCircle2, Plus, ArrowRight, Zap,
  Code, Link as LinkIcon, ExternalLink, Upload, Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';

export default function ProjectHome() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState({ fileCount: 0, taskCount: 0, completedTasks: 0, highPriorityFiles: [], nextTask: null });
  const [links, setLinks] = useState([]);
  
  // Dialog States
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  // Form States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  
  const fileInputRef = useRef(null);

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

      setStats({
        fileCount: files.length,
        taskCount: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'done').length,
        highPriorityFiles: files.filter(f => f.pinned),
        nextTask
      });

    } catch (error) {
      console.error("Failed to load project home data", error);
    }
  };

  const handleCreateTask = async (e) => {
      e.preventDefault();
      try {
          await api.post('/tasks', {
              project_id: projectId,
              title: newTaskTitle,
              priority: 'medium',
              importance: 'medium',
              status: 'todo',
              quadrant: 'q2'
          });
          toast.success("Task added");
          setNewTaskTitle('');
          setTaskDialogOpen(false);
          loadData();
      } catch (error) { toast.error("Failed"); }
  };

  const handleCreateDoc = async (e) => {
      e.preventDefault();
      let name = newDocName;
      if (!name.endsWith('.md')) name += '.md';
      try {
          await api.post('/files', {
              project_id: projectId,
              name,
              type: 'doc',
              category: 'Docs',
              content: '# New Document'
          });
          toast.success("Document created");
          setNewDocName('');
          setDocDialogOpen(false);
          loadData();
      } catch (error) { toast.error("Failed"); }
  };

  const handleUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              let type = 'other';
              if (file.type.startsWith('image/')) type = 'asset';
              
              await api.post('/files', {
                  project_id: projectId,
                  name: file.name,
                  type,
                  category: type === 'asset' ? 'Assets' : 'Docs',
                  content: ev.target.result
              });
              toast.success("File uploaded");
              setDocDialogOpen(false);
              loadData();
          } catch (err) { toast.error("Upload failed"); }
      };
      
      if (file.type.startsWith('text/') || file.name.match(/\.(md|js|jsx|json)$/)) {
          reader.readAsText(file);
      } else {
          reader.readAsDataURL(file);
      }
  };

  const handleAddLink = async (e) => {
      e.preventDefault();
      const updatedLinks = [...links, { title: newLinkTitle, url: newLinkUrl }];
      try {
          await api.put(`/projects/${projectId}`, { links: updatedLinks });
          setLinks(updatedLinks);
          setNewLinkTitle('');
          setNewLinkUrl('');
          setLinkDialogOpen(false);
          toast.success("Link added");
      } catch (error) { toast.error("Failed"); }
  };

  const handleDeleteLink = async (index) => {
      const updatedLinks = links.filter((_, i) => i !== index);
      try {
          await api.put(`/projects/${projectId}`, { links: updatedLinks });
          setLinks(updatedLinks);
      } catch (error) { toast.error("Failed"); }
  }

  if (!project) return <div className="p-8 flex items-center justify-center h-full"><div className="animate-pulse text-muted-foreground">Initializing Control Room...</div></div>;

  const completionRate = stats.taskCount > 0 ? (stats.completedTasks / stats.taskCount) * 100 : 0;

  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-background/50">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 pb-32">
        
        {/* Compact Header */}
        <div className="flex items-end justify-between border-b border-white/5 pb-4">
            <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">{project.name}</h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1"><Activity className="h-3 w-3"/> {Math.round(completionRate)}% VELOCITY</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3"/> {stats.fileCount} ARTIFACTS</span>
            </div>
        </div>

        {/* Hero: Focus Mode */}
        {stats.nextTask ? (
            <div className="w-full bg-gradient-to-r from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity">
                    <Zap className="h-24 w-24 text-primary/10 rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Focus</span>
                            <span className="text-xs text-primary font-mono uppercase">High Priority</span>
                        </div>
                        <h3 className="text-2xl font-bold">{stats.nextTask.title}</h3>
                    </div>
                    <div className="flex gap-2">
                        <Button className="rounded-full" onClick={() => navigate(`/project/${projectId}/tasks`)}>
                            Engage <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button variant="secondary" className="rounded-full" onClick={async () => {
                            await api.put(`/tasks/${stats.nextTask.id}`, { status: 'done' });
                            toast.success("Objective Complete");
                            loadData();
                        }}>
                            Complete
                        </Button>
                    </div>
                </div>
            </div>
        ) : (
            <div className="w-full bg-secondary/10 border border-white/5 rounded-2xl p-6 flex items-center justify-center gap-4 text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <span>All clear. Initialize new directives.</span>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Links Widget */}
            <Card className="bg-secondary/10 border-white/5 backdrop-blur-sm md:col-span-1 h-full">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><LinkIcon className="h-4 w-4"/> Quick Links</CardTitle>
                    <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3 w-3" /></Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Add Link</DialogTitle></DialogHeader>
                            <form onSubmit={handleAddLink} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Title</Label>
                                    <Input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="e.g. AI Studio" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>URL</Label>
                                    <Input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://..." required />
                                </div>
                                <Button type="submit" className="w-full">Save Link</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {links.length > 0 ? (
                            links.map((link, i) => (
                                <div key={i} className="group flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors">
                                    <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-medium hover:text-primary truncate flex-1">
                                        <ExternalLink className="h-3 w-3 opacity-50" /> {link.title}
                                    </a>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDeleteLink(i)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-muted-foreground italic p-2">No links added.</div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Pinned Artifacts */}
            <Card className="bg-secondary/10 border-white/5 backdrop-blur-sm md:col-span-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500"/> Pinned Artifacts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                        {stats.highPriorityFiles.length > 0 ? (
                            stats.highPriorityFiles.map(file => (
                                <div 
                                    key={file.id} 
                                    onClick={() => navigate(`/project/${projectId}/editor/${file.id}`)}
                                    className="flex-shrink-0 w-40 p-4 bg-background/50 rounded-xl border border-white/5 hover:border-primary/50 cursor-pointer transition-all hover:-translate-y-1"
                                >
                                    {file.type === 'mockup' ? <Code className="h-6 w-6 text-blue-400 mb-2"/> : <FileText className="h-6 w-6 text-zinc-400 mb-2"/>}
                                    <p className="font-bold text-xs truncate">{file.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(file.last_edited))} ago</p>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-muted-foreground italic p-2">Pin important files for quick access.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Floating Action Dock */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
              
              <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                  <DialogTrigger asChild>
                      <Button variant="ghost" className="flex flex-col gap-1 h-auto py-2 hover:bg-white/10">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-[10px] uppercase font-bold">New Task</span>
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
                          <span className="text-[10px] uppercase font-bold">New Doc</span>
                      </Button>
                  </DialogTrigger>
                  <DialogContent>
                      <DialogHeader><DialogTitle>Create Artifact</DialogTitle></DialogHeader>
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
                                  <div className="grid w-full max-w-sm items-center gap-1.5">
                                      <Label htmlFor="file-upload">File</Label>
                                      <Input id="file-upload" type="file" onChange={handleUpload} />
                                  </div>
                              </div>
                          </TabsContent>
                      </Tabs>
                  </DialogContent>
              </Dialog>

              <div className="w-px h-8 bg-white/10" />

              <Button variant="ghost" className="flex flex-col gap-1 h-auto py-2 hover:bg-white/10" onClick={() => document.getElementById('quick-upload').click()}>
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px] uppercase font-bold">Upload</span>
              </Button>
              <Input id="quick-upload" type="file" className="hidden" onChange={handleUpload} />

          </div>
      </div>
    </div>
  );
}
