import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Trash2, GripVertical, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectTasks() {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [files, setFiles] = useState([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskQuadrant, setNewTaskQuadrant] = useState('q2');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      const [tRes, fRes] = await Promise.all([
        api.get(`/projects/${projectId}/tasks`),
        api.get(`/projects/${projectId}/files`)
      ]);
      setTasks(tRes.data);
      setFiles(fRes.data);
    } catch (error) {
      toast.error("Failed to load tasks");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tasks', {
        project_id: projectId,
        title: newTaskTitle,
        status: 'todo',
        priority: 'medium',
        quadrant: newTaskQuadrant
      });
      setTasks([...tasks, res.data]);
      setNewTaskTitle('');
      setNewTaskQuadrant('q2');
      setIsDialogOpen(false);
      toast.success("Task created");
    } catch (error) {
      toast.error("Failed to create task");
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
      const oldTasks = [...tasks];
      setTasks(tasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
      
      try {
          await api.put(`/tasks/${taskId}`, updates);
      } catch (error) {
          setTasks(oldTasks);
          toast.error("Update failed");
      }
  };

  const handleDeleteTask = async (taskId) => {
      if(!window.confirm("Delete task?")) return;
      try {
          await api.delete(`/tasks/${taskId}`);
          setTasks(tasks.filter(t => t.id !== taskId));
          toast.success("Task deleted");
      } catch(error) {
          toast.error("Delete failed");
      }
  };

  return (
    <div className="h-full p-6 lg:p-10 flex flex-col space-y-6 bg-background/50">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-3xl font-mono font-bold tracking-tight">MISSION CONTROL</h1>
           <p className="text-muted-foreground">Manage directives and priorities.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New Directive</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Task</DialogTitle>
                    <DialogDescription>Define a new objective for this project.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Task Title</label>
                        <Input placeholder="e.g. Implement Auth" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Priority Quadrant</label>
                        <Select value={newTaskQuadrant} onValueChange={setNewTaskQuadrant}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="q1">Q1: Do First (Urgent & Important)</SelectItem>
                                <SelectItem value="q2">Q2: Schedule (Not Urgent & Important)</SelectItem>
                                <SelectItem value="q3">Q3: Delegate (Urgent & Not Important)</SelectItem>
                                <SelectItem value="q4">Q4: Eliminate (Not Urgent & Not Important)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" className="w-full">Initialize</Button>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
          <TabsTrigger value="matrix">Eisenhower Matrix</TabsTrigger>
        </TabsList>

        {/* KANBAN VIEW */}
        <TabsContent value="kanban" className="flex-1 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {['todo', 'in-progress', 'done'].map(status => (
                <div key={status} className="flex flex-col bg-secondary/10 rounded-lg border border-white/5 h-full min-h-[500px]">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between">
                        <span className="font-mono font-bold uppercase text-sm">{status.replace('-', ' ')}</span>
                        <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">{tasks.filter(t => t.status === status).length}</span>
                    </div>
                    <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                        {tasks.filter(t => t.status === status).map(task => (
                            <Card key={task.id} className="bg-secondary/40 border-white/5 hover:border-primary/50 transition-colors group relative">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-medium text-sm">{task.title}</h4>
                                        <button onClick={() => handleDeleteTask(task.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2 mt-4">
                                        {status !== 'todo' && <Button size="xs" variant="ghost" className="h-6 text-[10px]" onClick={() => handleUpdateTask(task.id, { status: status === 'done' ? 'in-progress' : 'todo' })}>Prev</Button>}
                                        {status !== 'done' && <Button size="xs" variant="ghost" className="h-6 text-[10px] ml-auto" onClick={() => handleUpdateTask(task.id, { status: status === 'todo' ? 'in-progress' : 'done' })}>Next</Button>}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
          </div>
        </TabsContent>

        {/* EISENHOWER VIEW */}
        <TabsContent value="matrix" className="flex-1 mt-6">
             <div className="grid grid-cols-2 grid-rows-2 gap-4 h-[600px]">
                 <Quadrant 
                    title="DO FIRST" 
                    subtitle="Urgent & Important" 
                    tasks={tasks.filter(t => t.quadrant === 'q1')} 
                    color="border-red-500/50 bg-red-900/10"
                    onDrop={taskId => handleUpdateTask(taskId, { quadrant: 'q1' })}
                 />
                 <Quadrant 
                    title="SCHEDULE" 
                    subtitle="Not Urgent & Important" 
                    tasks={tasks.filter(t => t.quadrant === 'q2')} 
                    color="border-blue-500/50 bg-blue-900/10"
                    onDrop={taskId => handleUpdateTask(taskId, { quadrant: 'q2' })}
                 />
                 <Quadrant 
                    title="DELEGATE" 
                    subtitle="Urgent & Not Important" 
                    tasks={tasks.filter(t => t.quadrant === 'q3')} 
                    color="border-yellow-500/50 bg-yellow-900/10"
                    onDrop={taskId => handleUpdateTask(taskId, { quadrant: 'q3' })}
                 />
                 <Quadrant 
                    title="ELIMINATE" 
                    subtitle="Not Urgent & Not Important" 
                    tasks={tasks.filter(t => t.quadrant === 'q4')} 
                    color="border-gray-500/50 bg-gray-900/10"
                    onDrop={taskId => handleUpdateTask(taskId, { quadrant: 'q4' })}
                 />
             </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Quadrant({ title, subtitle, tasks, color, onDrop }) {
    return (
        <div className={`rounded-xl border ${color} p-4 flex flex-col h-full overflow-hidden`}>
            <div className="mb-4">
                <h3 className="font-bold font-mono text-lg">{title}</h3>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
                {tasks.map(t => (
                    <div key={t.id} className="p-2 bg-black/40 rounded border border-white/5 text-sm flex items-center justify-between">
                        <span>{t.title}</span>
                         <div className="flex gap-1">
                             <div className="h-2 w-2 rounded-full bg-current opacity-50" />
                         </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
