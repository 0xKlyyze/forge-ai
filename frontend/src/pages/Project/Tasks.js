import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Plus, Trash2, MoreHorizontal, CheckCircle2, GripVertical, Calendar, Flag, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function ProjectTasks() {
  const { projectId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState('medium');
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/tasks`);
      setTasks(res.data);
    } catch (error) {
      toast.error("Failed to load tasks");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      // Auto-calculate quadrant
      let quadrant = 'q2';
      if (newTaskPriority === 'high') quadrant = 'q1';
      if (newTaskPriority === 'low') quadrant = 'q3';
      if (newTaskPriority === 'low' && newTaskDifficulty === 'easy') quadrant = 'q4';

      const res = await api.post('/tasks', {
        project_id: projectId,
        title: newTaskTitle,
        priority: newTaskPriority,
        difficulty: newTaskDifficulty,
        quadrant,
        status: 'todo'
      });
      setTasks([...tasks, res.data]);
      setNewTaskTitle('');
      setIsDialogOpen(false);
      toast.success("Directive initialized");
    } catch (error) {
      toast.error("Failed to create task");
    }
  };

  const updateTask = async (id, updates) => {
      const oldTasks = [...tasks];
      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
      try {
          await api.put(`/tasks/${id}`, updates);
      } catch (error) {
          setTasks(oldTasks);
          toast.error("Update failed");
      }
  };

  const deleteTask = async (id) => {
      if(!window.confirm("Delete task?")) return;
      try {
          await api.delete(`/tasks/${id}`);
          setTasks(tasks.filter(t => t.id !== id));
          toast.success("Deleted");
      } catch (error) { toast.error("Failed"); }
  };

  const toggleDone = (task) => {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      updateTask(task.id, { status: newStatus });
  };

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const taskId = active.id;
    const task = tasks.find(t => t.id === taskId);
    
    // Check if dropped on a container (Kanban Column or Matrix Quadrant)
    const containerId = over.id;

    // Kanban Logic
    if (['todo', 'in-progress', 'done'].includes(containerId)) {
        if (task.status !== containerId) {
            updateTask(taskId, { status: containerId });
        }
    }
    
    // Matrix Logic
    if (['q1', 'q2', 'q3', 'q4'].includes(containerId)) {
        if (task.quadrant !== containerId) {
            updateTask(taskId, { quadrant: containerId });
        }
    }
  };

  const activeTask = tasks.find(t => t.id === activeId);

  return (
    <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart} 
        onDragEnd={handleDragEnd}
    >
        <div className="h-full p-6 lg:p-10 flex flex-col space-y-6 bg-background/50">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-mono font-bold tracking-tight">MISSION CONTROL</h1>
                    <p className="text-muted-foreground">Directives & Priorities.</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> New Directive</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>New Directive</DialogTitle>
                            <DialogDescription>Set parameters for the new objective.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                            <Input placeholder="Task Title..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Priority</label>
                                    <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="high">High (Critical)</SelectItem>
                                            <SelectItem value="medium">Medium (Standard)</SelectItem>
                                            <SelectItem value="low">Low (Optional)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Difficulty</label>
                                    <Select value={newTaskDifficulty} onValueChange={setNewTaskDifficulty}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hard">Hard (Complex)</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="easy">Easy (Quick)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button type="submit" className="w-full">Initialize</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
                <TabsList className="w-fit">
                    <TabsTrigger value="kanban">Kanban</TabsTrigger>
                    <TabsTrigger value="matrix">Matrix</TabsTrigger>
                    <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>

                {/* KANBAN */}
                <TabsContent value="kanban" className="flex-1 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
                        {['todo', 'in-progress', 'done'].map(status => (
                            <DroppableContainer key={status} id={status} title={status.replace('-', ' ')} count={tasks.filter(t => t.status === status).length}>
                                {tasks.filter(t => t.status === status).map(task => (
                                    <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task)} onDelete={() => deleteTask(task.id)} />
                                ))}
                            </DroppableContainer>
                        ))}
                    </div>
                </TabsContent>

                {/* MATRIX */}
                <TabsContent value="matrix" className="flex-1 mt-6">
                    <div className="grid grid-cols-2 grid-rows-2 gap-4 h-[600px]">
                        <DroppableContainer id="q1" title="DO FIRST" subtitle="Urgent & Important" className="border-red-500/50 bg-red-900/10">
                            {tasks.filter(t => t.quadrant === 'q1').map(task => (
                                <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task)} onDelete={() => deleteTask(task.id)} />
                            ))}
                        </DroppableContainer>
                        <DroppableContainer id="q2" title="SCHEDULE" subtitle="Not Urgent & Important" className="border-blue-500/50 bg-blue-900/10">
                            {tasks.filter(t => t.quadrant === 'q2').map(task => (
                                <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task)} onDelete={() => deleteTask(task.id)} />
                            ))}
                        </DroppableContainer>
                        <DroppableContainer id="q3" title="DELEGATE" subtitle="Urgent & Not Important" className="border-yellow-500/50 bg-yellow-900/10">
                            {tasks.filter(t => t.quadrant === 'q3').map(task => (
                                <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task)} onDelete={() => deleteTask(task.id)} />
                            ))}
                        </DroppableContainer>
                        <DroppableContainer id="q4" title="ELIMINATE" subtitle="Not Urgent & Not Important" className="border-gray-500/50 bg-gray-900/10">
                            {tasks.filter(t => t.quadrant === 'q4').map(task => (
                                <TaskCard key={task.id} task={task} onToggle={() => toggleDone(task)} onDelete={() => deleteTask(task.id)} />
                            ))}
                        </DroppableContainer>
                    </div>
                </TabsContent>

                {/* LIST VIEW */}
                <TabsContent value="list" className="flex-1 mt-6">
                    <div className="bg-secondary/10 rounded-lg border border-white/5 overflow-hidden">
                        <div className="grid grid-cols-12 p-4 border-b border-white/5 font-mono text-xs text-muted-foreground uppercase">
                            <div className="col-span-1">Status</div>
                            <div className="col-span-6">Title</div>
                            <div className="col-span-2">Priority</div>
                            <div className="col-span-2">Difficulty</div>
                            <div className="col-span-1">Actions</div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {tasks.map(task => (
                                <div key={task.id} className="grid grid-cols-12 p-4 items-center hover:bg-white/5 transition-colors">
                                    <div className="col-span-1">
                                        <button onClick={() => toggleDone(task)}>
                                            {task.status === 'done' 
                                                ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground hover:border-primary transition-colors" />
                                            }
                                        </button>
                                    </div>
                                    <div className="col-span-6 font-medium">{task.title}</div>
                                    <div className="col-span-2"><Badge type="priority" value={task.priority} /></div>
                                    <div className="col-span-2"><Badge type="difficulty" value={task.difficulty} /></div>
                                    <div className="col-span-1 text-right">
                                         <Button variant="ghost" size="icon" onClick={() => deleteTask(task.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
        <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
        </DragOverlay>
    </DndContext>
  );
}

// Sub-components
function DroppableContainer({ id, title, subtitle, count, children, className }) {
    const { setNodeRef } = useSortable({ id });
    return (
        <div ref={setNodeRef} className={`flex flex-col rounded-lg border border-white/5 bg-secondary/10 h-full min-h-[200px] overflow-hidden ${className}`}>
             <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
                <div>
                    <span className="font-mono font-bold uppercase text-sm">{title}</span>
                    {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
                </div>
                {count !== undefined && <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">{count}</span>}
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}

function TaskCard({ task, onToggle, onDelete, isOverlay }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isOverlay ? 0.8 : 1,
    };

    return (
        <Card 
            ref={setNodeRef} style={style} {...attributes} {...listeners}
            className={`bg-secondary/40 border-white/5 hover:border-primary/50 transition-colors group relative cursor-grab active:cursor-grabbing ${task.status === 'done' ? 'opacity-50' : ''}`}
        >
            <CardContent className="p-3">
                <div className="flex items-start gap-3">
                    <button 
                        className="mt-1 flex-shrink-0" 
                        onPointerDown={(e) => e.stopPropagation()} 
                        onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    >
                         {task.status === 'done' 
                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                            : <div className="h-4 w-4 rounded-full border border-muted-foreground hover:border-primary transition-colors" />
                         }
                    </button>
                    <div className="flex-1">
                        <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                        <div className="flex gap-2 mt-2">
                             <Badge type="priority" value={task.priority} compact />
                             <Badge type="difficulty" value={task.difficulty} compact />
                        </div>
                    </div>
                    {onDelete && (
                        <button 
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function Badge({ type, value, compact }) {
    const colors = {
        high: 'text-red-400 bg-red-400/10',
        medium: 'text-blue-400 bg-blue-400/10',
        low: 'text-gray-400 bg-gray-400/10',
        hard: 'text-orange-400 bg-orange-400/10',
        easy: 'text-green-400 bg-green-400/10'
    };
    const color = colors[value] || colors.medium;
    return (
        <span className={`rounded px-1.5 py-0.5 font-mono font-bold uppercase ${color} ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {value}
        </span>
    );
}
