import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import {
    Sparkles, Send, Globe, FileText, Bot, User, Paperclip, Plus,
    MessageSquare, Trash2, ChevronLeft, Brain, Zap, Leaf, ChevronDown,
    Copy, Check, Clock, ArrowRight, Lightbulb, Pin
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function ProjectChat() {
    const { projectId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Session state
    const [sessions, setSessions] = useState([]);
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [showSidebar, setShowSidebar] = useState(true);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState([]);

    // Settings
    const [isFullContext, setIsFullContext] = useState(false);
    const [isWebSearch, setIsWebSearch] = useState(false);
    const [modelPreset, setModelPreset] = useState('fast');
    const [models, setModels] = useState({});
    const [showModelPicker, setShowModelPicker] = useState(false);

    // Reference Logic
    const [referencedFiles, setReferencedFiles] = useState([]);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [fileSearch, setFileSearch] = useState('');

    // Delete confirmation
    const [deleteConfirmSession, setDeleteConfirmSession] = useState(null);

    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Load sessions on mount
    useEffect(() => {
        fetchSessions();
        fetchFiles();
        fetchModels();
    }, [projectId]);

    // Check URL for session ID
    useEffect(() => {
        const sessionId = searchParams.get('session');
        if (sessionId && sessionId !== currentSessionId) {
            loadSession(sessionId);
        }
    }, [searchParams]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchSessions = async () => {
        try {
            const res = await api.get(`/projects/${projectId}/chat-sessions`);
            setSessions(res.data);

            const sessionId = searchParams.get('session');
            if (!sessionId && res.data.length > 0) {
                loadSession(res.data[0].id);
            } else if (!sessionId && res.data.length === 0) {
                createNewSession();
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchFiles = async () => {
        try {
            const res = await api.get(`/projects/${projectId}/files`);
            setFiles(res.data);
        } catch (error) { console.error(error); }
    };

    const fetchModels = async () => {
        try {
            const res = await api.get('/models');
            setModels(res.data);
        } catch (error) { console.error(error); }
    };

    const getModelIcon = (preset) => {
        switch (preset) {
            case 'powerful': return <Brain className="h-3.5 w-3.5" />;
            case 'fast': return <Zap className="h-3.5 w-3.5" />;
            case 'efficient': return <Leaf className="h-3.5 w-3.5" />;
            default: return <Zap className="h-3.5 w-3.5" />;
        }
    };

    const getModelColor = (preset) => {
        switch (preset) {
            case 'powerful': return 'text-purple-400';
            case 'fast': return 'text-accent';
            case 'efficient': return 'text-green-400';
            default: return 'text-accent';
        }
    };

    const loadSession = async (sessionId) => {
        try {
            const res = await api.get(`/chat-sessions/${sessionId}`);
            setCurrentSessionId(sessionId);
            setMessages(res.data.messages || []);
            setSearchParams({ session: sessionId });
        } catch (error) {
            console.error(error);
            toast.error("Failed to load chat session");
        }
    };

    const createNewSession = async () => {
        try {
            const res = await api.post(`/projects/${projectId}/chat-sessions`);
            setSessions(prev => [res.data, ...prev]);
            setCurrentSessionId(res.data.id);
            setMessages(res.data.messages || []);
            setSearchParams({ session: res.data.id });
        } catch (error) {
            console.error(error);
            toast.error("Failed to create chat session");
        }
    };

    const confirmDeleteSession = async () => {
        if (!deleteConfirmSession) return;
        const sessionId = deleteConfirmSession;

        try {
            await api.delete(`/chat-sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s.id !== sessionId));

            if (sessionId === currentSessionId) {
                const remaining = sessions.filter(s => s.id !== sessionId);
                if (remaining.length > 0) {
                    loadSession(remaining[0].id);
                } else {
                    createNewSession();
                }
            }
            toast.success("Conversation deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete conversation");
        } finally {
            setDeleteConfirmSession(null);
        }
    };

    const togglePin = async (sessionId, currentPinned, e) => {
        e.stopPropagation();
        try {
            await api.put(`/chat-sessions/${sessionId}`, { pinned: !currentPinned });
            setSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, pinned: !currentPinned } : s
            ).sort((a, b) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.updated_at) - new Date(a.updated_at);
            }));
            toast.success(currentPinned ? "Unpinned" : "Pinned");
        } catch (error) {
            toast.error("Failed to update");
        }
    };

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!input.trim() || loading || !currentSessionId) return;

        const userMsg = { role: 'user', content: input, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        const filesForContext = referencedFiles.map(f => f.id);
        setReferencedFiles([]);

        try {
            const res = await api.post(`/chat-sessions/${currentSessionId}/messages`, {
                message: userMsg.content,
                context_mode: isFullContext ? 'all' : 'selective',
                referenced_files: filesForContext,
                web_search: isWebSearch,
                model_preset: modelPreset
            });

            setMessages(prev => [...prev, res.data.ai_message]);
            fetchSessions();
        } catch (error) {
            toast.error("AI connection failed");
            setMessages(prev => [...prev, { role: 'model', content: "Error: Could not connect to intelligence core." }]);
        } finally {
            setLoading(false);
        }
    };

    // Quick prompts for empty state
    const quickPrompts = [
        { icon: Lightbulb, text: "Help me brainstorm ideas for this project" },
        { icon: FileText, text: "Summarize my project files" },
        { icon: Zap, text: "What should I work on next?" }
    ];

    const sendQuickPrompt = (text) => {
        setInput(text);
        setTimeout(() => handleSend(), 100);
    };

    // Input Handler for @ Mentions
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);

        const lastChar = val.slice(-1);
        if (lastChar === '@') {
            setShowFilePicker(true);
            setFileSearch('');
        } else if (showFilePicker) {
            const match = val.match(/@([\w\s\.-]*)$/);
            if (match) {
                setFileSearch(match[1]);
            } else {
                setShowFilePicker(false);
            }
        }
    };

    const selectFile = (file) => {
        const newVal = input.replace(/@[\w\s\.-]*$/, `@${file.name} `);
        setInput(newVal);
        setReferencedFiles(prev => [...prev, file]);
        setShowFilePicker(false);
        inputRef.current?.focus();
    };

    return (
        <div className="h-full flex bg-background/50 relative">

            {/* Chat History Sidebar */}
            <div className={`
                ${showSidebar ? 'w-72' : 'w-0'} 
                flex-shrink-0 border-r border-white/5 bg-black/30 backdrop-blur-sm
                transition-all duration-300 overflow-hidden
            `}>
                <div className="p-4 h-full flex flex-col w-72">
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold">Conversations</h3>
                        <Button
                            size="sm"
                            className="h-8 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary"
                            onClick={createNewSession}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            New
                        </Button>
                    </div>

                    {/* Sessions List */}
                    <ScrollArea className="flex-1 -mx-2">
                        <div className="space-y-1 px-2">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    className={`
                                        group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all
                                        ${session.id === currentSessionId
                                            ? 'bg-primary/20 border border-primary/30'
                                            : 'hover:bg-white/5 border border-transparent'}
                                        ${session.pinned ? 'ring-1 ring-accent/30' : ''}
                                    `}
                                >
                                    {/* Icon */}
                                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${session.id === currentSessionId ? 'bg-primary/30' : 'bg-secondary/50'
                                        }`}>
                                        {session.pinned ? (
                                            <Pin className="h-4 w-4 text-accent fill-accent" />
                                        ) : (
                                            <MessageSquare className={`h-4 w-4 ${session.id === currentSessionId ? 'text-primary' : 'text-muted-foreground'}`} />
                                        )}
                                    </div>

                                    {/* Title - constrained width */}
                                    <div className="flex-1 min-w-0 max-w-[120px]">
                                        <p className="text-sm font-medium truncate">{session.title}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {formatDistanceToNow(new Date(session.updated_at))} ago
                                        </p>
                                    </div>

                                    {/* Actions - always visible space reserved */}
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                            onClick={(e) => togglePin(session.id, session.pinned, e)}
                                            className={`p-1 rounded-md transition-all ${session.pinned
                                                ? 'text-accent'
                                                : 'opacity-0 group-hover:opacity-100 hover:bg-white/10'
                                                }`}
                                            title={session.pinned ? 'Unpin' : 'Pin'}
                                        >
                                            <Pin className={`h-3 w-3 ${session.pinned ? 'fill-current' : ''}`} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmSession(session.id); }}
                                            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Toggle Sidebar Button */}
                <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="absolute top-4 left-4 z-10 p-2 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                >
                    <ChevronLeft className={`h-4 w-4 transition-transform ${showSidebar ? '' : 'rotate-180'}`} />
                </button>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto pb-40" ref={scrollRef}>
                    <div className="max-w-4xl mx-auto p-4 pt-14 space-y-6">
                        {/* Welcome State */}
                        {messages.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center mb-6 border border-primary/30">
                                    <Sparkles className="h-10 w-10 text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">How can I help you?</h2>
                                <p className="text-muted-foreground text-center max-w-md mb-8">
                                    Ask me anything about your project. I can help with brainstorming, code, and more.
                                </p>
                                <div className="flex flex-col gap-2 w-full max-w-md">
                                    {quickPrompts.map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => sendQuickPrompt(prompt.text)}
                                            className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 border border-white/5 hover:border-primary/30 transition-all text-left group"
                                        >
                                            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                                                <prompt.icon className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className="text-sm flex-1">{prompt.text}</span>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        {messages.map((msg, i) => (
                            <MessageBubble key={i} message={msg} />
                        ))}

                        {/* Loading Indicator */}
                        {loading && (
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-primary/30">
                                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                                </div>
                                <div className="bg-secondary/40 rounded-2xl rounded-tl-md p-4 flex items-center gap-2 border border-white/5">
                                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '75ms' }} />
                                    <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                </div>
                            </div>
                        )}

                        <div className="h-32" />
                    </div>
                </div>

                {/* Input Area - positioned relative to the chat section */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pt-0">
                    <div className="max-w-3xl mx-auto">
                        {/* File Picker Popover */}
                        {showFilePicker && (
                            <div className="absolute bottom-full mb-2 w-72 bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-2 border-b border-white/5">
                                    <p className="text-xs text-muted-foreground px-2">Reference a file</p>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                    {files.filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase())).map(f => (
                                        <button
                                            key={f.id}
                                            className="w-full text-left px-4 py-2.5 hover:bg-primary/10 text-sm flex items-center gap-3 transition-colors"
                                            onClick={() => selectFile(f)}
                                        >
                                            <FileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="truncate">{f.name}</span>
                                        </button>
                                    ))}
                                    {files.length === 0 && (
                                        <div className="p-4 text-xs text-muted-foreground text-center">No files in project</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Toolbar */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-black/70 backdrop-blur-xl border border-white/10 border-b-0 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                {/* Model Selector */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowModelPicker(!showModelPicker)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-colors text-xs ${getModelColor(modelPreset)}`}
                                    >
                                        {getModelIcon(modelPreset)}
                                        <span>{models[modelPreset]?.name || 'Fast'}</span>
                                        <ChevronDown className="h-3 w-3 opacity-50" />
                                    </button>
                                    {showModelPicker && (
                                        <div className="absolute bottom-full mb-2 left-0 w-56 bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                            {Object.entries(models).map(([key, model]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => { setModelPreset(key); setShowModelPicker(false); }}
                                                    className={`w-full text-left px-4 py-3 hover:bg-primary/10 flex items-center gap-3 transition-colors ${modelPreset === key ? 'bg-primary/20' : ''}`}
                                                >
                                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${getModelColor(key)} bg-secondary/50`}>
                                                        {getModelIcon(key)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium">{model.name}</div>
                                                        <div className="text-xs text-muted-foreground">{model.description}</div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="h-5 w-px bg-white/10" />

                                {/* Toggles */}
                                <div className="flex items-center gap-2">
                                    <Switch id="web-search" checked={isWebSearch} onCheckedChange={setIsWebSearch} className="scale-90" />
                                    <Label htmlFor="web-search" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                                        <Globe className="h-3.5 w-3.5" /> Web
                                    </Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Switch id="full-context" checked={isFullContext} onCheckedChange={setIsFullContext} className="scale-90" />
                                    <Label htmlFor="full-context" className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                                        <Paperclip className="h-3.5 w-3.5" /> All Files
                                    </Label>
                                </div>
                            </div>

                            {/* Referenced Files */}
                            {referencedFiles.length > 0 && (
                                <div className="flex items-center gap-2">
                                    {referencedFiles.map(f => (
                                        <span key={f.id} className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-lg flex items-center gap-1">
                                            <FileText className="h-3 w-3" />
                                            {f.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input Box */}
                        <form onSubmit={handleSend} className="relative">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={handleInputChange}
                                placeholder="Ask anything... (@ to reference files)"
                                className="h-14 pl-5 pr-14 rounded-b-2xl rounded-t-none border-t-0 border-white/10 bg-secondary/80 backdrop-blur-xl shadow-2xl focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={loading || !input.trim()}
                                className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 transition-all"
                            >
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirmSession} onOpenChange={(open) => !open && setDeleteConfirmSession(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Conversation?</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete this conversation and all its messages.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            onClick={() => setDeleteConfirmSession(null)}
                            className="rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDeleteSession}
                            className="rounded-xl"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubble({ message }) {
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedMessage, setCopiedMessage] = useState(false);
    const isUser = message.role === 'user';

    const copyCodeToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const copyMessageToClipboard = () => {
        navigator.clipboard.writeText(message.content);
        setCopiedMessage(true);
        setTimeout(() => setCopiedMessage(false), 2000);
    };

    return (
        <div className={`group/msg flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && (
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center flex-shrink-0 border border-primary/30">
                    <Bot className="h-5 w-5 text-primary" />
                </div>
            )}

            {/* Copy message button - left side for AI */}
            {!isUser && (
                <button
                    onClick={copyMessageToClipboard}
                    className="self-start mt-1 p-1.5 rounded-lg opacity-0 group-hover/msg:opacity-100 hover:bg-white/10 transition-all"
                    title="Copy message"
                >
                    {copiedMessage ? (
                        <Check className="h-4 w-4 text-green-500" />
                    ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>
            )}

            <div className={`
                max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed
                ${isUser
                    ? 'bg-primary text-primary-foreground rounded-tr-md'
                    : 'bg-secondary/40 border border-white/5 rounded-tl-md backdrop-blur-md'}
            `}>
                <ReactMarkdown
                    components={{
                        code: ({ node, inline, className, children, ...props }) => {
                            const codeText = String(children).replace(/\n$/, '');
                            return !inline ? (
                                <div className="relative group my-3">
                                    <div className="bg-black/60 rounded-xl border border-white/10 overflow-hidden">
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/40">
                                            <span className="text-xs text-muted-foreground font-mono">
                                                {className?.replace('language-', '') || 'code'}
                                            </span>
                                            <button
                                                onClick={() => copyCodeToClipboard(codeText)}
                                                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                            >
                                                {copiedCode ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                {copiedCode ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                        <pre className="p-3 overflow-x-auto">
                                            <code className="text-xs font-mono">{children}</code>
                                        </pre>
                                    </div>
                                </div>
                            ) : (
                                <code className="bg-black/30 rounded px-1.5 py-0.5 font-mono text-xs" {...props}>{children}</code>
                            )
                        },
                        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                        a: ({ href, children }) => <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground mb-3">{children}</blockquote>,
                    }}
                >
                    {message.content}
                </ReactMarkdown>
            </div>

            {/* Copy message button - right side for user */}
            {isUser && (
                <button
                    onClick={copyMessageToClipboard}
                    className="self-start mt-1 p-1.5 rounded-lg opacity-0 group-hover/msg:opacity-100 hover:bg-white/10 transition-all"
                    title="Copy message"
                >
                    {copiedMessage ? (
                        <Check className="h-4 w-4 text-green-500" />
                    ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>
            )}

            {isUser && (
                <div className="h-10 w-10 rounded-2xl bg-secondary/50 flex items-center justify-center flex-shrink-0 border border-white/10">
                    <User className="h-5 w-5" />
                </div>
            )}
        </div>
    );
}
