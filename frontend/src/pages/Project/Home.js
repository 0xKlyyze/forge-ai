import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { FileText, Clock, AlertCircle, CheckCircle2, File, Activity, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '../../components/ui/scroll-area';

export default function ProjectHome() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [stats, setStats] = useState({ fileCount: 0, taskCount: 0, completedTasks: 0, highPriorityFiles: [] });
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
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
        
        const highPriFiles = files.filter(f => f.priority >= 8).slice(0, 5);
        
        setStats({
          fileCount: files.length,
          taskCount: tasks.length,
          completedTasks: tasks.filter(t => t.status === 'done').length,
          highPriorityFiles: highPriFiles
        });
        
        // Mock recent activity based on last edits (simple)
        const activity = [
           ...files.map(f => ({ type: 'file', item: f, date: f.last_edited })),
           ...tasks.map(t => ({ type: 'task', item: t, date: t.created_at }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        
        setRecentActivity(activity);

      } catch (error) {
        console.error("Failed to load project home data", error);
      }
    };
    loadData();
  }, [projectId]);

  if (!project) return <div className="p-8">Loading control room...</div>;

  const progress = stats.taskCount > 0 ? (stats.completedTasks / stats.taskCount) * 100 : 0;

  return (
    <div className="p-6 lg:p-10 h-full overflow-auto bg-background/50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-mono font-bold tracking-tighter uppercase">{project.name} <span className="text-muted-foreground text-lg ml-2 font-normal normal-case">// Dashboard</span></h1>
            <p className="text-muted-foreground max-w-2xl">Project status: <span className="text-primary uppercase font-bold">{project.status}</span>. Last active {formatDistanceToNow(new Date(project.last_edited), { addSuffix: true })}.</p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-auto gap-4">
            
            {/* 1. Status & Progress (Large) */}
            <Card className="md:col-span-2 row-span-1 bg-secondary/20 border-white/5 backdrop-blur-xl">
                <CardHeader>
                    <CardTitle className="text-lg font-mono flex items-center gap-2"><Activity className="h-4 w-4 text-primary"/> PROJECT VELOCITY</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Task Completion</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-white/5 p-4 rounded-lg">
                            <div className="text-3xl font-bold font-mono">{stats.taskCount}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Tasks</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-lg">
                            <div className="text-3xl font-bold font-mono">{stats.fileCount}</div>
                            <div className="text-xs text-muted-foreground uppercase tracking-wider">Artifacts</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Source of Truth (Med) */}
            <Card className="md:col-span-2 row-span-1 bg-secondary/10 border-white/5">
                 <CardHeader>
                    <CardTitle className="text-lg font-mono flex items-center gap-2"><Star className="h-4 w-4 text-accent"/> SOURCE OF TRUTH</CardTitle>
                    <CardDescription>High priority documentation.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {stats.highPriorityFiles.map(file => (
                            <div key={file.id} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border-l-2 border-accent">
                                <span className="text-sm font-medium flex items-center gap-2"><FileText className="h-3 w-3 text-muted-foreground"/> {file.name}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent font-mono">P{file.priority}</span>
                            </div>
                        ))}
                         {stats.highPriorityFiles.length === 0 && <div className="text-sm text-muted-foreground italic">No high priority docs found.</div>}
                    </div>
                </CardContent>
            </Card>

            {/* 3. Recent Activity (Tall) */}
            <Card className="md:col-span-1 md:row-span-2 bg-secondary/5 border-white/5">
                <CardHeader>
                    <CardTitle className="text-lg font-mono flex items-center gap-2"><Clock className="h-4 w-4"/> FEED</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[400px] px-6">
                        <div className="space-y-6 border-l border-white/10 ml-2 pl-4 py-2">
                            {recentActivity.map((act, i) => (
                                <div key={i} className="relative">
                                    <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-secondary border border-white/10" />
                                    <p className="text-sm font-medium">{act.type === 'file' ? 'Edited file' : 'Updated task'}</p>
                                    <p className="text-xs text-muted-foreground truncate w-full">{act.item.name || act.item.title}</p>
                                    <p className="text-[10px] text-muted-foreground/50 mt-1">{formatDistanceToNow(new Date(act.date))} ago</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

             {/* 4. Quick Actions */}
             <Card className="md:col-span-1 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border-white/10">
                 <CardContent className="flex flex-col items-center justify-center h-full p-6 space-y-4">
                     <Button className="w-full font-mono" variant="secondary">New Task</Button>
                     <Button className="w-full font-mono" variant="outline">Upload Asset</Button>
                 </CardContent>
             </Card>

             {/* 5. Placeholder for future widget */}
             <Card className="md:col-span-2 bg-black/40 border-dashed border-white/10 flex items-center justify-center">
                 <div className="text-muted-foreground text-sm font-mono">System Widget Offline</div>
             </Card>
        </div>
      </div>
    </div>
  );
}
