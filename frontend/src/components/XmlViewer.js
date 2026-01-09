import React, { useState, useMemo, useCallback } from 'react';
import {
    ChevronRight, ChevronDown, Search, Copy, Check,
    FileCode, Maximize2, Minimize2
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';

// Color theme for XML syntax highlighting
const colors = {
    tag: 'text-pink-400',
    tagBracket: 'text-zinc-500',
    attributeName: 'text-cyan-300',
    attributeValue: 'text-green-300',
    textContent: 'text-zinc-300',
    comment: 'text-zinc-500 italic',
    cdata: 'text-amber-300',
    declaration: 'text-purple-400',
    lineNumber: 'text-zinc-600',
    highlight: 'bg-yellow-500/20',
};

// Parse XML string into a tree structure
const parseXml = (xmlString) => {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'application/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            return { error: parseError.textContent, nodes: [] };
        }

        return { error: null, nodes: [buildNodeTree(doc.documentElement, 0)] };
    } catch (error) {
        return { error: error.message, nodes: [] };
    }
};

// Build a recursive tree structure from DOM nodes
const buildNodeTree = (node, depth = 0) => {
    const result = {
        id: Math.random().toString(36).substr(2, 9),
        nodeType: node.nodeType,
        tagName: node.tagName || '',
        attributes: [],
        textContent: '',
        children: [],
        depth,
    };

    // Get attributes
    if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            result.attributes.push({
                name: attr.name,
                value: attr.value,
            });
        }
    }

    // Process child nodes
    for (let i = 0; i < node.childNodes.length; i++) {
        const child = node.childNodes[i];

        if (child.nodeType === Node.ELEMENT_NODE) {
            result.children.push(buildNodeTree(child, depth + 1));
        } else if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent.trim();
            if (text) {
                result.textContent += text;
            }
        } else if (child.nodeType === Node.COMMENT_NODE) {
            result.children.push({
                id: Math.random().toString(36).substr(2, 9),
                nodeType: Node.COMMENT_NODE,
                textContent: child.textContent,
                depth: depth + 1,
            });
        } else if (child.nodeType === Node.CDATA_SECTION_NODE) {
            result.children.push({
                id: Math.random().toString(36).substr(2, 9),
                nodeType: Node.CDATA_SECTION_NODE,
                textContent: child.textContent,
                depth: depth + 1,
            });
        }
    }

    return result;
};

