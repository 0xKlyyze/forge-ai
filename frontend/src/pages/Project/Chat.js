import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Sparkles, Send, Globe, FileText, Bot, User, Paperclip, Plus, MessageSquare, Trash2, ChevronLeft, Brain, Zap, Leaf, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

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

            // If no session in URL and sessions exist, load the most recent one
            const sessionId = searchParams.get('session');
            if (!sessionId && res.data.length > 0) {
                loadSession(res.data[0].id);
            } else if (!sessionId && res.data.length === 0) {
                // No sessions exist, create one
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
            case 'powerful': return <Brain className="h-3 w-3" />;
            case 'fast': return <Zap className="h-3 w-3" />;
            case 'efficient': return <Leaf className="h-3 w-3" />;
            default: return <Zap className="h-3 w-3" />;
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

    const deleteSession = async (sessionId, e) => {
        e.stopPropagation();
        if (!confirm("Delete this conversation?")) return;

        try {
            await api.delete(`/chat-sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s.id !== sessionId));

            // If deleted current session, switch to another or create new
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
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading || !currentSessionId) return;

        const userMsg = { role: 'user', content: input };
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

            // Update session title in sidebar if it was auto-generated
            fetchSessions();
        } catch (error) {
            toast.error("AI connection failed");
            setMessages(prev => [...prev, { role: 'model', content: "Error: Could not connect to intelligence core." }]);
        } finally {
            setLoading(false);
        }
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
        ${showSidebar ? 'w-64' : 'w-0'} 
        flex-shrink-0 border-r border-white/5 bg-black/20 backdrop-blur-sm
        transition-all duration-300 overflow-hidden
      `}>
                <div className="p-4 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Chat History</h3>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={createNewSession}
                            title="New Chat"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="space-y-1">
                            {sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => loadSession(session.id)}
                                    className={`
                    group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all
                    ${session.id === currentSessionId
                                            ? 'bg-primary/20 text-primary'
                                            : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'}
                  `}
                                >
                                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm truncate">{session.title}</p>
                                        <p className="text-xs opacity-50">{session.message_count} messages</p>
                                    </div>
                                    <button
                                        onClick={(e) => deleteSession(session.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toggle Sidebar Button */}
                <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                    <ChevronLeft className={`h-4 w-4 transition-transform ${showSidebar ? '' : 'rotate-180'}`} />
                </button>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 pt-14 space-y-6" ref={scrollRef}>
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/30">
                                    <Bot className="h-5 w-5 text-primary" />
                                </div>
                            )}
                            <div className={`
                max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed
                ${msg.role === 'user'
                                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                    : 'bg-secondary/40 border border-white/5 rounded-tl-sm backdrop-blur-md'}
              `}>
                                <ReactMarkdown
                                    components={{
                                        code: ({ node, inline, className, children, ...props }) => {
                                            return !inline ? (
                                                <div className="bg-black/50 rounded p-2 my-2 overflow-x-auto border border-white/10 font-mono text-xs">
                                                    {children}
                                                </div>
                                            ) : (
                                                <code className="bg-black/20 rounded px-1 py-0.5 font-mono text-xs" {...props}>{children}</code>
                                            )
                                        }
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                            {msg.role === 'user' && (
                                <div className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center flex-shrink-0">
                                    <User className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-4">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                            </div>
                            <div className="bg-secondary/40 rounded-2xl p-4 flex items-center gap-2">
                                <span className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                                <span className="h-2 w-2 bg-primary rounded-full animate-bounce delay-75" />
                                <span className="h-2 w-2 bg-primary rounded-full animate-bounce delay-150" />
                            </div>
                        </div>
                    )}
                    <div className="h-24" />
                </div>

                {/* Input Area */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-3xl z-20">
                    {/* File Picker Popover */}
                    {showFilePicker && (
                        <div className="absolute bottom-full mb-2 w-64 bg-background border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                            {files.filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase())).map(f => (
                                <button
                                    key={f.id}
                                    className="w-full text-left px-4 py-2 hover:bg-primary/10 text-sm flex items-center gap-2"
                                    onClick={() => selectFile(f)}
                                >
                                    <FileText className="h-3 w-3 opacity-50" />
                                    {f.name}
                                </button>
                            ))}
                            {files.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">No files found</div>}
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-t-2xl">
                        <div className="flex items-center gap-4">
                            {/* Model Selector */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowModelPicker(!showModelPicker)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/80 transition-colors text-xs"
                                >
                                    {getModelIcon(modelPreset)}
                                    <span className="text-muted-foreground">{models[modelPreset]?.name || 'Fast'}</span>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </button>
                                {showModelPicker && (
                                    <div className="absolute bottom-full mb-2 left-0 w-48 bg-background border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                                        {Object.entries(models).map(([key, model]) => (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => { setModelPreset(key); setShowModelPicker(false); }}
                                                className={`w-full text-left px-4 py-3 hover:bg-primary/10 flex items-center gap-3 transition-colors ${modelPreset === key ? 'bg-primary/20 text-primary' : ''}`}
                                            >
                                                {getModelIcon(key)}
                                                <div>
                                                    <div className="text-sm font-medium">{model.name}</div>
                                                    <div className="text-xs text-muted-foreground">{model.description}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="h-4 w-px bg-white/10" />
                            <div className="flex items-center gap-2">
                                <Switch id="web-search" checked={isWebSearch} onCheckedChange={setIsWebSearch} />
                                <Label htmlFor="web-search" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                                    <Globe className="h-3 w-3" /> Web
                                </Label>
                            </div>
                            <div className="h-4 w-px bg-white/10" />
                            <div className="flex items-center gap-2">
                                <Switch id="full-context" checked={isFullContext} onCheckedChange={setIsFullContext} />
                                <Label htmlFor="full-context" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                                    <Paperclip className="h-3 w-3" /> Full Context
                                </Label>
                            </div>
                        </div>
                        {referencedFiles.length > 0 && (
                            <div className="text-xs text-primary flex items-center gap-1">
                                <span className="bg-primary/10 px-2 py-0.5 rounded-full">{referencedFiles.length} files attached</span>
                            </div>
                        )}
                    </div>

                    {/* Input Box */}
                    <form onSubmit={handleSend} className="relative">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Ask Forge AI... (Type @ to reference files)"
                            className="h-14 pl-6 pr-14 rounded-b-2xl rounded-t-none border-t-0 border-white/10 bg-secondary/80 backdrop-blur-xl shadow-2xl focus-visible:ring-0 focus-visible:bg-secondary text-base"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={loading || !input.trim()}
                            className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
