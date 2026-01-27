/**
 * MockupPreviewPanel - Side panel for previewing and editing AI-created/edited UI mockups
 * Supports both preview mode (Sandpack) and code mode (Monaco), plus diff view for edits
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, Component } from 'react';
import {
    X, Code, Eye, Check, Loader2, ExternalLink, Sparkles, Maximize2, Minimize2,
    GitCompare, Monitor, Tablet, Smartphone, Minus, Plus, RotateCcw, Clock
} from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { DiffEditor } from '@monaco-editor/react';
import MonacoEditor from '@monaco-editor/react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackPreview
} from "@codesandbox/sandpack-react";
import { createPortal } from 'react-dom';
import { atomDark } from "@codesandbox/sandpack-themes";
import { cn } from '../../lib/utils';

// Dependency Detection Helper (reused from Preview.js)
const DEPENDENCY_MAP = {
    'framer-motion': 'latest',
    'recharts': 'latest',
    'lucide-react': 'latest',
    'clsx': 'latest',
    'tailwind-merge': 'latest',
    'date-fns': 'latest',
    'lodash': 'latest',
    'axios': 'latest',
    'react-router-dom': 'latest',
    '@radix-ui/react-dialog': 'latest',
    '@radix-ui/react-slot': 'latest',
    'zod': 'latest',
    'react-hook-form': 'latest',
    'react-is': 'latest'
};

const extractDependencies = (code) => {
    const deps = {
        "lucide-react": "latest",
        "clsx": "latest",
        "tailwind-merge": "latest"
    };

    if (!code) return deps;

    Object.keys(DEPENDENCY_MAP).forEach(pkg => {
        if (code.includes(`from '${pkg}'`) || code.includes(`from "${pkg}"`)) {
            deps[pkg] = DEPENDENCY_MAP[pkg];
        }
    });

    return deps;
};

// Device presets for responsive testing
const DEVICE_PRESETS = [
    { id: 'responsive', label: 'Responsive', width: null, icon: Monitor },
    { id: 'desktop', label: 'Desktop', width: 1280, icon: Monitor },
    { id: 'tablet', label: 'Tablet', width: 768, icon: Tablet },
    { id: 'mobile', label: 'Mobile', width: 375, icon: Smartphone },
];

/**
 * Error boundary to catch Monaco DiffEditor disposal errors
 */
class DiffEditorErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        if (error?.message?.includes('TextModel got disposed') ||
            error?.message?.includes('DiffEditorWidget')) {
            return { hasError: false };
        }
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
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

