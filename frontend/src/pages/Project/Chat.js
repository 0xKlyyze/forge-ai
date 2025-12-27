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
    Copy, Check, Clock, ArrowRight, Lightbulb, Pin, Wand2, Upload, X
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
    useCreateFile
} from '../../hooks/useProjectQueries';
import { SquareCheck, FileText as FileIcon } from 'lucide-react';
import { ChatSkeleton } from '../../components/skeletons/PageSkeletons';
import { AgentEditorPanel, CreatedDocumentCard, CreatedTasksCard, EditedDocumentCard } from '../../components/chat/AgentEditorPanel';



import { cn } from '../../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// RICH INPUT COMPONENT - contentEditable for atomic chips
// ═══════════════════════════════════════════════════════════════════════════════

const RichInput = React.forwardRef(({ value, onChange, onKeyDown, onPaste, onChipDelete, placeholder, className, disabled }, ref) => {
    const internalRef = useRef(null);

    // Expose ref and methods
    React.useImperativeHandle(ref, () => {
        // Return the DOM node with added methods to avoid breaking existing ref usage
        const node = internalRef.current;
        if (node) {
            node.focusEnd = () => {
                node.focus();
                if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            };
        }
        return node;
    });

    // Convert plain text with tags @[File: ...] or @[Task: ...] to HTML with chips
    const textToHtml = (text) => {
        if (!text) return '';
        // Escape HTML to prevent injection
        let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Replace File tags with purple chips
        // Pattern: @[File: name]
        html = html.replace(/@\[File: ([^\]]+)\]/g, (match, content) => {
            const displayText = content.replace('File: ', '');
            return `<span contenteditable="false" class="group/chip inline-flex items-center gap-1 bg-purple-500/10 text-purple-300 pl-2 pr-1 h-5 rounded-md text-xs font-medium border border-purple-500/20 align-middle mx-1 select-none hover:bg-purple-500/20 transition-all cursor-default shadow-sm shadow-purple-900/10" data-tag="${match}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text shrink-0 opacity-70"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span class="max-w-[180px] truncate leading-none pb-[1px]">${displayText}</span>
                        <span class="delete-chip flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/20 cursor-pointer text-white/40 hover:text-white transition-all opacity-0 group-hover/chip:opacity-100" role="button" title="Remove reference">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </span>
                    </span>`;
        });

        // Replace Task tags with green chips
        // Pattern: @[Task: name]
        html = html.replace(/@\[Task: ([^\]]+)\]/g, (match, content) => {
            return `<span contenteditable="false" class="group/chip inline-flex items-center gap-1 bg-green-500/10 text-green-300 pl-2 pr-1 h-5 rounded-md text-xs font-medium border border-green-500/20 align-middle mx-1 select-none hover:bg-green-500/20 transition-all cursor-default shadow-sm shadow-green-900/10" data-tag="${match}">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 opacity-70"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        <span class="max-w-[180px] truncate leading-none pb-[1px]">${content}</span>
                        <span class="delete-chip flex items-center justify-center w-4 h-4 rounded-full hover:bg-white/20 cursor-pointer text-white/40 hover:text-white transition-all opacity-0 group-hover/chip:opacity-100" role="button" title="Remove reference">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </span>
                    </span>`;
        });

        return html;
    };

    // Reflect external value changes to innerHTML
    // ONLY if the value is different from what we represent
    React.useEffect(() => {
        if (internalRef.current) {
            // We detect external changes by comparing prop value to our last known innerText state
            // OR simply by checking if the prop doesn't match current innerText

            // NOTE: innerText might differ slightly from value due to line breaks or hidden characters.
            // AND if we have chips, value (with tags) != innerText (display text).

            // If focused, we generally trust the DOM (user typing), to avoid cursor jumps.
            // EXCEPT if the value is being reset to empty (cleared).

            const isFocused = document.activeElement === internalRef.current;
            const currentInnerText = internalRef.current.innerText;

            // We can't easily compare value vs innerText if chips are involved because formats differ.
            // But we know if value is EMPTY, innerText should be empty.

            if (value === '' && currentInnerText.trim() !== '') {
                internalRef.current.innerHTML = '';
            }
            else if (!isFocused && value !== currentInnerText) {
                // External update while not focused (e.g. Add to Chat, or initial load)
                // Or just a standard sync when blur
                // Note: comparing value (tags) vs innerText (no tags) means this runs often.
                // But textToHtml is fast.
                internalRef.current.innerHTML = textToHtml(value);
            }
            else if (isFocused && value !== currentInnerText) {
                // If focused, we usually don't touch it.
                // UNLESS 'Add to Chat' happened while focused? 
                // That refers to inserting a chip.
                // If we insert a chip, value has `@[File...]`. innerText hasn't yet (if we haven't rendered).
                // But usually 'Add to Chat' happens via button click -> focus lost -> update -> focus returned?
                // Let's rely on standard flow.
            }
        }
    }, [value]);

    // Handle external injections (like the "Add to Chat" button)
    // We can use a useLayoutEffect to force update and restore cursor to end if needed
    // But since "Add to Chat" usually happens when focus is elsewhere (in editor), 
    // simply checking doc.activeElement above might be enough!
    // When we click "Add to Chat", focus is on that button. Then we optionally focus input.

    // Force update on mount or when value changes while NOT editing
    React.useLayoutEffect(() => {
        if (internalRef.current && (document.activeElement !== internalRef.current)) {
            internalRef.current.innerHTML = textToHtml(value);
        }
    }, [value]);



    const reconstructValue = (container) => {
        let newValue = '';
        const walk = (node) => {
            if (node.nodeType === 3) { // Text
                newValue += node.textContent;
            } else if (node.nodeType === 1) { // Element
                if (node.hasAttribute('data-tag')) {
                    newValue += node.getAttribute('data-tag');
                } else if (node.tagName === 'BR') {
                    newValue += '\n';
                } else if (node.tagName === 'DIV' && newValue.length > 0) {
                    // Chrome adds divs for newlines sometimes
                    newValue += '\n';
                    node.childNodes.forEach(walk);
                } else {
                    node.childNodes.forEach(walk);
                }
            }
        };
        container.childNodes.forEach(walk);
        return newValue.replace(/\n\n/g, '\n');
    };

    const handleInput = (e) => {
        const newValue = reconstructValue(e.target);
        onChange({ target: { value: newValue } });
    };

    // Click handler to detect delete button clicks
    const handleClick = (e) => {
        // Check if we clicked the delete button
        const deleteBtn = e.target.closest('.delete-chip');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();

            // Find the chip element
            const chip = deleteBtn.closest('[data-tag]');
            if (chip) {
                // Get the tag content before removing (for callback)
                const tagContent = chip.getAttribute('data-tag');

                // Remove the chip from DOM
                chip.remove();

                // Reconstruct value and trigger change
                if (internalRef.current) {
                    const newValue = reconstructValue(internalRef.current);
                    onChange({ target: { value: newValue } });
                }

                // Notify parent about chip deletion (for syncing referencedItems)
                if (onChipDelete && tagContent) {
                    onChipDelete(tagContent);
                }
            }
        }
    };

    return (
        <div
            ref={internalRef}
            contentEditable
            onInput={handleInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onClick={handleClick}
            className={cn(
                "min-h-[56px] w-full rounded-md border border-input bg-transparent px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 whitespace-pre-wrap break-words outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground",
                className
            )}
            style={{
                minHeight: '56px',
                maxHeight: '200px',
                overflowY: 'auto'
            }}
            data-placeholder={placeholder}
        />
    );
});
RichInput.displayName = "RichInput";


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
    const createFileMutation = useCreateFile(projectId);

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
    const [attachedSelections, setAttachedSelections] = useState([]); // Array of { id, file, text, range }
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
    const [isDiffAccepted, setIsDiffAccepted] = useState(false); // Track if viewing an already-accepted diff


    // Track initialization and mount status
    const hasInitialized = useRef(false);
    const isMounted = useRef(true);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null); // Hidden file input for uploads

    // File upload state
    const [uploadedFiles, setUploadedFiles] = useState([]); // Array of { id, name, content, type }
    const [isDragging, setIsDragging] = useState(false);

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
                // Determine if we have a persisted tool result for this message
                // We look at the NEXT message to see if it's a tool output
                const nextMsg = messages[index + 1];
                const toolResult = (nextMsg && nextMsg.role === 'tool') ? nextMsg.content : null; // Content should be the JSON result

                msg.tool_calls.forEach(tool => {
                    // Rehydrate Created Documents
                    if (tool.tool_name === 'create_document') {
                        if (!createdFilesMap[index]) {
                            // Try to get content from tool result if available (more reliable), otherwise input args
                            const content = toolResult?.result?.content || tool.arguments.content;

                            newCreatedMap[index] = {
                                id: toolResult?.result?.file_id || 'history',
                                name: tool.arguments.name,
                                category: tool.arguments.category || 'Docs',
                                content: content
                            };
                            hasNewData = true;
                        }
                    }

                    // Rehydrate Edited Documents
                    const editTools = ['rewrite_document', 'insert_in_document', 'replace_in_document'];
                    if (editTools.includes(tool.tool_name)) {
                        if (!editedFilesMap[index]) {
                            let type = 'edit';
                            if (tool.tool_name === 'rewrite_document') type = 'rewrite';
                            if (tool.tool_name === 'insert_in_document') type = 'insert';
                            if (tool.tool_name === 'replace_in_document') type = 'replace';

                            // If we have a tool result, we can fully rehydrate!
                            if (toolResult && toolResult.success && toolResult.result) {
                                const resultData = toolResult.result;
                                newEditedMap[index] = {
                                    file: {
                                        name: resultData.file_name,
                                        id: resultData.file_id
                                    },
                                    originalContent: resultData.original_content,
                                    modifiedContent: resultData.modified_content, // Store for isAccepted check
                                    editType: resultData.edit_type || type,
                                    editSummary: resultData.edit_summary || 'Edited',
                                    isLoading: false,
                                    diffData: resultData, // Store full data for compatibility
                                    isPersisted: true
                                };
                            } else {
                                // Fallback for legacy/incomplete history (loading state or just generic)
                                newEditedMap[index] = {
                                    file: {
                                        name: tool.arguments.file_name,
                                        id: tool.arguments.file_id
                                    },
                                    editType: type,
                                    editSummary: 'Edited (from history)',
                                    isLoading: false,
                                    originalContent: null
                                };
                            }
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

    // Move skeleton return to AFTER hooks? NO, we cannot render hooks conditionally.
    // The hooks ARE rendered above.
    // But if we return here, any hook BELOW here will not be called.
    // VERIFY: Are there hooks below?
    // - getModelIcon, getModelColor... no.
    // - loadSession... no.
    // - createNewSession... no.
    // - confirmDeleteSession... no.
    // - togglePin... no.
    // - handleSend... no.
    // - sendQuickPrompt... no.
    // - handleOpenInFullEditor... no.
    // - handleCloseEditorPanel... no.
    // - handleAcceptChanges... no.
    // - handleRejectChanges... no.
    // - handleInputChange... no.

    // WAIT! MessageBubble component?
    // If it's a sub-component defined INSIDE ProjectChat?
    // No, it's typically imported or defined outside. 
    // BUT I cannot see it in the file view. 
    // If it's defined INSIDE ProjectChat, it re-renders on every render of ProjectChat. 
    // And if it uses hooks... and we return early... 
    // NO, defining component inside component is bad practice but doesn't cause "Rendered more hooks" for the OUTER component.
    // Unless we use it as {MessageBubble()} (function call) instead of <MessageBubble />.

    // Let's assume the safest fix: DO NOT RETURN EARLY.
    // Instead conditional render the MAIN CONTENT.

    // if (showInitialSkeleton) {
    //    return <ChatSkeleton />;
    // }

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

        // Resolve inline references in the input
        let finalContent = input;
        let hasContent = input.trim().length > 0;
        const usedSelections = [];

        // Find all reference tags in the input: @[File: name:L1-10]
        if (attachedSelections.length > 0) {
            attachedSelections.forEach(sel => {
                const tag = `@[File: ${sel.file.name}${sel.range ? `:${sel.range.startLineNumber}-${sel.range.endLineNumber}` : ''}]`;
                if (finalContent.includes(tag)) {
                    // Append the actual code content at the end of the message
                    // We keep the tag in the text as a reference point, but add the code block at the end
                    usedSelections.push(`> [Referenced ${sel.file.name}${sel.range ? `:${sel.range.startLineNumber}-${sel.range.endLineNumber}` : ''}]\n> ${sel.text}`);
                    hasContent = true;
                }
            });
        }

        if (!hasContent || loading || !currentSessionId) return;

        // Append resolved selections to the message content
        if (usedSelections.length > 0) {
            finalContent += `\n\n${usedSelections.join('\n\n')}`;
        }

        // Split uploaded files into images vs text files BEFORE clearing state
        const filesToUpload = [...uploadedFiles];

        // Separate images from text files
        const imageFiles = filesToUpload.filter(f => f.type === 'image');
        const textFiles = filesToUpload.filter(f => f.type !== 'image');

        // Store images with user message for display (keep dataUrl for preview)
        const imageAttachments = imageFiles.map(img => ({
            name: img.name,
            type: 'image',
            mimeType: img.mimeType,
            dataUrl: img.dataUrl // Keep the full dataUrl for display
        }));

        // Store text file references for display (just name and type)
        const fileAttachments = textFiles.map(f => ({
            name: f.name,
            type: f.type, // 'code' or 'doc'
            size: f.size
        }));

        // Combine all attachments
        const messageAttachments = [...imageAttachments, ...fileAttachments];

        const userMsg = {
            role: 'user',
            content: finalContent,
            timestamp: new Date().toISOString(),
            attachments: messageAttachments.length > 0 ? messageAttachments : undefined
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setAttachedSelections([]);
        setUploadedFiles([]);
        setLoading(true);

        // Collect referenced files from @ mentions
        const referencedFiles = referencedItems.filter(i => i.type === 'file').map(i => i.id);
        const referencedTasks = referencedItems.filter(i => i.type === 'task').map(i => i.id);
        setReferencedItems([]);

        // Prepare images for API (extract base64 data from dataUrl)
        const attachedImages = imageFiles.map(img => ({
            name: img.name,
            mimeType: img.mimeType,
            data: img.dataUrl.split(',')[1] // Remove "data:image/png;base64," prefix
        }));

        // Save text files to project and add to references
        for (const file of textFiles) {
            try {
                const result = await createFileMutation.mutateAsync({
                    name: file.name,
                    type: file.type,
                    category: file.type === 'code' ? 'Code' : 'Docs',
                    content: file.content,
                    tags: ['ai-chat'] // Mark as chat-uploaded file
                });
                if (result?.id) {
                    referencedFiles.push(result.id);
                }
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
                toast.error(`Failed to upload ${file.name}`);
            }
        }

        try {
            const res = await sendMessageMutation.mutateAsync({
                sessionId: currentSessionId,
                message: userMsg.content,
                contextMode: isFullContext ? 'all' : 'selective',
                referencedFiles,
                referencedTasks,
                attachedImages, // NEW: Pass images directly to AI
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

                                // ══════════════════════════════════════════════════════════
                                // PERSISTENCE: Save the tool result to chat history
                                // ══════════════════════════════════════════════════════════
                                try {
                                    // Manually append a tool message
                                    const toolMessage = {
                                        role: 'tool',
                                        content: {
                                            success: true,
                                            tool_name: toolCall.tool_name,
                                            result: {
                                                file_id: editResult.file_id,
                                                file_name: editResult.file_name,
                                                original_content: editResult.original_content,
                                                modified_content: editResult.modified_content,
                                                edit_type: editResult.edit_type,
                                                edit_summary: editResult.edit_summary
                                            }
                                        },
                                        timestamp: new Date().toISOString()
                                    };

                                    // Add to local state (optional, but good for consistency immediately)
                                    setMessages(prev => [...prev, toolMessage]);

                                    // Persist to backend using the raw message endpoint
                                    await api.post(`/chat-sessions/${currentSessionId}/messages/raw`, toolMessage);

                                } catch (persistError) {
                                    console.error("Failed to persist tool output:", persistError);
                                }
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
            console.error('Failed to send message:', error);
            toast.error('Failed to send message');
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
        setIsDiffAccepted(false);
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

    // ═══════════════════════════════════════════════════════════════════════════════
    // FILE UPLOAD & DRAG-DROP HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════════

    // Helper: Detect file type from extension
    const getFileType = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'rb', 'php', 'swift', 'kt'];
        const docExts = ['md', 'txt', 'json', 'yaml', 'yml', 'xml', 'html', 'css', 'scss', 'less'];
        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        if (imageExts.includes(ext)) return 'image';
        if (codeExts.includes(ext)) return 'code';
        if (docExts.includes(ext)) return 'doc';
        return 'doc';
    };

    // Helper: Check if file is an image
    const isImageFile = (file) => {
        return file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name);
    };

    // Process dropped/selected files (text + images)
    const processFiles = async (fileList) => {
        const newFiles = [];
        for (const file of fileList) {
            // Handle image files
            if (isImageFile(file)) {
                if (file.size > 20 * 1024 * 1024) {
                    toast.error(`${file.name} is too large (max 20MB for images)`);
                    continue;
                }

                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                newFiles.push({
                    id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    type: 'image',
                    mimeType: file.type || 'image/png',
                    dataUrl, // base64 data URL for preview and sending
                    size: file.size
                });
                continue;
            }

            // Handle text files
            if (!file.type.startsWith('text/') && !file.name.match(/\.(md|txt|json|js|jsx|ts|tsx|py|java|c|cpp|go|rs|yaml|yml|xml|html|css|scss)$/i)) {
                toast.error(`Skipped ${file.name}: Unsupported file type`);
                continue;
            }

            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file);
            });

            newFiles.push({
                id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: file.name,
                content,
                type: getFileType(file.name),
                size: file.size
            });
        }

        if (newFiles.length > 0) {
            setUploadedFiles(prev => [...prev, ...newFiles]);
            toast.success(`${newFiles.length} file${newFiles.length > 1 ? 's' : ''} ready to send`);
        }
    };

    // Handle paste event for clipboard images
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        // Check for images first
        const imageItems = [];
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    imageItems.push(file);
                }
            }
        }

        // If we found images, prevent default IMMEDIATELY and process them
        if (imageItems.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            processFiles(imageItems); // Fire and forget - no await needed
        }
    };

    // Drag-drop handlers
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) processFiles(files);
    };

    // File input change handler
    const handleFileInputChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) processFiles(files);
        e.target.value = '';
    };

    // Remove uploaded file
    const removeUploadedFile = (fileId) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    };

    const selectItem = (item) => {
        const name = item.type === 'file' ? item.name : item.title;
        const tagType = item.type === 'file' ? 'File' : 'Task';
        const tag = `@[${tagType}: ${name}]`;
        const newVal = input.replace(/@[\w\s\.-]*$/, tag + ' ');
        setInput(newVal);
        setReferencedItems(prev => [...prev, item]);
        setShowMentionPicker(false);
        setTimeout(() => {
            inputRef.current?.focusEnd?.();
        }, 0);
    };

    // Handle adding selected text from editor to chat
    const handleAddToChat = useCallback(({ file, text, range }) => {
        console.log('[Chat] handleAddToChat called', { file, text });
        if (!text) return;

        // Create the tag to insert
        const locationRef = range ? `:${range.startLineNumber}-${range.endLineNumber}` : '';
        // Add spaces around for safety, but check if we are at start
        const tag = ` @[File: ${file.name}${locationRef}] `;

        // For contentEditable, selectionStart is unreliable.
        // We simply append to the end for consistent behavior.
        const newInput = input + tag;

        setInput(newInput);

        // Store data for resolution on send
        setAttachedSelections(prev => [
            ...prev,
            { id: Date.now(), file, text, range }
        ]);

        // Focus and set cursor to end
        setTimeout(() => {
            if (inputRef.current && inputRef.current.focusEnd) {
                inputRef.current.focusEnd();
            } else if (inputRef.current) {
                inputRef.current.focus();
            }
        }, 10); // Slight delay to ensure render
    }, [input]);

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
                <div
                    className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${editorPanelOpen ? 'mr-4' : ''} relative`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    {/* Drag Overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 transition-all animate-in fade-in-0 duration-200">
                            <div className="flex flex-col items-center gap-4 p-8 text-center">
                                <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 animate-bounce">
                                    <Upload className="h-8 w-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-primary">Drop files here</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Supported: .md, .txt, .js, .py, .json, etc.</p>
                                </div>
                            </div>
                        </div>
                    )}
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
                            {messages.map((msg, i) => {
                                // Skip persisted tool outputs (they are for rehydration only)
                                if (msg.role === 'tool') return null;

                                // Logic for EditedDocumentCard state
                                let editedFileWithStatus = editedFilesMap[i];

                                if (editedFileWithStatus) {
                                    let isStale = false;
                                    let isAccepted = false;
                                    const chatFile = editedFileWithStatus;

                                    // Check against current file context if available
                                    const currentFile = files.find(f => f.id === chatFile.file.id);
                                    // Get modified content from diffData or direct property (for rehydrated cards)
                                    const modifiedContent = chatFile.diffData?.modified_content || chatFile.modifiedContent;
                                    const originalContentForCheck = chatFile.diffData?.original_content || chatFile.originalContent;

                                    if (currentFile && modifiedContent) {
                                        // Clean strings for comparison (normalize newlines)
                                        const normalize = (str) => (str || '').replace(/\r\n/g, '\n').trim();
                                        const current = normalize(currentFile.content);
                                        const modified = normalize(modifiedContent);
                                        const original = normalize(originalContentForCheck);

                                        // Accepted if current matches modified
                                        if (current === modified) {
                                            isAccepted = true;
                                        }
                                        // Stale if current matches neither original nor modified
                                        // (i.e., user edited it manually after AI proposed changes)
                                        else if (current !== original) {
                                            isStale = true;
                                        }
                                    }

                                    // Enhance the object with status
                                    editedFileWithStatus = {
                                        ...chatFile,
                                        isStale,
                                        isAccepted
                                    };
                                }

                                return (
                                    <MessageBubble
                                        key={i}
                                        message={msg}
                                        messageIndex={i}
                                        files={files}
                                        tasks={tasks}
                                        projectId={projectId}
                                        createdFile={createdFilesMap[i]}
                                        editedFile={editedFileWithStatus}
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
                                            // Use latest file version
                                            const fileForMessage = createdFilesMap[i];
                                            if (fileForMessage?.id) {
                                                const latest = files.find(f => f.id === fileForMessage.id) || fileForMessage;
                                                navigate(`/project/${projectId}/editor/${latest.id}`);
                                            }
                                        }}
                                        onViewDiff={editedFileWithStatus?.originalContent ? () => {
                                            const edited = editedFileWithStatus;
                                            if (edited) {
                                                // Get latest file content from context for accurate diff view
                                                const latestFile = files.find(f => f.id === edited.file.id);
                                                const fileToShow = latestFile ? {
                                                    ...edited.file,
                                                    content: latestFile.content // Use latest content
                                                } : {
                                                    ...edited.file,
                                                    content: edited.modifiedContent || edited.diffData?.modified_content
                                                };

                                                setAgentFile(fileToShow);
                                                setOriginalContent(edited.originalContent);
                                                setEditSummary(edited.editSummary);
                                                setIsDiffAccepted(edited.isAccepted || false); // Track if already accepted
                                                setIsDiffMode(true);
                                                setEditorPanelOpen(true);
                                                setShowSidebar(false);
                                            }
                                        } : undefined}
                                        onOpenEditedInFullEditor={() => {
                                            const edited = editedFileWithStatus;
                                            if (edited?.file?.id) {
                                                const latestFile = files.find(f => f.id === edited.file.id) || edited.file;
                                                setAgentFile(latestFile);
                                                setIsDiffMode(false);
                                                setEditorPanelOpen(true);
                                                setShowSidebar(false);
                                            }
                                        }}
                                    />
                                )
                            })}

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
                                                onClick={() => selectItem({ ...f, type: 'file' })}
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
                                                onClick={() => selectItem({ ...t, type: 'task' })}
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

                                {/* Referenced Items (Mentions) ONLY - Attachment chips removal since they are inline now */}
                                {referencedItems.length > 0 && (
                                    <div className="flex items-center gap-2 overflow-x-auto max-w-xl no-scrollbar">
                                        {referencedItems.map((item, idx) => (
                                            <span key={`ref-${item.type}-${item.id}-${idx}`} className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 flex-shrink-0 ${item.type === 'task' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                }`}>
                                                {item.type === 'task' ? <SquareCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                                                <span className="truncate max-w-[80px]">{item.name || item.title}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Input Box - Contains file chips + input + buttons */}
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSend(e);
                                }}
                                className="relative bg-secondary/80 backdrop-blur-xl shadow-2xl rounded-b-2xl border-t-0 border-white/10"
                            >
                                {/* Uploaded Files Preview - Inside form for visual cohesion */}
                                {uploadedFiles.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2 border-b border-white/5">
                                        {uploadedFiles.map(file => (
                                            <div
                                                key={file.id}
                                                className="group flex items-center gap-1.5 px-2 py-1 bg-primary/15 hover:bg-primary/25 border border-primary/30 rounded-lg text-xs transition-all"
                                            >
                                                {/* Image thumbnail or file icon */}
                                                {file.type === 'image' ? (
                                                    <img
                                                        src={file.dataUrl}
                                                        alt={file.name}
                                                        className="h-6 w-6 rounded object-cover shrink-0"
                                                    />
                                                ) : (
                                                    <Upload className="h-3 w-3 text-primary shrink-0" />
                                                )}
                                                <span className="truncate max-w-[100px] text-primary font-medium">{file.name}</span>
                                                <span className="text-muted-foreground text-[10px]">
                                                    {file.size > 1024 * 1024
                                                        ? `${(file.size / (1024 * 1024)).toFixed(1)}MB`
                                                        : `${(file.size / 1024).toFixed(0)}KB`
                                                    }
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeUploadedFile(file.id)}
                                                    className="ml-0.5 p-0.5 rounded hover:bg-white/20 text-primary/60 hover:text-white transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Input Row */}
                                <div className="flex items-end min-h-[56px]">
                                    <div className="flex-1 relative min-h-[56px]">
                                        <RichInput
                                            ref={inputRef}
                                            value={input}
                                            onChange={handleInputChange}
                                            onPaste={handlePaste}
                                            onChipDelete={(tagContent) => {
                                                // Parse the tag to get the name, e.g. "@[File: filename.md]" -> "filename.md"
                                                const fileMatch = tagContent.match(/@\[File: ([^\]]+)\]/);
                                                const taskMatch = tagContent.match(/@\[Task: ([^\]]+)\]/);

                                                if (fileMatch) {
                                                    const fileName = fileMatch[1];
                                                    setReferencedItems(prev => prev.filter(item =>
                                                        !(item.type === 'file' && item.name === fileName)
                                                    ));
                                                } else if (taskMatch) {
                                                    const taskTitle = taskMatch[1];
                                                    setReferencedItems(prev => prev.filter(item =>
                                                        !(item.type === 'task' && item.title === taskTitle)
                                                    ));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSend(e);
                                                }
                                            }}
                                            placeholder="Ask anything... (@ to reference files/tasks)"
                                            className="w-full min-h-[56px] max-h-[200px] overflow-y-auto rounded-bl-2xl bg-transparent"
                                        />
                                    </div>
                                    <div className="h-[56px] flex items-center gap-1 pr-2">
                                        {/* Hidden File Input */}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            multiple
                                            accept=".md,.txt,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.go,.rs,.yaml,.yml,.xml,.html,.css,.scss,.png,.jpg,.jpeg,.gif,.webp,image/*"
                                            className="hidden"
                                            onChange={handleFileInputChange}
                                        />
                                        {/* Upload Button */}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="h-10 w-10 rounded-xl hover:bg-primary/10 transition-all shrink-0 text-muted-foreground hover:text-primary"
                                            title="Upload files"
                                        >
                                            <Paperclip className="h-5 w-5" />
                                        </Button>
                                        {/* Send Button */}
                                        <Button
                                            type="submit"
                                            size="icon"
                                            disabled={loading || (!input.trim() && attachedSelections.length === 0 && uploadedFiles.length === 0)}
                                            className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 transition-all shrink-0"
                                        >
                                            <Send className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
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
                        onAddToChat={handleAddToChat}
                        isAccepted={isDiffAccepted}
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
        if (!content) return content;

        let processed = content;

        // 1. Convert @[File: ...] tags to Chip Links
        // Pattern: @[File: name]
        processed = processed.replace(/@\[(File|Task): ([^\]]+)\]/g, (match, type, content) => {
            // encode content to be safe in URL
            const safeContent = encodeURIComponent(content);
            return `[${content}](chip://${type}/${safeContent})`;
        });

        // 2. Handle legacy references (if any)
        if (references.length > 0) {
            const sortedRefs = [...references].sort((a, b) => b.name.length - a.name.length);
            sortedRefs.forEach(ref => {
                const escapedName = ref.name.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(?<![\\w-])${escapedName}(?![\\w-])`, 'g');
                // Avoid replacing inside existing chip links
                // This is a naive check; ideally use a parser. 
                // But since we just replaced tags, we might be safe if we don't overlap.
                if (!processed.includes(`](chip://${ref.type}/`)) {
                    processed = processed.replace(regex, `[${ref.name}](forgeref://${ref.type}/${ref.name})`);
                }
            });
        }

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
                {/* Attachments Display - Images and Files */}
                {isUser && message.attachments && message.attachments.length > 0 && (
                    <div className="mb-3 space-y-2">
                        {/* Images Grid */}
                        {message.attachments.filter(a => a.type === 'image').length > 0 && (
                            <div className={`${message.attachments.filter(a => a.type === 'image').length === 1 ? '' : 'grid gap-1.5 grid-cols-2'}`}>
                                {message.attachments.filter(a => a.type === 'image').map((attachment, idx) => (
                                    <img
                                        key={`img-${idx}`}
                                        src={attachment.dataUrl}
                                        alt={attachment.name || 'Attached image'}
                                        className={`rounded-lg object-cover w-full ${message.attachments.filter(a => a.type === 'image').length === 1 ? 'max-h-64' : 'h-32'} border border-white/20`}
                                    />
                                ))}
                            </div>
                        )}
                        {/* File Chips */}
                        {message.attachments.filter(a => a.type !== 'image').length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {message.attachments.filter(a => a.type !== 'image').map((attachment, idx) => (
                                    <div
                                        key={`file-${idx}`}
                                        className="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-lg text-xs border border-white/30"
                                    >
                                        <FileText className="h-3 w-3 opacity-80" />
                                        <span className="truncate max-w-[120px] font-medium">{attachment.name}</span>
                                        {attachment.size && (
                                            <span className="opacity-60 text-[10px]">
                                                {attachment.size > 1024 * 1024
                                                    ? `${(attachment.size / (1024 * 1024)).toFixed(1)}MB`
                                                    : `${(attachment.size / 1024).toFixed(0)}KB`
                                                }
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <ReactMarkdown
                    urlTransform={(url) => {
                        if (url.startsWith('forgeref://') || url.startsWith('chip://')) return url;
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
                            if (href?.startsWith('chip://')) {
                                const [_, type, content] = href.match(/chip:\/\/([^\/]+)\/(.+)/) || [];
                                const decodedContent = content ? decodeURIComponent(content) : children;
                                const isFile = type === 'File';

                                return (
                                    <span className={`
                                        inline-flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-md text-xs font-medium border border-white/10 align-middle mx-1 align-baseline transform translate-y-[1px]
                                        ${isUser ? 'text-white border-white/20 bg-white/20' : 'text-purple-300 border-purple-500/20 bg-purple-500/10'}
                                    `}>
                                        <FileIcon className="h-3 w-3 opacity-70" />
                                        <span className="max-w-[150px] truncate leading-none pb-[1px]">{decodedContent}</span>
                                    </span>
                                );
                            }
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
                        blockquote: ({ children }) => {
                            // Attempt to check if this is a file reference block
                            // We need to extract the text content to check the pattern
                            let textContent = '';
                            React.Children.forEach(children, child => {
                                if (typeof child === 'string') textContent += child;
                                else if (child?.props?.children) {
                                    if (typeof child.props.children === 'string') textContent += child.props.children;
                                    else if (Array.isArray(child.props.children)) {
                                        child.props.children.forEach(c => {
                                            if (typeof c === 'string') textContent += c;
                                        });
                                    }
                                }
                            });

                            // Check for [Referenced File:Range] pattern
                            const match = textContent.match(/\[Referenced ([^\]]+)\]\s*([\s\S]*)/);

                            if (match) {
                                const [_, meta, content] = match;
                                return (
                                    <div className="my-2 rounded-md border border-white/10 overflow-hidden bg-black/20">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border-b border-white/5 text-xs text-muted-foreground select-none">
                                            <FileIcon className="h-3 w-3" />
                                            <span className="font-medium truncate">{meta}</span>
                                        </div>
                                        <div className="p-3 text-xs font-mono text-white/70 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                            {content}
                                        </div>
                                    </div>
                                );
                            }

                            return <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground mb-3">{children}</blockquote>;
                        },
                    }}
                >
                    {processContentWithReferences(message.content)}
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
                        isAccepted={editedFile.isAccepted}
                        isStale={editedFile.isStale}
                        isPersisted={editedFile.isPersisted}
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
