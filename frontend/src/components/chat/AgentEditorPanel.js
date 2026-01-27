import React, { useRef, useEffect, useCallback, Component } from 'react';
import { X, FileText, Check, Loader2, ExternalLink, Sparkles, Maximize2, FileEdit, GitCompare, Palette, Eye, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import FileEditor from '../Editor';
import { DiffEditor } from '@monaco-editor/react';
import { cn } from '../../lib/utils';

/**
 * Error boundary to catch Monaco DiffEditor disposal errors.
 * These errors are expected when switching from diff mode but don't affect functionality.
 */
class DiffEditorErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        // Check if this is the specific Monaco disposal error
        if (error?.message?.includes('TextModel got disposed') ||
            error?.message?.includes('DiffEditorWidget')) {
            // Suppress this expected error - return null to not update state
            console.debug('Suppressed Monaco DiffEditor cleanup error');
            return { hasError: false };
        }
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Only log non-Monaco errors
        if (!error?.message?.includes('TextModel got disposed') &&
            !error?.message?.includes('DiffEditorWidget')) {
            console.error('DiffEditor error:', error, errorInfo);
        }
    }

    render() {
        if (this.state.hasError) {
            return <div className="p-4 text-muted-foreground">Failed to load diff view</div>;
        }
        return this.props.children;
    }
}

/**
 * AgentEditorPanel - Inline editor panel for AI-created/edited documents
 * Supports both normal editing and diff view modes
 */