// Single XML node component with collapsible functionality
const XmlNode = ({
    node,
    expandedNodes,
    toggleNode,
    searchQuery,
    isSearchMatch
}) => {
    const hasChildren = (node.children && node.children.length > 0) || node.textContent;
    const isExpanded = expandedNodes.has(node.id);
    const indent = node.depth * 20;

    // Check if this node or its content matches the search
    const matchesSearch = useCallback((text) => {
        if (!searchQuery) return false;
        return text.toLowerCase().includes(searchQuery.toLowerCase());
    }, [searchQuery]);

    const tagMatches = matchesSearch(node.tagName || '');
    const attrMatches = node.attributes?.some(
        attr => matchesSearch(attr.name) || matchesSearch(attr.value)
    );
    const textMatches = matchesSearch(node.textContent || '');
    const nodeMatches = tagMatches || attrMatches || textMatches;

    // Render based on node type
    if (node.nodeType === Node.COMMENT_NODE) {
        return (
            <div
                className={`font-mono text-sm py-0.5 ${colors.comment} ${textMatches ? colors.highlight : ''}`}
                style={{ paddingLeft: indent + 8 }}
            >
                {'<!-- '}{node.textContent}{' -->'}
            </div>
        );
    }

    if (node.nodeType === Node.CDATA_SECTION_NODE) {
        return (
            <div
                className={`font-mono text-sm py-0.5 ${colors.cdata} ${textMatches ? colors.highlight : ''}`}
                style={{ paddingLeft: indent + 8 }}
            >
                {'<![CDATA['}{node.textContent}{']]>'}
            </div>
        );
    }

    // Element node
    return (
        <div className="select-text">
            {/* Opening tag line */}
            <div
                className={`flex items-start font-mono text-sm py-0.5 hover:bg-white/5 rounded group ${nodeMatches ? colors.highlight : ''}`}
                style={{ paddingLeft: indent }}
            >
                {/* Expand/collapse button */}
                {hasChildren ? (
                    <button
                        onClick={() => toggleNode(node.id)}
                        className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                ) : (
                    <span className="w-5" />
                )}

                {/* Tag content */}
                <span>
                    <span className={colors.tagBracket}>{'<'}</span>
                    <span className={`${colors.tag} ${tagMatches ? 'bg-yellow-500/30 rounded px-0.5' : ''}`}>
                        {node.tagName}
                    </span>

                    {/* Attributes */}
                    {node.attributes?.map((attr, idx) => (
                        <span key={idx}>
                            {' '}
                            <span className={`${colors.attributeName} ${matchesSearch(attr.name) ? 'bg-yellow-500/30 rounded px-0.5' : ''}`}>
                                {attr.name}
                            </span>
                            <span className={colors.tagBracket}>=</span>
                            <span className={colors.tagBracket}>"</span>
                            <span className={`${colors.attributeValue} ${matchesSearch(attr.value) ? 'bg-yellow-500/30 rounded px-0.5' : ''}`}>
                                {attr.value}
                            </span>
                            <span className={colors.tagBracket}>"</span>
                        </span>
                    ))}

                    {/* Self-closing or opening bracket */}
                    {!hasChildren ? (
                        <span className={colors.tagBracket}>{' />'}</span>
                    ) : (
                        <span className={colors.tagBracket}>{'>'}</span>
                    )}

                    {/* Inline text content for collapsed nodes or simple content */}
                    {!isExpanded && hasChildren && node.textContent && !node.children?.length && (
                        <>
                            <span className={`${colors.textContent} ${textMatches ? 'bg-yellow-500/30 rounded px-0.5' : ''}`}>
                                {node.textContent.length > 50 ? node.textContent.slice(0, 50) + '...' : node.textContent}
                            </span>
                            <span className={colors.tagBracket}>{'</'}</span>
                            <span className={colors.tag}>{node.tagName}</span>
                            <span className={colors.tagBracket}>{'>'}</span>
                        </>
                    )}

                    {/* Collapsed indicator */}
                    {!isExpanded && hasChildren && (node.children?.length > 0 || (node.textContent && node.children?.length > 0)) && (
                        <span className="text-zinc-600 ml-2">
                            {'...'}
                            <span className="text-xs ml-1">
                                ({node.children?.length || 0} {node.children?.length === 1 ? 'child' : 'children'})
                            </span>
                        </span>
                    )}
                </span>
            </div>

            {/* Expanded children */}
            {isExpanded && hasChildren && (
                <>
                    {/* Text content */}
                    {node.textContent && (
                        <div
                            className={`font-mono text-sm py-0.5 ${colors.textContent} ${textMatches ? colors.highlight : ''}`}
                            style={{ paddingLeft: indent + 28 }}
                        >
                            {node.textContent}
                        </div>
                    )}

                    {/* Child nodes */}
                    {node.children?.map(child => (
                        <XmlNode
                            key={child.id}
                            node={child}
                            expandedNodes={expandedNodes}
                            toggleNode={toggleNode}
                            searchQuery={searchQuery}
                            isSearchMatch={isSearchMatch}
                        />
                    ))}

                    {/* Closing tag */}
                    <div
                        className={`font-mono text-sm py-0.5 hover:bg-white/5 rounded ${nodeMatches ? colors.highlight : ''}`}
                        style={{ paddingLeft: indent + 20 }}
                    >
                        <span className={colors.tagBracket}>{'</'}</span>
                        <span className={colors.tag}>{node.tagName}</span>
                        <span className={colors.tagBracket}>{'>'}</span>
                    </div>
                </>
            )}
        </div>
    );
};

// Collect all node IDs for expand all functionality
const collectAllIds = (nodes) => {
    const ids = new Set();
    const traverse = (nodeList) => {
        nodeList.forEach(node => {
            if (node.children?.length > 0 || node.textContent) {
                ids.add(node.id);
            }
            if (node.children) {
                traverse(node.children);
            }
        });
    };
    traverse(nodes);
    return ids;
};

