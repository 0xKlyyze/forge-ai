import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import {
    Sparkles, Send, Globe, FileText, Bot, User, Paperclip, Plus,
    MessageSquare, Trash2, ChevronLeft, Brain, Zap, Leaf, ChevronDown,
    Copy, Check, Clock, ArrowRight, Lightbulb, Pin, Wand2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useProjectContext } from '../../context/ProjectContext';
import {
    useChatSessions, useModels, useChatSession,
    useCreateChatSession, useDeleteChatSession, useUpdateChatSession, useSendChatMessage,
    useProjectTasks, useExecuteToolCall, useUpdateFile, useEditDocument, useAcceptDocumentChanges,
} from '../../hooks/useProjectQueries';
import { SquareCheck, FileText as FileIcon } from 'lucide-react';
import { ChatSkeleton } from '../../components/skeletons/PageSkeletons';
import { AgentEditorPanel, CreatedDocumentCard, CreatedTasksCard, EditedDocumentCard } from '../../components/chat/AgentEditorPanel';



export default function ProjectChat() {
    const { projectId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Get files from context
    const { files: contextFiles, isLoadingFiles } = useProjectContext();
    const files = contextFiles || [];

    // Get tasks
    const tasksQuery = useProjectTasks(projectId);
    const tasks = tasksQuery.data || [];

    // React Query hooks for sessions and models
    const sessionsQuery = useChatSessions(projectId);
    const modelsQuery = useModels();
    const createSessionMutation = useCreateChatSession(projectId);
    const deleteSessionMutation = useDeleteChatSession(projectId);
    const updateSessionMutation = useUpdateChatSession(projectId);
    const sendMessageMutation = useSendChatMessage(projectId);
    const executeToolMutation = useExecuteToolCall(projectId);
    const updateFileMutation = useUpdateFile(projectId);
    const editDocumentMutation = useEditDocument(projectId);
    const acceptChangesMutation = useAcceptDocumentChanges(projectId);

    const sessions = sessionsQuery.data || [];
    const models = modelsQuery.data || {};

    // Session state
    const [currentSessionId, setCurrentSessionId] = useState(() => {
        // Initialize from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('session') || null;
    });
    const [messages, setMessages] = useState([]);
    const [showSidebar, setShowSidebar] = useState(true);
    const [sessionLoading, setSessionLoading] = useState(false);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Settings
    const [isFullContext, setIsFullContext] = useState(false);
    const [isWebSearch, setIsWebSearch] = useState(false);
    const [modelPreset, setModelPreset] = useState('fast');
    const [showModelPicker, setShowModelPicker] = useState(false);

    // Reference Logic
    const [referencedItems, setReferencedItems] = useState([]); // Array of { type: 'file' | 'task', id, name/title }
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');

    // Delete confirmation
    const [deleteConfirmSession, setDeleteConfirmSession] = useState(null);

    // Agentic AI state - Editor panel for created/modified documents
    const [agentFile, setAgentFile] = useState(null); // Currently open file in editor panel
    const [editorPanelOpen, setEditorPanelOpen] = useState(false);
    const [isSavingFile, setIsSavingFile] = useState(false);
    const [createdFilesMap, setCreatedFilesMap] = useState({}); // Map<messageIndex, fileInfo> - persists cards even when panel closed

    // Document editing state - For diff view
    const [editedFilesMap, setEditedFilesMap] = useState({}); // Map<messageIndex, { file, originalContent, editType, editSummary }>
    const [isDiffMode, setIsDiffMode] = useState(false);
    const [originalContent, setOriginalContent] = useState('');
    const [editSummary, setEditSummary] = useState('');


    // Track initialization and mount status
    const hasInitialized = useRef(false);
    const isMounted = useRef(true);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Track mount status to prevent state updates after unmount
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Initialize session ONLY once when sessions first load
    useEffect(() => {
        if (sessionsQuery.isLoading || hasInitialized.current) return;

        const sessionId = searchParams.get('session');

        if (sessionId) {
            // URL has session ID - load it
            loadSession(sessionId);
            hasInitialized.current = true;
        } else if (sessions.length > 0) {
            // No session in URL, but sessions exist - load first one without triggering URL change yet
            loadSession(sessions[0].id, true);
            hasInitialized.current = true;
        } else if (sessions.length === 0 && !createSessionMutation.isPending) {
            // No sessions at all - create new one
            createNewSession();
            hasInitialized.current = true;
        }
    }, [sessionsQuery.isLoading, sessions.length]);

    // Handle URL changes (when user clicks session in sidebar)
    useEffect(() => {
        const sessionId = searchParams.get('session');
        if (sessionId && sessionId !== currentSessionId && hasInitialized.current) {
            loadSession(sessionId);
        }
    }, [searchParams]);

    // Reset initialization when project changes
    useEffect(() => {
        hasInitialized.current = false;
        setCurrentSessionId(null);
        setMessages([]);
    }, [projectId]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Rehydrate agent state (cards) from message history
    useEffect(() => {
        if (!messages.length) return;

        const newCreatedMap = {};
        const newEditedMap = {};
        let hasNewData = false;

        messages.forEach((msg, index) => {
            if (msg.role === 'model' && msg.tool_calls) {
                // Calculate message index (1-based from user/model pairs usually, but here we just map to the array index + 1 or similar?)
                // Actually `MessageBubble` uses flat array index `i`.
                // In handleSend, we used `messages.length + 1` which assumes the new AI message is appended.
                // The map key matches the index in the `messages` array. 
                // Wait, `messages.map((msg, i) => ...)` uses `i`.
                // In `handleSend`: `const aiMessageIndex = messages.length + 1;` 
                // This logic in handleSend is slightly flawed because it predicts the index.
                // If we use the iteration index `index` here, it should match the `i` passed to MessageBubble.

                msg.tool_calls.forEach(tool => {
                    // Rehydrate Created Documents
                    if (tool.tool_name === 'create_document') {
                        // Check if we already have it (to avoid overwriting active state if any)
                        if (!createdFilesMap[index]) {
                            newCreatedMap[index] = {
                                id: 'history', // specific ID not saved in tool args, but we have content
                                name: tool.arguments.name,
                                category: tool.arguments.category || 'Docs',
                                content: tool.arguments.content
                            };
                            hasNewData = true;
                        }
                    }

                    // Rehydrate Edited Documents
                    const editTools = ['rewrite_document', 'insert_in_document', 'replace_in_document'];
                    if (editTools.includes(tool.tool_name)) {
                        if (!editedFilesMap[index]) {
                            // Determine type
                            let type = 'edit';
                            if (tool.tool_name === 'rewrite_document') type = 'rewrite';
                            if (tool.tool_name === 'insert_in_document') type = 'insert';
                            if (tool.tool_name === 'replace_in_document') type = 'replace';

                            newEditedMap[index] = {
                                file: {
                                    name: tool.arguments.file_name,
                                    id: tool.arguments.file_id
                                },
                                editType: type,
                                editSummary: 'Edited (from history)', // We don't have the summary
                                isLoading: false,
                                // IMPORTANT: originalContent is missing in history, so diff view won't work
                                originalContent: null
                            };
                            hasNewData = true;
                        }
                    }
                });
            }
        });

        if (hasNewData) {
            setCreatedFilesMap(prev => ({ ...prev, ...newCreatedMap }));
            setEditedFilesMap(prev => ({ ...prev, ...newEditedMap }));
        }
    }, [messages]);

    // Handle content changes from the agent editor panel (auto-save)
    // NOTE: This useCallback MUST be declared before any conditional returns to satisfy React hooks rules
    // PATTERN: Matches Workspace.js - update local state immediately, debounce API save

    // Debounced save for API calls only (same pattern as Workspace.js)
    const saveAgentFileContent = useCallback(
        debounce(async (fileId, content) => {
            setIsSavingFile(true);
            try {
                await api.put(`/files/${fileId}`, { content });
            } catch (error) {
                console.error('Auto-save failed:', error);
            } finally {
                setIsSavingFile(false);
            }
        }, 1000),
        []
    );

    // Handler called on every content change
    const handleAgentFileContentChange = useCallback((fileId, newContent) => {
        if (!fileId) return;

        // Update local state immediately for smooth typing
        setAgentFile(prev => prev ? { ...prev, content: newContent } : null);

        // Also update in createdFilesMap if this file exists there
        setCreatedFilesMap(prev => {
            const newMap = { ...prev };
            for (const key in newMap) {
                if (newMap[key]?.id === fileId) {
                    newMap[key] = { ...newMap[key], content: newContent };
                }
            }
            return newMap;
        });

        // Debounced API save
        saveAgentFileContent(fileId, newContent);
    }, [saveAgentFileContent]);

    // Only show skeleton on TRUE initial load (no cached data)
    const showInitialSkeleton = sessionsQuery.isLoading && !sessionsQuery.data && !hasInitialized.current;
    if (showInitialSkeleton) {
        return <ChatSkeleton />;
    }

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

    const loadSession = async (sessionId, skipUrlUpdate = false) => {
        if (!isMounted.current) return;

        setSessionLoading(true);
        try {
            const res = await api.get(`/chat-sessions/${sessionId}`);

            // Only update state if still mounted
            if (!isMounted.current) return;

            setCurrentSessionId(sessionId);
            setMessages(res.data.messages || []);

            // Update URL without triggering navigation - only if still mounted
            if (!skipUrlUpdate && isMounted.current) {
                setSearchParams({ session: sessionId }, { replace: true });
            }
        } catch (error) {
            console.error(error);
            if (isMounted.current) {
                toast.error("Failed to load chat session");
            }
        } finally {
            if (isMounted.current) {
                setSessionLoading(false);
            }
        }
    };

    const createNewSession = async () => {
        if (!isMounted.current) return;

        try {
            const newSession = await createSessionMutation.mutateAsync();

            // Only update state if still mounted
            if (!isMounted.current) return;

            setCurrentSessionId(newSession.id);
            setMessages(newSession.messages || []);
            setSearchParams({ session: newSession.id }, { replace: true });
        } catch (error) {
            console.error(error);
            if (isMounted.current) {
                toast.error("Failed to create chat session");
            }
        }
    };

    const confirmDeleteSession = async () => {
        if (!deleteConfirmSession) return;
        const sessionId = deleteConfirmSession;

        try {
            await deleteSessionMutation.mutateAsync(sessionId);

            if (sessionId === currentSessionId) {
                const remaining = sessions.filter(s => s.id !== sessionId);
                if (remaining.length > 0) {
                    loadSession(remaining[0].id);
                } else {
                    createNewSession();
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setDeleteConfirmSession(null);
        }
    };

    const togglePin = async (sessionId, currentPinned, e) => {
        e.stopPropagation();
        try {
            await updateSessionMutation.mutateAsync({ sessionId, updates: { pinned: !currentPinned } });
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

        const referencedFiles = referencedItems.filter(i => i.type === 'file').map(i => i.id);
        const referencedTasks = referencedItems.filter(i => i.type === 'task').map(i => i.id);
        setReferencedItems([]);

        try {
            const res = await sendMessageMutation.mutateAsync({
                sessionId: currentSessionId,
                message: userMsg.content,
                contextMode: isFullContext ? 'all' : 'selective',
                referencedFiles,
                referencedTasks,
                webSearch: isWebSearch,
                modelPreset
            });

            const aiMessage = res.ai_message;
            setMessages(prev => [...prev, aiMessage]);

            // Get the index of this AI message (will be used for createdFilesMap)
            const aiMessageIndex = messages.length + 1; // Current length is before AI msg added (wait, user msg added, so length is N+1)
            // Actually, setMessages is async/batched. 
            // `messages` here refers to the state at start of render.
            // We added userMsg to `prev`. 
            // So new index is `messages.length` (user) + 1 (AI)? 
            // Valid index in the FUTURE array.

            // To be safe and consistent with rehydration, we should use the exact index it WILL have.
            // If current `messages` has length L.
            // We called setMessages(prev => [...prev, userMsg]). New length L+1. User msg at L.
            // Then setMessages(prev => [...prev, aiMsg]). New length L+2. AI msg at L+1.
            const userMsgIndex = messages.length;
            const newAiMsgIndex = messages.length + 1;

            // ═══════════════════════════════════════════════════════════════════
            // AUTO-EXECUTE DOCUMENT TOOLS - Seamless document creation
            // ═══════════════════════════════════════════════════════════════════
            if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
                for (const toolCall of aiMessage.tool_calls) {
                    if (toolCall.tool_name === 'create_document') {
                        try {
                            // Auto-execute the tool to create the document
                            const result = await executeToolMutation.mutateAsync({
                                toolName: toolCall.tool_name,
                                arguments: toolCall.arguments
                            });

                            if (result.success && result.result) {
                                const createdFile = {
                                    id: result.result.file_id,
                                    name: result.result.name,
                                    category: result.result.category,
                                    content: result.result.content
                                };

                                // Store in map for persistent card display
                                setCreatedFilesMap(prev => ({
                                    ...prev,
                                    [newAiMsgIndex]: createdFile
                                }));

                                // Set as current agent file and open editor
                                setAgentFile(createdFile);
                                setEditorPanelOpen(true);
                                setShowSidebar(false); // Collapse sidebar for more space

                                toast.success(`Created: ${result.result.name}`, {
                                    description: 'Edit in the panel or continue chatting with the AI'
                                });
                            }
                        } catch (error) {
                            console.error('Auto-execute failed:', error);
                            toast.error('Failed to create document');
                        }
                    }

                    if (toolCall.tool_name === 'create_tasks') {
                        try {
                            const result = await executeToolMutation.mutateAsync({
                                toolName: toolCall.tool_name,
                                arguments: toolCall.arguments
                            });


                            if (result.success) {
                                toast.success(`Created ${result.result.count} task(s)`);
                            }
                        } catch (error) {
                            console.error('Auto-execute failed:', error);
                            toast.error('Failed to create tasks');
                        }
                    }

                    // ═══════════════════════════════════════════════════════════════
                    // DOCUMENT EDITING TOOLS - Multi-step with diff preview
                    // ═══════════════════════════════════════════════════════════════
                    const editTools = ['rewrite_document', 'insert_in_document', 'replace_in_document'];
                    if (editTools.includes(toolCall.tool_name)) {
                        // Determine loading step text based on tool
                        const getLoadingStep = () => {
                            switch (toolCall.tool_name) {
                                case 'rewrite_document': return 'Rewriting document...';
                                case 'insert_in_document': return 'Analyzing and inserting content...';
                                case 'replace_in_document': return 'Finding and replacing content...';
                                default: return 'Processing...';
                            }
                        };

                        // Set loading state in card immediately
                        setEditedFilesMap(prev => ({
                            ...prev,
                            [newAiMsgIndex]: {
                                file: { name: toolCall.arguments.file_name },
                                isLoading: true,
                                loadingStep: getLoadingStep()
                            }
                        }));

                        try {
                            // Execute the multi-step edit
                            const result = await editDocumentMutation.mutateAsync({
                                toolName: toolCall.tool_name,
                                fileId: toolCall.arguments.file_id,
                                fileName: toolCall.arguments.file_name,
                                instructions: toolCall.arguments.instructions
                            });

                            if (result.success && result.result) {
                                const editResult = result.result;
                                const editedFile = {
                                    id: editResult.file_id,
                                    name: editResult.file_name,
                                    category: 'Docs',
                                    content: editResult.modified_content
                                };

                                // Update card with completed state
                                setEditedFilesMap(prev => ({
                                    ...prev,
                                    [newAiMsgIndex]: {
                                        file: editedFile,
                                        originalContent: editResult.original_content,
                                        editType: editResult.edit_type,
                                        editSummary: editResult.edit_summary,
                                        isLoading: false
                                    }
                                }));

                                // Open diff view
                                setAgentFile(editedFile);
                                setOriginalContent(editResult.original_content);
                                setEditSummary(editResult.edit_summary);
                                setIsDiffMode(true);
                                setEditorPanelOpen(true);
                                setShowSidebar(false);

                                toast.success(`Changes ready for review`, {
                                    description: editResult.edit_summary
                                });
                            }
                        } catch (error) {
                            console.error('Document edit failed:', error);
                            // Update card to show error
                            setEditedFilesMap(prev => ({
                                ...prev,
                                [newAiMsgIndex]: {
                                    ...prev[newAiMsgIndex],
                                    isLoading: false,
                                    loadingStep: 'Failed to edit document'
                                }
                            }));
                            toast.error('Failed to edit document');
                        }
                    }
                }
            }

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
        { icon: Zap, text: "What should I work on next?" },
        { icon: Wand2, text: "Create a technical specification document" }
    ];

    const sendQuickPrompt = (text) => {
        setInput(text);
        setTimeout(() => handleSend(), 100);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // AGENTIC EDITOR HANDLERS - Auto-save and seamless editing
    // ═══════════════════════════════════════════════════════════════════════════

    // NOTE: handleAgentFileContentChange is defined above before the conditional return

    // Open file in full editor
    const handleOpenInFullEditor = () => {
        if (agentFile?.id) {
            navigate(`/project/${projectId}/editor/${agentFile.id}`);
        }
    };

    // Close editor panel (normal mode)
    const handleCloseEditorPanel = () => {
        setEditorPanelOpen(false);
        setAgentFile(null);
        setIsDiffMode(false);
        setOriginalContent('');
        setEditSummary('');
    };

    // Accept changes from diff view - save to backend and switch to normal mode
    const handleAcceptChanges = async () => {
        if (!agentFile?.id || !agentFile?.content) return;

        // Store file reference before closing
        const fileToKeepOpen = { ...agentFile };

        try {
            await acceptChangesMutation.mutateAsync({
                fileId: agentFile.id,
                newContent: agentFile.content
            });

            // IMPORTANT: To avoid Monaco DiffEditor disposal errors,
            // we close the panel first, wait for unmount, then reopen in normal mode
            setEditorPanelOpen(false);
            setIsDiffMode(false);
            setOriginalContent('');

            // Reopen panel in normal mode after a brief delay (allows DiffEditor to fully unmount)
            setTimeout(() => {
                setAgentFile(fileToKeepOpen);
                setEditorPanelOpen(true);
            }, 100);
        } catch (error) {
            console.error('Failed to accept changes:', error);
        }
    };

    // Reject changes - close diff view without saving
    const handleRejectChanges = () => {
        toast.info('Changes discarded');
        handleCloseEditorPanel();
    };


    // Input Handler for @ Mentions
    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);

        const lastChar = val.slice(-1);
        if (lastChar === '@') {
            setShowMentionPicker(true);
            setMentionSearch('');
        } else if (showMentionPicker) {
            const match = val.match(/@([\w\s\.-]*)$/);
            if (match) {
                setMentionSearch(match[1]);
            } else {
                setShowMentionPicker(false);
            }
        }
    };

    const selectItem = (item) => {
        const name = item.type === 'file' ? item.name : item.title;
        const newVal = input.replace(/@[\w\s\.-]*$/, `@${name} `);
        setInput(newVal);
        setReferencedItems(prev => [...prev, item]);
        setShowMentionPicker(false);
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

            {/* Main Chat Area - Now a horizontal flex container */}
            <div className="flex-1 flex min-w-0 relative">

                {/* Chat Content Section - Shrinks when editor is open */}
                <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${editorPanelOpen ? 'mr-4' : ''}`}>
                    {/* Toggle Sidebar Button */}
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className="absolute top-4 left-4 z-10 p-2 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                        <ChevronLeft className={`h-4 w-4 transition-transform ${showSidebar ? '' : 'rotate-180'}`} />
                    </button>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto pb-40" ref={scrollRef}>
                        <div className={`mx-auto p-4 pt-14 space-y-6 transition-all duration-300 ${editorPanelOpen ? 'max-w-2xl' : 'max-w-4xl'}`}>
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
                                <MessageBubble
                                    key={i}
                                    message={msg}
                                    messageIndex={i}
                                    files={files}
                                    tasks={tasks}
                                    projectId={projectId}
                                    createdFile={createdFilesMap[i]}
                                    editedFile={editedFilesMap[i]}
                                    onOpenAgentFile={() => {
                                        const fileForMessage = createdFilesMap[i];
                                        if (fileForMessage) {
                                            setAgentFile(fileForMessage);
                                            setIsDiffMode(false);
                                            setEditorPanelOpen(true);
                                            setShowSidebar(false);
                                        }
                                    }}
                                    onOpenInFullEditor={() => {
                                        const fileForMessage = createdFilesMap[i];
                                        if (fileForMessage?.id) {
                                            navigate(`/project/${projectId}/editor/${fileForMessage.id}`);
                                        }
                                    }}
                                    onViewDiff={editedFilesMap[i]?.originalContent ? () => {
                                        const edited = editedFilesMap[i];
                                        if (edited) {
                                            setAgentFile(edited.file);
                                            setOriginalContent(edited.originalContent);
                                            setEditSummary(edited.editSummary);
                                            setIsDiffMode(true);
                                            setEditorPanelOpen(true);
                                            setShowSidebar(false);
                                        }
                                    } : undefined}
                                    onOpenEditedInFullEditor={() => {
                                        const edited = editedFilesMap[i];
                                        if (edited?.file?.id) {
                                            navigate(`/project/${projectId}/editor/${edited.file.id}`);
                                        }
                                    }}
                                />
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
                            {/* Reference Picker Popover */}
                            {showMentionPicker && (
                                <div className="absolute bottom-full mb-2 w-72 bg-background/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-64 flex flex-col">
                                    <div className="p-2 border-b border-white/5">
                                        <p className="text-xs text-muted-foreground px-2">Reference a file or task</p>
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        {/* Files */}
                                        {files.filter(f => f.name.toLowerCase().includes(mentionSearch.toLowerCase())).map(f => (
                                            <button
                                                key={`file-${f.id}`}
                                                className="w-full text-left px-4 py-2 hover:bg-primary/10 text-sm flex items-center gap-3 transition-colors"
                                                onClick={() => selectItem({ type: 'file', ...f })}
                                            >
                                                <FileIcon className="h-4 w-4 text-blue-400" />
                                                <span className="truncate">{f.name}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto">File</span>
                                            </button>
                                        ))}

                                        {/* Tasks */}
                                        {tasks.filter(t => t.title.toLowerCase().includes(mentionSearch.toLowerCase())).map(t => (
                                            <button
                                                key={`task-${t.id}`}
                                                className="w-full text-left px-4 py-2 hover:bg-primary/10 text-sm flex items-center gap-3 transition-colors"
                                                onClick={() => selectItem({ type: 'task', ...t })}
                                            >
                                                <SquareCheck className="h-4 w-4 text-green-400" />
                                                <span className="truncate">{t.title}</span>
                                                <span className="text-[10px] text-muted-foreground ml-auto">Task</span>
                                            </button>
                                        ))}

                                        {files.length === 0 && tasks.length === 0 && (
                                            <div className="p-4 text-xs text-muted-foreground text-center">No items found</div>
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

                                {/* Referenced Items */}
                                {referencedItems.length > 0 && (
                                    <div className="flex items-center gap-2 overflow-x-auto max-w-[200px] no-scrollbar">
                                        {referencedItems.map((item, idx) => (
                                            <span key={`${item.type}-${item.id}-${idx}`} className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 ${item.type === 'task' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {item.type === 'task' ? <SquareCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                                <span className="truncate max-w-[80px]">{item.name || item.title}</span>
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
                                    placeholder="Ask anything... (@ to reference files/tasks)"
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

            {/* AI Agent Editor Panel - Inline rounded container */}
            {editorPanelOpen && agentFile && (
                <div className="w-[450px] flex-shrink-0 p-4 pl-0">
                    <AgentEditorPanel
                        file={agentFile}
                        originalContent={originalContent}
                        isDiffMode={isDiffMode}
                        editSummary={editSummary}
                        onContentChange={handleAgentFileContentChange}
                        onAcceptChanges={handleAcceptChanges}
                        onRejectChanges={handleRejectChanges}
                        onOpenInEditor={handleOpenInFullEditor}
                        onClose={handleCloseEditorPanel}
                        isSaving={isSavingFile}
                    />
                </div>
            )}
        </div>

    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function MessageBubble({ message, messageIndex, files = [], tasks = [], projectId, createdFile, editedFile, onOpenAgentFile, onOpenInFullEditor, onViewDiff, onOpenEditedInFullEditor }) {
    const navigate = useNavigate();
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

    const handleReferenceClick = (type, name) => {
        if (type === 'File') {
            const file = files.find(f => f.name === name);
            if (file) {
                navigate(`/project/${projectId}/editor/${file.id}`);
            } else {
                toast.error(`File "${name}" not found in this project`);
            }
        } else if (type === 'Task') {
            const task = tasks.find(t => t.title === name);
            if (task) {
                navigate(`/project/${projectId}/tasks`);
                toast.success(`Navigating to task: ${name}`);
            } else {
                toast.error(`Task "${name}" not found`);
            }
        }
    };

    // Get references from message (new JSON-based approach)
    const references = message.references || [];

    // Process content to make referenced items clickable inline
    const processContentWithReferences = (content) => {
        if (!content || references.length === 0) return content;

        let processed = content;
        // Sort references by name length (longest first) to avoid partial replacements
        const sortedRefs = [...references].sort((a, b) => b.name.length - a.name.length);

        sortedRefs.forEach(ref => {
            // Escape special regex characters in the name
            const escapedName = ref.name.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&');
            // Use lookahead/lookbehind to match the name without requiring word boundaries
            // This handles file names like "Project-Overview.md" correctly
            const regex = new RegExp(`(?<![\\w-])${escapedName}(?![\\w-])`, 'g');
            processed = processed.replace(regex, `[${ref.name}](forgeref://${ref.type}/${ref.name})`);
        });
        return processed;
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
                    urlTransform={(url) => {
                        // Preserve our custom forgeref:// protocol
                        if (url.startsWith('forgeref://')) return url;
                        return url;
                    }}
                    components={{
                        // Use pre wrapper for code blocks to avoid p > div nesting
                        pre: ({ children }) => <>{children}</>,
                        code: ({ node, inline, className, children, ...props }) => {
                            const codeText = String(children).replace(/\n$/, '');
                            if (!inline) {
                                return (
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
                                );
                            }
                            return <code className="bg-black/30 rounded px-1.5 py-0.5 font-mono text-xs" {...props}>{children}</code>;
                        },
                        p: ({ children }) => <div className="mb-3 last:mb-0">{children}</div>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-2">{children}</h3>,
                        a: ({ href, children }) => {
                            // Handle our special reference links (forgeref://Type/Name)
                            if (href?.startsWith('forgeref://')) {
                                const parts = href.replace('forgeref://', '').split('/');
                                const type = parts[0];
                                const name = parts.slice(1).join('/');
                                const isTask = type === 'Task';
                                return (
                                    <button
                                        onClick={() => handleReferenceClick(type, name)}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200 mx-1 my-0.5 shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                                            ${isTask
                                                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/40 ring-1 ring-green-500/10'
                                                : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/40 ring-1 ring-blue-500/10'}`
                                        }
                                    >
                                        {isTask ? <SquareCheck className="h-3.5 w-3.5" /> : <FileIcon className="h-3.5 w-3.5" />}
                                        <span>{children}</span>
                                    </button>
                                );
                            }
                            return <a href={href} className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">{children}</a>;
                        },
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground mb-3">{children}</blockquote>,
                    }}
                >
                    {isUser ? message.content : processContentWithReferences(message.content)}
                </ReactMarkdown>

                {/* Document/Task Cards for AI messages with created files */}
                {!isUser && createdFile && (
                    <CreatedDocumentCard
                        file={createdFile}
                        onOpen={onOpenAgentFile}
                        onOpenInEditor={onOpenInFullEditor}
                    />
                )}

                {/* Edited Document Card - for AI messages that edited existing files */}
                {!isUser && editedFile && (
                    <EditedDocumentCard
                        file={editedFile.file}
                        editType={editedFile.editType}
                        editSummary={editedFile.editSummary}
                        isLoading={editedFile.isLoading}
                        loadingStep={editedFile.loadingStep}
                        onViewDiff={onViewDiff}
                        onOpenInEditor={onOpenEditedInFullEditor}
                    />
                )}
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