export function AgentEditorPanel({
    file = null, // { id, name, category, content }
    originalContent = null, // For diff view - the original content before edits
    isDiffMode = false, // true = show diff view, false = normal editor
    editSummary = '', // Summary of what was changed (for diff mode)
    onContentChange, // (fileId, content)
    onAcceptChanges, // Accept diff changes
    onRejectChanges, // Reject and close diff
    onOpenInEditor, // Function to open full editor
    onClose,
    isSaving = false,
    onAddToChat = null, // Function to add selected text to chat
    isAccepted = false, // Indicates changes were already applied
    onOpenLatest = null // Switch to latest version
}) {
    // Ref to track the DiffEditor instance for proper cleanup
    const diffEditorRef = useRef(null);

    // Global error handler to suppress Monaco DiffEditor disposal errors
    // These errors are expected when switching from diff mode but don't affect functionality
    useEffect(() => {
        const handleError = (event) => {
            if (event.message?.includes('TextModel got disposed') ||
                event.message?.includes('DiffEditorWidget')) {
                // Prevent the error from showing in the console and error overlay
                event.preventDefault();
                event.stopPropagation();
                console.debug('Suppressed Monaco DiffEditor cleanup error');
                return true;
            }
        };

        const handleUnhandledRejection = (event) => {
            if (event.reason?.message?.includes('TextModel got disposed') ||
                event.reason?.message?.includes('DiffEditorWidget')) {
                event.preventDefault();
                console.debug('Suppressed Monaco DiffEditor promise rejection');
                return true;
            }
        };

        window.addEventListener('error', handleError, true);
        window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

        return () => {
            window.removeEventListener('error', handleError, true);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
        };
    }, []);

    // Cleanup DiffEditor on unmount or mode change
    // Cleanup DiffEditor on unmount or mode change
    // NOTE: Manual disposal removed as it conflicts with @monaco-editor/react internal cleanup
    // and causes "TextModel got disposed" errors.
    useEffect(() => {
        return () => {
            // Safer cleanup: Detach models first to prevent "TextModel got disposed" error
            if (diffEditorRef.current) {
                try {
                    const editor = diffEditorRef.current;
                    // storing models before setting them to null on the editor
                    const originalModel = editor.getOriginalEditor?.()?.getModel?.();
                    const modifiedModel = editor.getModifiedEditor?.()?.getModel?.();

                    // 1. Detach models from editor so it doesn't try to access them while disposing
                    editor.setModel?.(null);

                    // 2. Dispose the editor widget
                    editor.dispose?.();

                    // 3. Now safely dispose the models
                    // We wrap this in try-catch because sometimes React/Monaco might have already cleaned them up
                    try {
                        if (originalModel && !originalModel.isDisposed()) originalModel.dispose();
                        if (modifiedModel && !modifiedModel.isDisposed()) modifiedModel.dispose();
                    } catch (modelError) {
                        // Ignore model disposal errors
                    }

                } catch (e) {
                    // Silently handle main disposal errors
                    console.debug('DiffEditor cleanup:', e.message);
                }
                diffEditorRef.current = null;
            }
        };
    }, [isDiffMode]); // Re-run when mode changes to ensure cleanup
    const handleDiffEditorMount = useCallback((editor) => {
        diffEditorRef.current = editor;
    }, []);

    // Category badge color
    const getCategoryColor = () => {
        switch (file?.category?.toLowerCase()) {
            case 'docs': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'code': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'notes': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    // Get language for Monaco based on file extension
    const getLanguage = () => {
        if (!file?.name) return 'markdown';
        const ext = file.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js': case 'jsx': return 'javascript';
            case 'ts': case 'tsx': return 'typescript';
            case 'py': return 'python';
            case 'md': return 'markdown';
            case 'json': return 'json';
            case 'css': return 'css';
            case 'html': return 'html';
            default: return 'markdown';
        }
    };

    if (!file) return null;

    // Handle content change - pass to parent for auto-save (only in normal mode)
    const handleChange = (newContent) => {
        if (onContentChange && !isDiffMode) {
            onContentChange(file.id, newContent);
        }
    };


    return (
        <div className="h-full flex flex-col bg-[#1e1e1e] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isDiffMode
                        ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/20 border-yellow-500/30'
                        : 'bg-gradient-to-br from-primary/30 to-accent/20 border-primary/30'
                        }`}>
                        {isDiffMode ? (
                            <GitCompare className="h-4 w-4 text-yellow-400" />
                        ) : (
                            <Sparkles className="h-4 w-4 text-primary" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold truncate flex items-center gap-2">
                            {file.name}
                            {isDiffMode && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                    Review Changes
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-2 text-xs">
                            <span className={`px-1.5 py-0.5 rounded-md border ${getCategoryColor()}`}>
                                {file.category}
                            </span>
                            {isDiffMode ? (
                                <span className="text-yellow-400/70 truncate max-w-[200px]">
                                    {editSummary}
                                </span>
                            ) : isSaving ? (
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Saving...
                                </span>
                            ) : (
                                <span className="text-green-400/70 flex items-center gap-1">
                                    <Check className="h-3 w-3" />
                                    Saved
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-1">
                    {!isDiffMode && (
                        <button
                            onClick={onOpenInEditor}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Open in full editor"
                        >
                            <Maximize2 className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}
                    <button
                        onClick={isDiffMode ? onRejectChanges : onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={isDiffMode ? "Discard changes" : "Close (Esc)"}
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* History Warning Banner */}
            {file.id === 'history' && (
                <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-200/90 text-[11px] font-medium animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-amber-400" />
                        <span>Viewing historical version. Edits won't be saved to the database.</span>
                    </div>
                    {onOpenLatest && (
                        <button
                            onClick={onOpenLatest}
                            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 transition-colors"
                        >
                            Open Latest Version
                        </button>
                    )}
                </div>
            )}

            {/* Editor - Normal or Diff mode */}
            <div className="flex-1 overflow-hidden">
                {isDiffMode ? (
                    <DiffEditorErrorBoundary>
                        <DiffEditor
                            key={`diff-${file.id}`}
                            original={originalContent || ''}
                            modified={file.content || ''}
                            language={getLanguage()}
                            theme="vs-dark"
                            onMount={handleDiffEditorMount}
                            options={{
                                readOnly: true,
                                renderSideBySide: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                lineNumbers: 'on',
                                wordWrap: 'on',
                            }}
                        />
                    </DiffEditorErrorBoundary>
                ) : (
                    <FileEditor
                        file={file}
                        onChange={handleChange}
                        onAddToChat={(selection) => {
                            console.log('[AgentPanel] Passing to Chat:', { file, selection });
                            onAddToChat && onAddToChat({ file, ...selection });
                        }}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/10 bg-black/40">
                {isDiffMode ? (
                    <>
                        <span className="text-xs text-yellow-400/70">
                            {isAccepted ? 'Changes have been applied' : 'Review the AI changes before applying'}
                        </span>
                        <div className="flex items-center gap-2">
                            {isAccepted ? (
                                <div className="flex items-center gap-1 px-3 h-7 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium">
                                    <Check className="h-3 w-3" />
                                    Applied
                                </div>
                            ) : (
                                <>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={onRejectChanges}
                                        className="h-7 px-3 rounded-lg text-xs hover:bg-red-500/20 hover:text-red-400"
                                    >
                                        <X className="h-3 w-3 mr-1.5" />
                                        Discard
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={onAcceptChanges}
                                        className="h-7 px-3 rounded-lg text-xs bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                                    >
                                        <Check className="h-3 w-3 mr-1.5" />
                                        Accept Changes
                                    </Button>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <span className="text-xs text-muted-foreground">
                            Auto-saves as you type
                        </span>
                        <Button
                            size="sm"
                            onClick={onOpenInEditor}
                            className="h-7 px-3 rounded-lg text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                        >
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            Full Editor
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

/**
 * CreatedDocumentCard - Shows in AI message bubble when a document is created
 */
export function CreatedDocumentCard({ file, onOpen, onOpenInEditor }) {
    if (!file) return null;

    const getCategoryColor = () => {
        switch (file.category?.toLowerCase()) {
            case 'docs': return 'from-blue-500/20 to-blue-600/10 border-blue-500/30';
            case 'code': return 'from-green-500/20 to-green-600/10 border-green-500/30';
            case 'notes': return 'from-purple-500/20 to-purple-600/10 border-purple-500/30';
            default: return 'from-gray-500/20 to-gray-600/10 border-gray-500/30';
        }
    };

    return (
        <div className={`mt-3 p-3 rounded-xl bg-gradient-to-r ${getCategoryColor()} border backdrop-blur-sm`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 sm:hidden">
                        <p className="text-sm font-semibold truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {file.category}
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-w-0 hidden sm:block">
                    <p className="text-sm font-semibold truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                        Created in {file.category} • Click to edit
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onOpen}
                        className="h-8 px-3 rounded-lg hover:bg-white/10 text-xs flex-1 sm:flex-none"
                    >
                        Edit
                    </Button>
                    <Button
                        size="sm"
                        onClick={onOpenInEditor}
                        className="h-8 px-3 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs flex-1 sm:flex-none"
                    >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * EditedDocumentCard - Shows in AI message bubble when a document is edited
 * Supports loading state while AI is processing
 */
export function EditedDocumentCard({
    file,
    editType = 'edit',  // 'rewrite', 'insert', 'replace', or 'loading'
    editSummary = '',
    isLoading = false,
    loadingStep = '',  // 'analyzing', 'generating', etc.
    onViewDiff,
    onOpenInEditor,
    isAccepted = false,
    isStale = false,
    isPersisted = false
}) {
    // Loading state - show while AI is processing
    if (isLoading) {
        return (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-600/10 border border-blue-500/30 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                        <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate flex items-center gap-2">
                            {file?.name || 'Processing...'}
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
                                Editing
                            </span>
                        </p>
                        <p className="text-xs text-blue-400/70 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-blue-400 rounded-full animate-pulse" />
                            {loadingStep || 'AI is processing changes...'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!file) return null;

    // Different styling for different edit types
    const getEditTypeStyle = () => {
        switch (editType) {
            case 'rewrite': return 'from-orange-500/20 to-red-600/10 border-orange-500/30';
            case 'insert': return 'from-green-500/20 to-emerald-600/10 border-green-500/30';
            case 'replace': return 'from-yellow-500/20 to-amber-600/10 border-yellow-500/30';
            default: return 'from-blue-500/20 to-indigo-600/10 border-blue-500/30';
        }
    };

    const getEditTypeLabel = () => {
        switch (editType) {
            case 'rewrite': return 'Rewritten';
            case 'insert': return 'Content Added';
            case 'replace': return 'Content Replaced';
            default: return 'Edited';
        }
    };

    return (
        <div className={`mt-3 p-3 rounded-xl bg-gradient-to-r ${getEditTypeStyle()} border backdrop-blur-sm`}>
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30 flex-shrink-0">
                    <FileEdit className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <p className="text-sm font-semibold truncate max-w-full sm:max-w-[180px]">
                            {file.name}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 whitespace-nowrap w-fit">
                                {getEditTypeLabel()}
                            </span>
                            {isAccepted && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium whitespace-nowrap w-fit">
                                    <Check className="h-3 w-3" />
                                    Applied
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {editSummary || 'Click to review changes'}
                    </p>
                </div>
            </div>

            {/* Action buttons - separate row for cleaner layout */}
            <div className="flex items-center gap-2 mt-3 ml-0 sm:ml-[52px]">
                {onViewDiff && (
                    <div className="relative group">
                        <Button
                            size="sm"
                            onClick={onViewDiff}
                            className={cn(
                                "h-7 px-2.5 rounded-lg text-xs border transition-all",
                                isStale
                                    ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30"
                                    : "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30"
                            )}
                        >
                            <GitCompare className="h-3 w-3 mr-1" />
                            {isStale ? "Outdated" : "View Changes"}
                        </Button>
                        {isStale && (
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-black/90 text-white text-[10px] rounded-md border border-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                This file has been modified since this edit was suggested.
                            </div>
                        )}
                    </div>
                )}

                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onOpenInEditor}
                    className="h-7 px-2.5 rounded-lg hover:bg-white/10 text-xs"
                >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                </Button>
            </div>
        </div>
    );
}


/**
 * CreatedTasksCard - Shows in AI message bubble when tasks are created
 */
export function CreatedTasksCard({ tasks, onViewTasks }) {
    if (!tasks || tasks.length === 0) return null;

    return (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-600/10 border border-green-500/30 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30">
                    <Check className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                        {tasks.length} Task{tasks.length > 1 ? 's' : ''} Created
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                        {tasks.map(t => t.title).join(', ')}
                    </p>
                </div>
                <Button
                    size="sm"
                    onClick={onViewTasks}
                    className="h-8 px-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs"
                >
                    View Tasks
                </Button>
            </div>
        </div>
    );
}


/**
 * CreatedMockupCard - Shows in AI message bubble when a UI mockup is created
 */
export function CreatedMockupCard({ file, onOpen, onOpenInEditor }) {
    if (!file) return null;

    return (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-600/10 border border-violet-500/30 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30 flex-shrink-0">
                        <Palette className="h-5 w-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0 sm:hidden">
                        <p className="text-sm font-semibold truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">Mockup</p>
                    </div>
                </div>

                <div className="flex-1 min-w-0 hidden sm:block">
                    <p className="text-sm font-semibold truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                        Created in Mockups • Click to preview
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onOpen}
                        className="h-8 px-3 rounded-lg hover:bg-white/10 text-xs flex-1 sm:flex-none"
                    >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                    </Button>
                    <Button
                        size="sm"
                        onClick={onOpenInEditor}
                        className="h-8 px-3 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 text-xs flex-1 sm:flex-none"
                    >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open
                    </Button>
                </div>
            </div>
        </div>
    );
}


/**
 * EditedMockupCard - Shows in AI message bubble when a UI mockup is edited
 * Supports loading state while AI is processing
 */
export function EditedMockupCard({
    file,
    editType = 'edit',  // 'rewrite', 'insert', 'replace'
    editSummary = '',
    isLoading = false,
    loadingStep = '',
    onViewDiff,
    onOpenInEditor,
    isAccepted = false,
    isStale = false,
    isPersisted = false
}) {
    // Loading state
    if (isLoading) {
        return (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-600/10 border border-violet-500/30 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
                        <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate flex items-center gap-2">
                            {file?.name || 'Processing...'}
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/30 animate-pulse">
                                Editing
                            </span>
                        </p>
                        <p className="text-xs text-violet-400/70 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-violet-400 rounded-full animate-pulse" />
                            {loadingStep || 'AI is redesigning the mockup...'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!file) return null;

    const getEditTypeStyle = () => {
        switch (editType) {
            case 'rewrite': return 'from-orange-500/20 to-red-600/10 border-orange-500/30';
            case 'insert': return 'from-green-500/20 to-emerald-600/10 border-green-500/30';
            case 'replace': return 'from-yellow-500/20 to-amber-600/10 border-yellow-500/30';
            default: return 'from-violet-500/20 to-purple-600/10 border-violet-500/30';
        }
    };

    const getEditTypeLabel = () => {
        switch (editType) {
            case 'rewrite': return 'Redesigned';
            case 'insert': return 'Elements Added';
            case 'replace': return 'Components Updated';
            default: return 'Edited';
        }
    };

    return (
        <div className={`mt-3 p-3 rounded-xl bg-gradient-to-r ${getEditTypeStyle()} border backdrop-blur-sm`}>
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30 flex-shrink-0">
                    <Palette className="h-5 w-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <p className="text-sm font-semibold truncate max-w-full sm:max-w-[180px]">
                            {file.name}
                        </p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/30 whitespace-nowrap w-fit">
                                {getEditTypeLabel()}
                            </span>
                            {isAccepted && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-medium whitespace-nowrap w-fit">
                                    <Check className="h-3 w-3" />
                                    Applied
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {editSummary || 'Click to preview changes'}
                    </p>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3 ml-0 sm:ml-[52px]">
                {onViewDiff && (
                    <div className="relative group">
                        <Button
                            size="sm"
                            onClick={onViewDiff}
                            className={cn(
                                "h-7 px-2.5 rounded-lg text-xs border transition-all",
                                isStale
                                    ? "bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30"
                                    : "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border-violet-500/30"
                            )}
                        >
                            <Eye className="h-3 w-3 mr-1" />
                            {isStale ? "Outdated" : "Preview Changes"}
                        </Button>
                        {isStale && (
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-black/90 text-white text-[10px] rounded-md border border-white/10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                                This mockup has been modified since this edit was suggested.
                            </div>
                        )}
                    </div>
                )}

                <Button
                    size="sm"
                    variant="ghost"
                    onClick={onOpenInEditor}
                    className="h-7 px-2.5 rounded-lg hover:bg-white/10 text-xs"
                >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                </Button>
            </div>
        </div>
    );
}

export default AgentEditorPanel;