export function MockupPreviewPanel({
    file = null,                // { id, name, category, content }
    originalContent = null,     // For diff view
    isDiffMode = false,         // Show diff view
    editSummary = '',           // Summary of changes
    onContentChange,            // (fileId, content)
    onAcceptChanges,            // Accept diff changes
    onRejectChanges,            // Reject and close
    onOpenInEditor,             // Open in full editor
    onClose,
    isSaving = false,
    isAccepted = false,         // Changes already applied
    onOpenLatest = null         // Switch to latest version
}) {
    const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
    const [zoom, setZoom] = useState(100);
    const [devicePreset, setDevicePreset] = useState('responsive');
    const [refreshKey, setRefreshKey] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const diffEditorRef = useRef(null);

    const dependencies = useMemo(() => extractDependencies(file?.content), [file?.content]);
    const currentDevice = DEVICE_PRESETS.find(d => d.id === devicePreset);

    // Zoom handlers
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
    const handleRefresh = () => setRefreshKey(prev => prev + 1);

    // Global error handler for Monaco
    useEffect(() => {
        const handleError = (event) => {
            if (event.message?.includes('TextModel got disposed') ||
                event.message?.includes('DiffEditorWidget')) {
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
        };

        window.addEventListener('error', handleError, true);
        return () => window.removeEventListener('error', handleError, true);
    }, []);

    // Cleanup DiffEditor
    useEffect(() => {
        return () => {
            if (diffEditorRef.current) {
                try {
                    const editor = diffEditorRef.current;
                    editor.setModel?.(null);
                    editor.dispose?.();
                } catch (e) {
                    console.debug('DiffEditor cleanup:', e.message);
                }
                diffEditorRef.current = null;
            }
        };
    }, [isDiffMode]);

    const handleDiffEditorMount = useCallback((editor) => {
        diffEditorRef.current = editor;
    }, []);

    // Get language for Monaco
    const getLanguage = () => {
        if (!file?.name) return 'javascript';
        const ext = file.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'tsx': return 'typescript';
            case 'ts': return 'typescript';
            case 'jsx':
            case 'js':
            default: return 'javascript';
        }
    };

    // Handle content change
    const handleCodeChange = (newContent) => {
        if (onContentChange && !isDiffMode) {
            onContentChange(file.id, newContent);
        }
    };

    if (!file) return null;

    // Frame style for device presets
    const getFrameStyle = () => {
        if (currentDevice?.width) {
            return {
                width: `${currentDevice.width}px`,
                maxWidth: '100%',
                margin: '0 auto',
            };
        }
        return { width: '100%', height: '100%' };
    };

    const zoomStyle = {
        zoom: zoom / 100,
        MozTransform: `scale(${zoom / 100})`,
        MozTransformOrigin: '0 0',
    };

    const PanelContent = (
        <div className={cn(
            "flex flex-col bg-[#1e1e1e] rounded-2xl border border-white/10 overflow-hidden shadow-2xl transition-all duration-300",
            isFullscreen
                ? "fixed inset-4 z-[100] rounded-2xl"
                : "h-full"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${isDiffMode
                        ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/20 border-yellow-500/30'
                        : 'bg-gradient-to-br from-violet-500/30 to-purple-500/20 border-violet-500/30'
                        }`}>
                        {isDiffMode ? (
                            <GitCompare className="h-4 w-4 text-yellow-400" />
                        ) : (
                            <Sparkles className="h-4 w-4 text-violet-400" />
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
                            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md border bg-violet-500/20 text-violet-400 border-violet-500/30">
                                Mockup
                            </span>
                            {isDiffMode ? (
                                <span className="text-yellow-400/70 truncate max-w-[150px] sm:max-w-[200px]">
                                    {editSummary}
                                </span>
                            ) : isSaving ? (
                                <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Saving...
                                </span>
                            ) : (
                                <span className="text-green-400/70 flex items-center gap-1 hidden sm:flex">
                                    <Check className="h-3 w-3" />
                                    Saved
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* View Mode Toggle & Actions */}
                <div className="flex items-center gap-2">
                    {!isDiffMode && (
                        <div className="flex items-center bg-white/5 rounded-lg p-0.5">
                            <button
                                onClick={() => setViewMode('preview')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                    viewMode === 'preview'
                                        ? "bg-violet-500/20 text-violet-400"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Eye className="h-3.5 w-3.5" />
                                Preview
                            </button>
                            <button
                                onClick={() => setViewMode('code')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                                    viewMode === 'code'
                                        ? "bg-violet-500/20 text-violet-400"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Code className="h-3.5 w-3.5" />
                                Code
                            </button>
                        </div>
                    )}
                    {!isDiffMode && (
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title={isFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Maximize2 className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                    )}
                    <button
                        onClick={isDiffMode ? onRejectChanges : onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title={isDiffMode ? "Discard changes" : "Close"}
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

            {/* Preview Toolbar (only in preview mode) */}
            {viewMode === 'preview' && !isDiffMode && (
                <div className="flex items-center gap-2 px-3 py-2 bg-black/60 border-b border-white/5">
                    {/* Device Presets */}
                    <div className="flex items-center gap-1 border-r border-white/10 pr-3 mr-1">
                        {DEVICE_PRESETS.map(device => (
                            <button
                                key={device.id}
                                onClick={() => setDevicePreset(device.id)}
                                className={cn(
                                    "p-1.5 rounded-lg transition-all",
                                    devicePreset === device.id
                                        ? 'bg-violet-500/20 text-violet-400'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                )}
                                title={device.label}
                            >
                                <device.icon className="h-4 w-4" />
                            </button>
                        ))}
                    </div>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= 25}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-30 transition-all"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <div className="flex items-center gap-2 min-w-[100px]">
                            <Slider
                                value={[zoom]}
                                onValueChange={([val]) => setZoom(val)}
                                min={25}
                                max={200}
                                step={5}
                                className="w-16"
                            />
                            <span className="text-xs text-muted-foreground font-mono w-8">
                                {zoom}%
                            </span>
                        </div>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-30 transition-all"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Refresh */}
                    <div className="ml-auto">
                        <button
                            onClick={handleRefresh}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                            title="Refresh preview"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {isDiffMode ? (
                    // Diff View (Code comparison)
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
                ) : viewMode === 'preview' ? (
                    // Live Preview (Sandpack)
                    <div className="h-full w-full bg-[#0d0d0d] overflow-hidden flex justify-center">
                        {/* Responsive mode - full width, no frame */}
                        {devicePreset === 'responsive' ? (
                            <div className="h-full w-full bg-[#0d0d0d] flex flex-col" style={zoomStyle}>
                                <SandpackProvider
                                    key={refreshKey}
                                    template="react"
                                    theme={atomDark}
                                    files={{
                                        "/App.js": file.content,
                                    }}
                                    options={{
                                        externalResources: ["https://cdn.tailwindcss.com"],
                                    }}
                                    customSetup={{
                                        dependencies: dependencies
                                    }}
                                    style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                                >
                                    <SandpackLayout style={{
                                        border: 'none',
                                        borderRadius: 0,
                                        backgroundColor: 'transparent',
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}>
                                        <SandpackPreview
                                            style={{ flex: 1 }}
                                            showOpenInCodeSandbox={false}
                                            showRefreshButton={false}
                                        />
                                    </SandpackLayout>
                                </SandpackProvider>
                            </div>
                        ) : (
                            /* Device preset modes - show browser frame */
                            <div className="p-4">
                                <div
                                    className="bg-[#111] rounded-xl border border-white/10 overflow-hidden flex flex-col"
                                    style={{
                                        ...getFrameStyle(),
                                        height: 'fit-content',
                                        minHeight: '400px',
                                    }}
                                >
                                    {/* Browser-like header */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-black/50 border-b border-white/5">
                                        <div className="flex gap-1.5">
                                            <div className="w-3 h-3 rounded-full bg-red-500/60" />
                                            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                                            <div className="w-3 h-3 rounded-full bg-green-500/60" />
                                        </div>
                                        <div className="flex-1 mx-4">
                                            <div className="bg-white/5 rounded-md px-3 py-1 text-xs text-muted-foreground font-mono text-center">
                                                localhost:3000
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sandpack Preview */}
                                    <div className="flex-1 overflow-auto origin-top-left" style={zoomStyle}>
                                        <SandpackProvider
                                            key={refreshKey}
                                            template="react"
                                            theme={atomDark}
                                            files={{
                                                "/App.js": file.content,
                                            }}
                                            options={{
                                                externalResources: ["https://cdn.tailwindcss.com"],
                                            }}
                                            customSetup={{
                                                dependencies: dependencies
                                            }}
                                        >
                                            <SandpackLayout style={{
                                                border: 'none',
                                                borderRadius: 0,
                                                backgroundColor: 'transparent',
                                                minHeight: '350px',
                                            }}>
                                                <SandpackPreview
                                                    style={{ minHeight: '350px' }}
                                                    showOpenInCodeSandbox={false}
                                                    showRefreshButton={false}
                                                />
                                            </SandpackLayout>
                                        </SandpackProvider>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Code Editor (Monaco)
                    <MonacoEditor
                        height="100%"
                        language={getLanguage()}
                        value={file.content}
                        theme="vs-dark"
                        onChange={handleCodeChange}
                        options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            lineNumbers: 'on',
                            wordWrap: 'on',
                            tabSize: 2,
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
                            {viewMode === 'preview' ? 'Live preview • Switch to Code to edit' : 'Auto-saves as you type'}
                        </span>
                        <Button
                            size="sm"
                            onClick={onOpenInEditor}
                            className="h-7 px-3 rounded-lg text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30"
                        >
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            Full Editor
                        </Button>
                    </>
                )}
            </div>
        </div>
    );

    if (isFullscreen) {
        return createPortal(
            <>
                <div
                    className="fixed inset-0 bg-black/80 z-[99] backdrop-blur-sm"
                    onClick={() => setIsFullscreen(false)}
                />
                {PanelContent}
            </>,
            document.body
        );
    }

    return PanelContent;
}

export default MockupPreviewPanel;
