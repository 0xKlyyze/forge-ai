import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import {
    Send, MessageSquare, CheckCircle2, Sparkles, Bot,
    ArrowRight, Flame, Clock, FolderOpen, FileText,
    Zap, TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../utils/api';
import { toast } from 'sonner';

// Glassmorphism Widget Container
export function WidgetCard({ children, className = '', title, icon: Icon, action }) {
    return (
        <Card className={`
            relative overflow-hidden
            bg-gradient-to-br from-white/[0.07] to-white/[0.02]
            backdrop-blur-xl border-white/10
            hover:border-white/20 transition-all duration-300
            group
            ${className}
        `}>
            {/* Subtle gradient glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {title && (
                <CardHeader className="pb-3 relative">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            {Icon && <Icon className="h-4 w-4 text-primary" />}
                            {title}
                        </CardTitle>
                        {action}
                    </div>
                </CardHeader>
            )}
            <CardContent className="relative">
                {children}
            </CardContent>
        </Card>
    );
}

// AI Quick Message Widget
export function AIQuickMessage({ projects, onMessageSent }) {
    const [message, setMessage] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim() || !selectedProject) {
            if (!selectedProject) toast.error("Please select a project first");
            return;
        }

        setLoading(true);
        try {
            // Create new chat session and send message
            const sessionRes = await api.post(`/projects/${selectedProject}/chat-sessions`);
            const sessionId = sessionRes.data.id;

            await api.post(`/chat-sessions/${sessionId}/messages`, {
                message: message,
                context_mode: 'selective',
                referenced_files: [],
                web_search: false,
                model_preset: 'fast'
            });

            toast.success("Message sent to AI Advisor!");
            navigate(`/project/${selectedProject}/chat?session=${sessionId}`);
        } catch (error) {
            toast.error("Failed to send message");
        } finally {
            setLoading(false);
        }
    };

    return (
        <WidgetCard
            title="AI ADVISOR"
            icon={Bot}
            className="col-span-full lg:col-span-1"
        >
            <form onSubmit={handleSend} className="space-y-3">
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="bg-secondary/50 border-white/10 h-9 text-sm">
                        <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                        {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                                {p.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <Input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Ask me anything..."
                        className="pr-12 bg-secondary/50 border-white/10 h-12 text-base"
                        disabled={loading}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={loading || !message.trim() || !selectedProject}
                        className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-primary hover:bg-primary/90"
                    >
                        {loading ? (
                            <Sparkles className="h-4 w-4 animate-pulse" />
                        ) : (
                            <Send className="h-4 w-4" />
                        )}
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                    Get instant help with architecture, code, or planning
                </p>
            </form>
        </WidgetCard>
    );
}

// Recent Conversations Widget
export function RecentConversations({ conversations }) {
    if (conversations.length === 0) {
        return (
            <WidgetCard title="RECENT CHATS" icon={MessageSquare}>
                <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs mt-1">Start chatting with the AI Advisor above</p>
                </div>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard
            title="RECENT CHATS"
            icon={MessageSquare}
            action={
                <Link to="/dashboard" className="text-xs text-primary hover:underline flex items-center gap-1">
                    View all <ArrowRight className="h-3 w-3" />
                </Link>
            }
        >
            <div className="space-y-2">
                {conversations.map((conv) => (
                    <Link
                        key={conv.id}
                        to={`/project/${conv.project_id}/chat?session=${conv.id}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                {conv.title}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="truncate">{conv.project_name}</span>
                                <span className="opacity-50">•</span>
                                <span>{conv.message_count} msgs</span>
                            </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                ))}
            </div>
        </WidgetCard>
    );
}

// Priority Tasks Widget
export function PriorityTasks({ tasks, onTaskComplete }) {
    const handleToggle = async (task) => {
        try {
            await api.put(`/tasks/${task.id}`, { status: 'done' });
            toast.success("Task completed! 🎉");
            if (onTaskComplete) onTaskComplete(task.id);
        } catch (error) {
            toast.error("Failed to update task");
        }
    };

    if (tasks.length === 0) {
        return (
            <WidgetCard title="PRIORITY TASKS" icon={Flame}>
                <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-green-500" />
                    <p className="text-sm">All caught up!</p>
                    <p className="text-xs mt-1">No urgent tasks right now</p>
                </div>
            </WidgetCard>
        );
    }

    return (
        <WidgetCard
            title="PRIORITY TASKS"
            icon={Flame}
            action={
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                    {tasks.length} urgent
                </span>
            }
        >
            <ScrollArea className="h-[180px]">
                <div className="space-y-2">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                            <button
                                onClick={() => handleToggle(task)}
                                className="mt-0.5 flex-shrink-0"
                            >
                                <div className="h-5 w-5 rounded-full border-2 border-muted-foreground hover:border-green-500 hover:bg-green-500/20 transition-all" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <Link
                                    to={`/project/${task.project_id}/tasks`}
                                    className="text-sm font-medium hover:text-primary transition-colors block truncate"
                                >
                                    {task.title}
                                </Link>
                                <p className="text-xs text-muted-foreground truncate">
                                    {task.project_name}
                                </p>
                            </div>
                            <span className="text-[10px] font-mono uppercase bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded flex-shrink-0">
                                {task.priority}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </WidgetCard>
    );
}

// Quick Stats Widget
export function QuickStats({ projects, conversations, tasks }) {
    const totalFiles = projects.reduce((sum, p) => sum + (p.file_count || 0), 0);
    const totalTasks = projects.reduce((sum, p) => sum + (p.task_count || 0), 0);
    const completedTasks = projects.reduce((sum, p) => sum + (p.completed_tasks || 0), 0);

    const stats = [
        { label: 'Projects', value: projects.length, icon: FolderOpen, color: 'text-blue-400' },
        { label: 'Files', value: totalFiles, icon: FileText, color: 'text-green-400' },
        { label: 'Tasks', value: `${completedTasks}/${totalTasks}`, icon: CheckCircle2, color: 'text-purple-400' },
        { label: 'Chats', value: conversations.length, icon: MessageSquare, color: 'text-amber-400' },
    ];

    return (
        <WidgetCard title="QUICK STATS" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-3">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white/5 rounded-lg p-3 text-center">
                        <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                        <div className="text-lg font-bold">{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{stat.label}</div>
                    </div>
                ))}
            </div>
        </WidgetCard>
    );
}

// Enhanced Project Card
export function ProjectCard({ project, onDelete }) {
    const statusColors = {
        planning: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
        building: 'from-green-500/20 to-green-500/5 border-green-500/30',
        complete: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
    };

    const statusDots = {
        planning: 'bg-yellow-500',
        building: 'bg-green-500',
        complete: 'bg-blue-500',
    };

    return (
        <Link to={`/project/${project.id}`}>
            <Card className={`
                h-[180px] relative overflow-hidden
                bg-gradient-to-br ${statusColors[project.status] || statusColors.planning}
                backdrop-blur-sm border
                hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10
                transition-all duration-300 cursor-pointer group
            `}>
                {/* Animated gradient border on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ transform: 'translateX(-100%)', animation: 'shimmer 2s infinite' }} />

                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="font-mono text-lg truncate pr-4 group-hover:text-primary transition-colors">
                            {project.name}
                        </CardTitle>
                    </div>
                </CardHeader>

                <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={`h-2 w-2 rounded-full ${statusDots[project.status] || statusDots.planning}`} />
                        <span className="capitalize">{project.status}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {project.file_count || 0} files
                        </span>
                        <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {project.completed_tasks || 0}/{project.task_count || 0} tasks
                        </span>
                    </div>
                </CardContent>

                <div className="absolute bottom-0 w-full bg-black/30 p-3 border-t border-white/5">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {project.status === 'building' ? 'ACTIVE' : 'STANDBY'}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {project.last_edited ? formatDistanceToNow(new Date(project.last_edited), { addSuffix: true }) : 'Recently'}
                        </span>
                    </div>
                </div>
            </Card>
        </Link>
    );
}
