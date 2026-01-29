import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Input } from '../../components/ui/input';
import {
    FileText, Star, CheckCircle2, ArrowRight, Zap,
    Upload, History, Bot, Send, Sparkles, MessageSquare,
    Flame, Layers, ExternalLink, Target, TrendingUp, Download
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { useProjectContext } from '../../context/ProjectContext';
import { useUpdateTask, useCreateTask, useCreateFile } from '../../hooks/useProjectQueries';
import { ProjectHomeSkeleton } from '../../components/skeletons/PageSkeletons';

export default function ProjectHome() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    // Use shared context data instead of fetching
    const { project, tasks, files, dashboard, isLoading, readOnly, baseUrl } = useProjectContext();
    const updateTaskMutation = useUpdateTask(projectId);
    const createTaskMutation = useCreateTask(projectId);
    const createFileMutation = useCreateFile(projectId);

    const [aiMessage, setAiMessage] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [docDialogOpen, setDocDialogOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newDocName, setNewDocName] = useState('');

    // Derived state from context data
    const links = project?.links || [];
    const priorityTasks = dashboard?.priority_tasks || [];
    const recentChats = dashboard?.recent_chats || [];

    // Compute stats from tasks and files
    const { stats, recentActivity } = useMemo(() => {
        const nextTask = tasks.filter(t => t.status === 'todo').sort((a, b) => {
            const prioMap = { high: 3, medium: 2, low: 1 };
            return (prioMap[b.priority] || 2) - (prioMap[a.priority] || 2);
        })[0];

        const overviewFile = files.find(f => f.name?.toLowerCase().includes('overview') || f.name?.toLowerCase().includes('readme'));

        const activity = [
            ...files.map(f => ({ type: 'file', item: f, date: f.last_edited })),
            ...tasks.map(t => ({ type: 'task', item: t, date: t.created_at }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

        return {
            stats: {
                fileCount: files.length,
                taskCount: tasks.length,
                completedTasks: tasks.filter(t => t.status === 'done').length,
                highPriorityFiles: files.filter(f => f.pinned),
                nextTask,
                overviewFileId: overviewFile?.id
            },
            recentActivity: activity
        };
    }, [tasks, files]);

    const handleAiSend = async (e) => {
        e.preventDefault();
        if (readOnly) return;
        if (!aiMessage.trim() || aiLoading) return;
        setAiLoading(true);
        try {
            const sessionRes = await api.post(`/projects/${projectId}/chat-sessions`);
            await api.post(`/chat-sessions/${sessionRes.data.id}/messages`, {
                message: aiMessage, context_mode: 'selective', referenced_files: [], web_search: false, model_preset: 'fast'
            });
            toast.success("Opening chat...");
            navigate(`${baseUrl}/chat?session=${sessionRes.data.id}`);
        } catch (error) { toast.error("Failed to send message"); }
        finally { setAiLoading(false); }
    };

    const handleQuickComplete = async (taskId) => {
        try {
            await updateTaskMutation.mutateAsync({ id: taskId, updates: { status: 'done' } });
            toast.success("✨ Task completed!");
        } catch (error) { toast.error("Failed"); }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            await createTaskMutation.mutateAsync({ title: newTaskTitle, priority: 'medium', importance: 'medium', status: 'todo', quadrant: 'q2' });
            toast.success("Task created"); setNewTaskTitle(''); setTaskDialogOpen(false);
        } catch (error) { toast.error("Failed"); }
    };

    const handleCreateDoc = async (e) => {
        e.preventDefault();
        let name = newDocName; if (!name.endsWith('.md')) name += '.md';
        try {
            await createFileMutation.mutateAsync({ name, type: 'doc', category: 'Docs', content: '# New Document' });
            toast.success("Doc created"); setNewDocName(''); setDocDialogOpen(false);
        } catch (error) { toast.error("Failed"); }
    };

    // Shortcut Listeners
    useEffect(() => {
        if (readOnly) return;
        const onOpenTask = () => setTaskDialogOpen(true);
        const onOpenDoc = () => setDocDialogOpen(true);
        const onUpload = () => document.getElementById('quick-up')?.click();

        window.addEventListener('open-new-task', onOpenTask);
        window.addEventListener('open-new-doc', onOpenDoc);
        window.addEventListener('trigger-upload', onUpload);

        return () => {
            window.removeEventListener('open-new-task', onOpenTask);
            window.removeEventListener('open-new-doc', onOpenDoc);
            window.removeEventListener('trigger-upload', onUpload);
        };
    }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                let type = file.type.startsWith('image/') ? 'asset' : 'other';
                await createFileMutation.mutateAsync({ name: file.name, type, category: type === 'asset' ? 'Assets' : 'Docs', content: ev.target.result });
                toast.success("Uploaded!");
            } catch (err) { toast.error("Failed"); }
        };
        if (file.type.startsWith('text/') || file.name.match(/\.(md|js|jsx|json)$/)) reader.readAsText(file); else reader.readAsDataURL(file);
    };

    // Pinned Preview State
    const [previewFile, setPreviewFile] = useState(null);

    const handleDownload = (file) => {
        let blob;
        if (file.content.startsWith('data:')) {
            const arr = file.content.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) { u8arr[n] = bstr.charCodeAt(n); }
            blob = new Blob([u8arr], { type: mime });
        } else {
            blob = new Blob([file.content], { type: 'text/plain' });
        }
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    if (isLoading || !project) return <ProjectHomeSkeleton />;

    const completionPercent = stats.taskCount > 0 ? Math.round((stats.completedTasks / stats.taskCount) * 100) : 0;

    const SERVICES = [
        { title: 'AI Studio', icon: 'https://ai-bot.cn/wp-content/uploads/2025/08/Google-AI-Studio-icon.png', url: links.find(l => l.type === 'ai-studio')?.url },
        { title: 'Firebase', icon: 'https://vectorseek.com/wp-content/uploads/2025/05/Firebase-icon-Logo-PNG-SVG-Vector.png', url: links.find(l => l.type === 'firebase')?.url },
        { title: 'Cloud', icon: 'https://logos-world.net/wp-content/uploads/2021/02/Google-Cloud-Emblem.png', url: links.find(l => l.type === 'gcp')?.url },
    ];

    return (
        <div className="h-full overflow-y-auto">
            {/* Enhanced Gradient Background */}
            {/* Enhanced Gradient Background - Moved to Layout.js */}

            <div className="relative p-4 md:p-6 lg:p-8 space-y-5 pb-32 md:pb-28">

                {/* ═══════════════════════════════════════════════════════════════════
            PROJECT HEADER
        ═══════════════════════════════════════════════════════════════════ */}
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-secondary/50 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg">
                        {project.icon ? (
                            <img src={project.icon} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xl font-bold text-primary">{project.name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                        <p className="text-sm text-muted-foreground">Project Dashboard</p>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
            HERO - AI Advisor + Stats Row
        ═══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                    {/* AI Advisor Card */}
                    <div className="lg:col-span-8">
                        <div className="relative overflow-hidden rounded-3xl bg-secondary/40 border border-white/10 p-5 h-full">
                            {/* Subtle accent glow */}
                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                        <Bot className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="font-semibold text-base">AI Advisor</h2>
                                        <p className="text-xs text-muted-foreground">Your intelligent project companion</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                                        </span>
                                        <span className="text-xs text-accent">Online</span>
                                    </div>
                                </div>

                                <form onSubmit={handleAiSend} className="relative">
                                    <Input
                                        value={aiMessage}
                                        onChange={(e) => setAiMessage(e.target.value)}
                                        placeholder={readOnly ? "Chat disabled in read-only mode" : "Ask anything about your project... (Alt+Shift+A)"}
                                        className="h-12 pl-4 pr-14 text-sm bg-background/50 border-white/10 rounded-2xl focus-visible:ring-primary/50"
                                        disabled={aiLoading || readOnly}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        disabled={aiLoading || !aiMessage.trim()}
                                        className="absolute right-1.5 top-1.5 h-9 w-9 rounded-xl"
                                    >
                                        {aiLoading ? <Sparkles className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </form>

                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {['Help me plan', 'Review my code', 'Explain architecture'].map((suggestion) => (
                                        <button
                                            key={suggestion}
                                            onClick={() => !readOnly && setAiMessage(suggestion)}
                                            disabled={readOnly}
                                            className={`px-3 py-1.5 text-xs rounded-xl border transition-all ${readOnly ? 'opacity-50 cursor-not-allowed bg-white/5 border-white/5' : 'bg-white/5 hover:bg-primary/10 border-white/10 hover:border-primary/30 text-muted-foreground hover:text-foreground'}`}
                                        >
                                            {suggestion}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Column */}
                    <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
                        {/* Progress Card */}
                        <div className="rounded-xl bg-secondary/30 border border-white/10 p-4 flex items-center gap-4">
                            <div className="relative h-14 w-14 flex-shrink-0">
                                <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                                    <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round"
                                        strokeDasharray={`${completionPercent}, 100`} className="transition-all duration-1000" />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-accent">
                                    {completionPercent}%
                                </span>
                            </div>
                            <div>
                                <p className="text-xl font-bold">{stats.completedTasks}/{stats.taskCount}</p>
                                <p className="text-xs text-muted-foreground">Tasks Done</p>
                            </div>
                        </div>

                        {/* Files Card */}
                        <div className="rounded-xl bg-secondary/30 border border-white/10 p-4 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                                <Layers className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-xl font-bold">{stats.fileCount}</p>
                                <p className="text-xs text-muted-foreground">Artifacts</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
            FOCUS + SERVICES ROW
        ═══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Current Focus */}
                    <div className="lg:col-span-8">
                        {stats.nextTask ? (
                            <div className="rounded-2xl bg-secondary/30 border border-accent/20 p-4 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="h-10 w-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
                                    <Target className="h-5 w-5 text-accent" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-medium text-accent uppercase tracking-wider">Current Focus</p>
                                    <h3 className="text-base font-semibold truncate max-w-[200px] md:max-w-[350px]">{stats.nextTask.title}</h3>
                                </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                    <Button size="sm" variant="ghost" className="rounded-xl border border-white/10" onClick={() => navigate(`${baseUrl}/tasks`)}>
                                        View
                                    </Button>
                                    {!readOnly && (
                                        <Button size="sm" className="rounded-xl" onClick={async () => {
                                            await api.put(`/tasks/${stats.nextTask.id}`, { status: 'done' });
                                            toast.success("🎉 Complete!");
                                            loadData();
                                        }}>
                                            <CheckCircle2 className="h-4 w-4 mr-1" /> Done
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-secondary/20 border border-white/5 p-4 flex items-center justify-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                <span className="text-sm text-muted-foreground">All caught up! No active focus.</span>
                                {!readOnly && (
                                    <Button size="sm" variant="outline" className="ml-4 rounded-xl" onClick={() => setTaskDialogOpen(true)}>
                                        New Task
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Services */}
                    <div className="lg:col-span-4 flex gap-2">
                        {SERVICES.map((service) => (
                            <button
                                key={service.title}
                                onClick={() => service.url ? window.open(service.url, '_blank') : toast.info('Link not configured')}
                                className={`flex-1 rounded-xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5
                  ${service.url ? 'bg-secondary/30 border-white/10 hover:border-primary/30' : 'bg-secondary/10 border-white/5 opacity-50 hover:opacity-80'}`}
                            >
                                <img src={service.icon} alt="" className="h-6 w-6 object-contain" />
                                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{service.title}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
            MAIN GRID - 3 Equal Columns
        ═══════════════════════════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Priority Tasks */}
                    <Card className="rounded-xl bg-secondary/20 border-white/10">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                <Flame className="h-4 w-4 text-amber-500" />
                                Priority Tasks
                                {priorityTasks.length > 0 && (
                                    <span className="ml-auto text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{priorityTasks.length}</span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-2">
                            <ScrollArea className="h-[180px]">
                                {priorityTasks.length > 0 ? (
                                    <div className="px-2 space-y-1">
                                        {priorityTasks.map((task) => (
                                            <div key={task.id} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all">
                                                <button
                                                    onClick={() => !readOnly && handleQuickComplete(task.id)}
                                                    className={`h-4 w-4 rounded-full border-2 transition-all flex-shrink-0 ${readOnly ? 'border-muted-foreground/30' : 'border-muted-foreground/50 hover:border-green-500 hover:bg-green-500/20'}`}
                                                />
                                                <span className="text-sm truncate flex-1">{task.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
                                        <CheckCircle2 className="h-6 w-6 text-green-500/50 mb-2" />
                                        <p className="text-xs">All clear!</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Recent Chats */}
                    <Card className="rounded-xl bg-secondary/20 border-white/10">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-primary" />
                                Recent Chats
                                <button onClick={() => navigate(`${baseUrl}/chat`)} className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1">
                                    All <ArrowRight className="h-3 w-3" />
                                </button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-2">
                            <ScrollArea className="h-[180px]">
                                {recentChats.length > 0 ? (
                                    <div className="px-2 space-y-1">
                                        {recentChats.map((chat) => (
                                            <button
                                                key={chat.id}
                                                onClick={() => navigate(`${baseUrl}/chat?session=${chat.id}`)}
                                                className="w-full group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all text-left"
                                            >
                                                <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                    <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate">{chat.title}</p>
                                                    <p className="text-[10px] text-muted-foreground">{chat.message_count} msgs</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-8">
                                        <MessageSquare className="h-6 w-6 opacity-30 mb-2" />
                                        <p className="text-xs">No chats yet</p>
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>

                    {/* Activity Feed - Clickable Items */}
                    <Card className="rounded-xl bg-secondary/20 border-white/10">
                        <CardHeader className="pb-2 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-accent" />
                                Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-2 pb-2">
                            <ScrollArea className="h-[180px]">
                                <div className="px-2 space-y-0">
                                    {recentActivity.slice(0, 10).map((act, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (act.type === 'file') navigate(`${baseUrl}/editor/${act.item.id}`);
                                                else if (act.type === 'task') navigate(`${baseUrl}/tasks`);
                                            }}
                                            className="w-full text-left flex items-center gap-3 py-2 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors group"
                                        >
                                            <div className={`h-1.5 w-1.5 rounded-full ${act.type === 'task' ? 'bg-green-500' : 'bg-primary'}`} />
                                            <span className="text-sm truncate flex-1 group-hover:text-primary transition-colors">{act.item.name || act.item.title}</span>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(act.date), { addSuffix: false })}</span>
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
            PINNED ARTIFACTS
        ═══════════════════════════════════════════════════════════════════ */}
                <Card className="rounded-xl bg-secondary/20 border-white/10">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            Pinned Artifacts
                            <button onClick={() => navigate(`${baseUrl}/files`)} className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-1">
                                All Files <ArrowRight className="h-3 w-3" />
                            </button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="flex gap-3 overflow-x-auto pb-1">
                            {stats.highPriorityFiles.length > 0 ? (
                                stats.highPriorityFiles.map(file => (
                                    <button
                                        key={file.id}
                                        onClick={() => setPreviewFile(file)}
                                        className="flex-shrink-0 w-32 p-3 rounded-2xl bg-secondary/30 border border-white/10 hover:border-primary/30 transition-all hover:-translate-y-0.5 text-left"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                        </div>
                                        <p className="font-medium text-xs truncate">{file.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(file.last_edited))} ago</p>
                                    </button>
                                ))
                            ) : (
                                <div className="w-full text-center py-4 text-muted-foreground text-xs">
                                    <Star className="h-4 w-4 mx-auto mb-1 opacity-30" />
                                    No pinned artifacts. Star important files to pin them here.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
            FLOATING ACTION BAR
        ═══════════════════════════════════════════════════════════════════ */}
            {!readOnly && (
                <div className="hidden md:block fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-1 bg-black/90 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl">
                        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="rounded-xl hover:bg-white/10 px-4">
                                    <CheckCircle2 className="h-4 w-4 mr-2" /> Task <span className="ml-2 text-[10px] opacity-50 font-mono">N</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
                                <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
                                    <Input placeholder="What needs to be done?" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} autoFocus required />
                                    <Button type="submit" className="w-full">Create Task</Button>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <div className="w-px h-6 bg-white/10" />

                        <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="rounded-xl hover:bg-white/10 px-4">
                                    <FileText className="h-4 w-4 mr-2" /> Doc <span className="ml-2 text-[10px] opacity-50 font-mono">D</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>New Document</DialogTitle></DialogHeader>
                                <Tabs defaultValue="create" className="w-full pt-2">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="create">Create</TabsTrigger>
                                        <TabsTrigger value="upload">Upload</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="create">
                                        <form onSubmit={handleCreateDoc} className="space-y-4 pt-4">
                                            <Input placeholder="document-name.md" value={newDocName} onChange={e => setNewDocName(e.target.value)} autoFocus required />
                                            <Button type="submit" className="w-full">Create</Button>
                                        </form>
                                    </TabsContent>
                                    <TabsContent value="upload" className="pt-4">
                                        <Input type="file" onChange={handleUpload} />
                                    </TabsContent>
                                </Tabs>
                            </DialogContent>
                        </Dialog>

                        <div className="w-px h-6 bg-white/10" />

                        <Button variant="ghost" size="sm" className="rounded-xl hover:bg-white/10 px-4" onClick={() => document.getElementById('quick-up')?.click()}>
                            <Upload className="h-4 w-4 mr-2" /> Upload <span className="ml-2 text-[10px] opacity-50 font-mono">U</span>
                        </Button>
                        <input id="quick-up" type="file" className="hidden" onChange={handleUpload} />
                    </div>
                </div>
            )}

            {/* Preview Modal for Pinned Items */}
            <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-mono">{previewFile?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-black/50 rounded-xl border border-white/10 p-4 overflow-auto flex items-center justify-center">
                        {previewFile?.type === 'asset' && previewFile.content.startsWith('data:image') ? (
                            <img src={previewFile.content} alt={previewFile.name} className="max-w-full max-h-full rounded-lg" />
                        ) : (
                            <pre className="w-full h-full text-left font-mono text-sm whitespace-pre-wrap">
                                {previewFile?.content || 'No content.'}
                            </pre>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => setPreviewFile(null)}>Close</Button>
                        <Button variant="secondary" className="rounded-xl" onClick={() => handleDownload(previewFile)}>
                            <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                        <Button variant="secondary" className="rounded-xl" onClick={() => handleDownload(previewFile)}>
                            <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
                        <Button className="rounded-xl" onClick={() => { setPreviewFile(null); navigate(`${baseUrl}/editor/${previewFile.id}`); }}>
                            <ExternalLink className="h-4 w-4 mr-2" /> Open Editor
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