// Simple line-by-line XML syntax highlighting for raw view
const highlightXmlLine = (line) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
        // Comment
        const commentMatch = remaining.match(/^(\s*)(<!\s*--[\s\S]*?--\s*>)/);
        if (commentMatch) {
            parts.push(<span key={key++}>{commentMatch[1]}</span>);
            parts.push(<span key={key++} className={colors.comment}>{commentMatch[2]}</span>);
            remaining = remaining.slice(commentMatch[0].length);
            continue;
        }

        // Opening/closing tag with name
        const tagMatch = remaining.match(/^(\s*)(<\/?)([\w:.-]+)/);
        if (tagMatch) {
            parts.push(<span key={key++}>{tagMatch[1]}</span>);
            parts.push(<span key={key++} className={colors.tagBracket}>{tagMatch[2]}</span>);
            parts.push(<span key={key++} className={colors.tag}>{tagMatch[3]}</span>);
            remaining = remaining.slice(tagMatch[0].length);
            continue;
        }

        // Attribute
        const attrMatch = remaining.match(/^(\s+)([\w:.-]+)(=)("[^"]*"|'[^']*')/);
        if (attrMatch) {
            parts.push(<span key={key++}>{attrMatch[1]}</span>);
            parts.push(<span key={key++} className={colors.attributeName}>{attrMatch[2]}</span>);
            parts.push(<span key={key++} className={colors.tagBracket}>{attrMatch[3]}</span>);
            parts.push(<span key={key++} className={colors.attributeValue}>{attrMatch[4]}</span>);
            remaining = remaining.slice(attrMatch[0].length);
            continue;
        }

        // Tag closing brackets
        const bracketMatch = remaining.match(/^(\s*)(\/?>\s*)/);
        if (bracketMatch) {
            parts.push(<span key={key++}>{bracketMatch[1]}</span>);
            parts.push(<span key={key++} className={colors.tagBracket}>{bracketMatch[2]}</span>);
            remaining = remaining.slice(bracketMatch[0].length);
            continue;
        }

        // Text content (between tags)
        const textMatch = remaining.match(/^([^<]+)/);
        if (textMatch) {
            parts.push(<span key={key++} className={colors.textContent}>{textMatch[1]}</span>);
            remaining = remaining.slice(textMatch[0].length);
            continue;
        }

        // Leftover single character
        parts.push(<span key={key++}>{remaining[0]}</span>);
        remaining = remaining.slice(1);
    }

    return parts;
};

