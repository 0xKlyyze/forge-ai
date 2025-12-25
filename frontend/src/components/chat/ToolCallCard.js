import React, { useState } from 'react';
import {
    FileText, CheckSquare, Edit3, Plus, Loader2, Check, X,
    ExternalLink, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';

/**
 * ToolCallCard - Displays an AI tool call with its arguments and execution status
 * Used to show pending actions like create_document, create_tasks, etc.
 */
export function ToolCallCard({
    toolCall,
    onExecute,
    onOpenEditor,
    isExecuting = false,
    result = null
}) {
    const [expanded, setExpanded] = useState(true);
    const { tool_name, arguments: args, status } = toolCall;

    // Determine icon and styling based on tool type
    const getToolConfig = () => {
        switch (tool_name) {
            case 'create_document':
                return {
                    icon: Plus,
                    iconBg: 'bg-blue-500/20',
                    iconColor: 'text-blue-400',
                    title: 'Create Document',
                    subtitle: args?.name || 'New Document',
                    accentColor: 'border-blue-500/30',
                    buttonText: 'Create & Open Editor'
                };
            case 'modify_document':
                return {
                    icon: Edit3,
                    iconBg: 'bg-amber-500/20',
                    iconColor: 'text-amber-400',
                    title: 'Modify Document',
                    subtitle: args?.file_name || 'Document',
                    accentColor: 'border-amber-500/30',
                    buttonText: 'Apply Changes'
                };
            case 'create_tasks':
                return {
                    icon: CheckSquare,
                    iconBg: 'bg-green-500/20',
                    iconColor: 'text-green-400',
                    title: 'Create Tasks',
                    subtitle: `${args?.tasks?.length || 0} task(s)`,
                    accentColor: 'border-green-500/30',
                    buttonText: 'Create Tasks'
                };
            case 'modify_task':
                return {
                    icon: Edit3,
                    iconBg: 'bg-purple-500/20',
                    iconColor: 'text-purple-400',
                    title: 'Modify Task',
                    subtitle: args?.task_title || 'Task',
                    accentColor: 'border-purple-500/30',
                    buttonText: 'Apply Changes'
                };
            default:
                return {
                    icon: Sparkles,
                    iconBg: 'bg-primary/20',
                    iconColor: 'text-primary',
                    title: 'AI Action',
                    subtitle: tool_name,
                    accentColor: 'border-primary/30',
                    buttonText: 'Execute'
                };
        }
    };

    const config = getToolConfig();
    const Icon = config.icon;
    const isSuccess = status === 'success' || result?.success;
    const isError = status === 'error';
    const isPending = status === 'pending' && !isExecuting && !isSuccess;

    // Render document content preview
    const renderDocumentPreview = () => {
        if (tool_name === 'create_document' || tool_name === 'modify_document') {
            const content = args?.content || args?.new_content || '';
            if (!content) return null;

            return (
                <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/5 max-h-32 overflow-hidden relative">
                    <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-5">
                        {content.substring(0, 500)}
                        {content.length > 500 && '...'}
                    </pre>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent" />
                </div>
            );
        }
        return null;
    };

    // Render tasks preview
    const renderTasksPreview = () => {
        if (tool_name === 'create_tasks' && args?.tasks) {
            return (
                <div className="mt-3 space-y-2">
                    {args.tasks.slice(0, 5).map((task, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 p-2 bg-black/30 rounded-lg border border-white/5"
                        >
                            <CheckSquare className="h-4 w-4 text-green-400 flex-shrink-0" />
                            <span className="text-sm flex-1 truncate">{task.title}</span>
                            {task.priority && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${task.priority === 'high'
                                        ? 'bg-red-500/20 text-red-400'
                                        : task.priority === 'low'
                                            ? 'bg-gray-500/20 text-gray-400'
                                            : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {task.priority}
                                </span>
                            )}
                        </div>
                    ))}
                    {args.tasks.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                            +{args.tasks.length - 5} more tasks
                        </p>
                    )}
                </div>
            );
        }
        return null;
    };

    // Render task modification preview
    const renderTaskModifyPreview = () => {
        if (tool_name === 'modify_task' && args?.updates) {
            return (
                <div className="mt-3 p-3 bg-black/30 rounded-lg border border-white/5">
                    <p className="text-xs text-muted-foreground mb-2">Changes:</p>
                    <div className="space-y-1">
                        {Object.entries(args.updates).map(([key, value]) => (
                            <div key={key} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">{key}:</span>
                                <span className="text-foreground">{String(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={`
            rounded-2xl border ${config.accentColor} bg-secondary/40 backdrop-blur-sm
            overflow-hidden transition-all duration-300
            ${isSuccess ? 'border-green-500/40 bg-green-500/5' : ''}
            ${isError ? 'border-red-500/40 bg-red-500/5' : ''}
        `}>
            {/* Header */}
            <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Icon */}
                <div className={`h-10 w-10 rounded-xl ${config.iconBg} flex items-center justify-center`}>
                    {isExecuting ? (
                        <Loader2 className={`h-5 w-5 ${config.iconColor} animate-spin`} />
                    ) : isSuccess ? (
                        <Check className="h-5 w-5 text-green-400" />
                    ) : isError ? (
                        <X className="h-5 w-5 text-red-400" />
                    ) : (
                        <Icon className={`h-5 w-5 ${config.iconColor}`} />
                    )}
                </div>

                {/* Title & Subtitle */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        {config.title}
                        {isSuccess && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                Done
                            </span>
                        )}
                    </h4>
                    <p className="text-xs text-muted-foreground truncate">{config.subtitle}</p>
                </div>

                {/* Expand/Collapse */}
                <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4">
                    {/* Content previews */}
                    {renderDocumentPreview()}
                    {renderTasksPreview()}
                    {renderTaskModifyPreview()}

                    {/* Action Buttons */}
                    {isPending && (
                        <div className="flex items-center gap-2 mt-4">
                            <Button
                                onClick={() => onExecute(toolCall)}
                                disabled={isExecuting}
                                className="flex-1 h-9 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                            >
                                {isExecuting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Executing...
                                    </>
                                ) : (
                                    <>
                                        <Check className="h-4 w-4 mr-2" />
                                        {config.buttonText}
                                    </>
                                )}
                            </Button>

                            {(tool_name === 'create_document' || tool_name === 'modify_document') && (
                                <Button
                                    onClick={() => onOpenEditor(toolCall)}
                                    variant="ghost"
                                    className="h-9 px-3 rounded-xl border border-white/10 hover:bg-white/5"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Success message */}
                    {isSuccess && result?.message && (
                        <div className="mt-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                            <p className="text-sm text-green-400 flex items-center gap-2">
                                <Check className="h-4 w-4" />
                                {result.message}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * ToolCallList - Renders a list of tool calls from an AI message
 */
export function ToolCallList({
    toolCalls = [],
    onExecute,
    onOpenEditor,
    executingTools = {},
    results = {}
}) {
    if (!toolCalls || toolCalls.length === 0) return null;

    return (
        <div className="space-y-3 mt-4">
            {toolCalls.map((toolCall, index) => (
                <ToolCallCard
                    key={`${toolCall.tool_name}-${index}`}
                    toolCall={toolCall}
                    onExecute={onExecute}
                    onOpenEditor={onOpenEditor}
                    isExecuting={executingTools[index]}
                    result={results[index]}
                />
            ))}
        </div>
    );
}

export default ToolCallCard;