// Main XmlViewer component
export default function XmlViewer({ content, fileName }) {
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'raw'

    // Parse XML content
    const { error, nodes } = useMemo(() => parseXml(content || ''), [content]);

    // Initialize with first 2 levels expanded
    const initializeExpanded = useCallback(() => {
        const ids = new Set();
        const traverse = (nodeList, depth = 0) => {
            nodeList.forEach(node => {
                if (depth < 2 && (node.children?.length > 0 || node.textContent)) {
                    ids.add(node.id);
                }
                if (node.children && depth < 2) {
                    traverse(node.children, depth + 1);
                }
            });
        };
        traverse(nodes);
        return ids;
    }, [nodes]);

    // Initialize expanded state when nodes change
    React.useEffect(() => {
        setExpandedNodes(initializeExpanded());
    }, [initializeExpanded]);

    const toggleNode = useCallback((id) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setExpandedNodes(collectAllIds(nodes));
    }, [nodes]);

    const collapseAll = useCallback(() => {
        setExpandedNodes(new Set());
    }, []);

    const copyToClipboard = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            toast.success('Copied to clipboard');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy');
        }
    }, [content]);

    // For parse errors, show a formatted raw view with warning
    if (error) {
        return (
            <div className="h-full w-full flex flex-col bg-[#0d0d0d]">
                {/* Toolbar with warning */}
                <div className="flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-xl border-b border-amber-500/30 flex-shrink-0">
                    <FileCode className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-muted-foreground font-mono">
                        {fileName || 'XML Document'}
                    </span>
                    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        ⚠ Not valid XML - showing formatted view
                    </span>

                    <div className="flex-1" />

                    {/* Search */}
                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            className="h-8 pl-8 text-sm bg-secondary/30 border-white/10 rounded-lg"
                        />
                    </div>

                    {/* Copy button */}
                    <button
                        onClick={copyToClipboard}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                        title="Copy to clipboard"
                    >
                        {copied ? (
                            <Check className="h-4 w-4 text-green-400" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </button>
                </div>

                {/* Formatted raw content with syntax highlighting */}
                <ScrollArea className="flex-1">
                    <pre className="p-4 text-sm font-mono leading-relaxed">
                        {content.split('\n').map((line, idx) => {
                            const matchesLine = searchQuery && line.toLowerCase().includes(searchQuery.toLowerCase());
                            return (
                                <div key={idx} className={`flex ${matchesLine ? 'bg-yellow-500/20' : ''}`}>
                                    <span className={`${colors.lineNumber} w-8 text-right mr-4 select-none`}>
                                        {idx + 1}
                                    </span>
                                    <span>{highlightXmlLine(line)}</span>
                                </div>
                            );
                        })}
                    </pre>
                </ScrollArea>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-[#0d0d0d]">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-xl border-b border-white/10 flex-shrink-0">
                <FileCode className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground font-mono">
                    {fileName || 'XML Document'}
                </span>

                <div className="flex-1" />

                {/* Search */}
                <div className="relative w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="h-8 pl-8 text-sm bg-secondary/30 border-white/10 rounded-lg"
                    />
                </div>

                {/* View mode toggle */}
                <div className="flex items-center bg-secondary/30 rounded-lg p-1 border border-white/10">
                    <button
                        onClick={() => setViewMode('tree')}
                        className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'tree'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Tree
                    </button>
                    <button
                        onClick={() => setViewMode('raw')}
                        className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'raw'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Raw
                    </button>
                </div>

                {/* Expand/Collapse buttons */}
                {viewMode === 'tree' && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={expandAll}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                            title="Expand all"
                        >
                            <Maximize2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={collapseAll}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                            title="Collapse all"
                        >
                            <Minimize2 className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Copy button */}
                <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                    title="Copy to clipboard"
                >
                    {copied ? (
                        <Check className="h-4 w-4 text-green-400" />
                    ) : (
                        <Copy className="h-4 w-4" />
                    )}
                </button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                {viewMode === 'tree' ? (
                    <div className="p-4">
                        {nodes.map(node => (
                            <XmlNode
                                key={node.id}
                                node={node}
                                expandedNodes={expandedNodes}
                                toggleNode={toggleNode}
                                searchQuery={searchQuery}
                                isSearchMatch={false}
                            />
                        ))}
                    </div>
                ) : (
                    <pre className="p-4 text-sm font-mono text-zinc-300 whitespace-pre-wrap">
                        {content}
                    </pre>
                )}
            </ScrollArea>
        </div>
    );
}

// Compact inline XML viewer for preview modals
export function XmlPreviewCompact({ content, fileName }) {
    const [viewMode, setViewMode] = useState('formatted');
    const [copied, setCopied] = useState(false);

    // Format XML with proper indentation
    const formattedXml = useMemo(() => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'application/xml');

            const parseError = doc.querySelector('parsererror');
            if (parseError) {
                return { error: true, content };
            }

            // Pretty print the XML
            const serializer = new XMLSerializer();
            const xmlString = serializer.serializeToString(doc);

            // Basic formatting with indentation
            let formatted = '';
            let indent = 0;
            const lines = xmlString.replace(/></g, '>\n<').split('\n');

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                // Decrease indent for closing tags
                if (trimmed.startsWith('</')) {
                    indent = Math.max(0, indent - 1);
                }

                formatted += '  '.repeat(indent) + trimmed + '\n';

                // Increase indent for opening tags (that aren't self-closing)
                if (trimmed.startsWith('<') && !trimmed.startsWith('</') &&
                    !trimmed.endsWith('/>') && !trimmed.startsWith('<?')) {
                    indent++;
                }
            });

            return { error: false, content: formatted };
        } catch {
            return { error: true, content };
        }
    }, [content]);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            toast.success('Copied');
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Copy failed');
        }
    };

    // Syntax highlight a line of XML
    const highlightLine = (line) => {
        // Very simple syntax highlighting
        const parts = [];
        let remaining = line;
        let key = 0;

        // Match patterns
        const patterns = [
            { regex: /^(\s*)(<!--[\s\S]*?-->)/, type: 'comment' },
            { regex: /^(\s*)(<\?[\s\S]*?\?>)/, type: 'declaration' },
            { regex: /^(\s*)(<!\[CDATA\[[\s\S]*?\]\]>)/, type: 'cdata' },
            { regex: /^(\s*)(<\/?)([a-zA-Z0-9_:-]+)/, type: 'tag' },
            { regex: /^(\s*)([a-zA-Z0-9_:-]+)(=)(".*?"|'.*?')/, type: 'attr' },
            { regex: /^(\s*)(\/?>)/, type: 'bracket' },
            { regex: /^(\s*)(>)([^<]+)(<)/, type: 'content' },
        ];

        while (remaining.length > 0) {
            let matched = false;

            for (const { regex, type } of patterns) {
                const match = remaining.match(regex);
                if (match) {
                    matched = true;

                    if (type === 'comment') {
                        parts.push(<span key={key++} className={colors.comment}>{match[0]}</span>);
                    } else if (type === 'declaration') {
                        parts.push(<span key={key++} className={colors.declaration}>{match[0]}</span>);
                    } else if (type === 'cdata') {
                        parts.push(<span key={key++} className={colors.cdata}>{match[0]}</span>);
                    } else if (type === 'tag') {
                        parts.push(<span key={key++}>{match[1]}</span>);
                        parts.push(<span key={key++} className={colors.tagBracket}>{match[2]}</span>);
                        parts.push(<span key={key++} className={colors.tag}>{match[3]}</span>);
                    } else if (type === 'attr') {
                        parts.push(<span key={key++}>{match[1]}</span>);
                        parts.push(<span key={key++} className={colors.attributeName}>{match[2]}</span>);
                        parts.push(<span key={key++} className={colors.tagBracket}>{match[3]}</span>);
                        parts.push(<span key={key++} className={colors.attributeValue}>{match[4]}</span>);
                    } else if (type === 'bracket') {
                        parts.push(<span key={key++}>{match[1]}</span>);
                        parts.push(<span key={key++} className={colors.tagBracket}>{match[2]}</span>);
                    } else if (type === 'content') {
                        parts.push(<span key={key++}>{match[1]}</span>);
                        parts.push(<span key={key++} className={colors.tagBracket}>{match[2]}</span>);
                        parts.push(<span key={key++} className={colors.textContent}>{match[3]}</span>);
                        parts.push(<span key={key++} className={colors.tagBracket}>{match[4]}</span>);
                    }

                    remaining = remaining.slice(match[0].length);
                    break;
                }
            }

            if (!matched) {
                // No pattern matched, take one character
                parts.push(<span key={key++}>{remaining[0]}</span>);
                remaining = remaining.slice(1);
            }
        }

        return parts;
    };

    return (
        <div className="h-full w-full flex flex-col">
            {/* Mini toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-black/50 border-b border-white/10">
                <FileCode className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-mono text-muted-foreground flex-1">{fileName}</span>

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setViewMode(viewMode === 'formatted' ? 'raw' : 'formatted')}
                        className="px-2 py-1 text-xs rounded-md bg-secondary/30 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {viewMode === 'formatted' ? 'Raw' : 'Formatted'}
                    </button>
                    <button
                        onClick={copyToClipboard}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <pre className="p-4 text-sm font-mono leading-relaxed">
                    {viewMode === 'formatted' && !formattedXml.error
                        ? formattedXml.content.split('\n').map((line, idx) => (
                            <div key={idx} className="flex">
                                <span className={`${colors.lineNumber} w-8 text-right mr-4 select-none`}>
                                    {idx + 1}
                                </span>
                                <span>{highlightLine(line)}</span>
                            </div>
                        ))
                        : content.split('\n').map((line, idx) => (
                            <div key={idx} className="flex">
                                <span className={`${colors.lineNumber} w-8 text-right mr-4 select-none`}>
                                    {idx + 1}
                                </span>
                                <span className="text-zinc-300">{line}</span>
                            </div>
                        ))
                    }
                </pre>
            </ScrollArea>
        </div>
    );
}
