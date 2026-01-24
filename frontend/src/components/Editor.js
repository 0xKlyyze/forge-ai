import React, { useState, useRef, useEffect, Component } from 'react';
import MonacoEditor from '@monaco-editor/react';
import api from '../utils/api';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Sparkles, X, Check, ArrowDown, Loader2, MessageSquarePlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Error boundary to catch Monaco Editor errors.
 * Prevents the entire app from crashing on editor errors (especially on mobile/tablet).
 */
class EditorErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging but don't crash the app
    console.error('Editor error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-[#1e1e1e] flex flex-col items-center justify-center gap-4 p-8">
          <AlertTriangle className="h-12 w-12 text-yellow-500" />
          <h3 className="text-lg font-semibold text-white">Editor encountered an issue</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Something went wrong with the editor. This can happen on mobile devices during rapid text operations.
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2"
          >
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper function to detect file language from filename
const getLanguageFromFilename = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();

  const languageMap = {
    // Markup
    md: 'markdown',
    xml: 'xml',
    svg: 'xml',
    xsl: 'xml',
    xslt: 'xml',
    xsd: 'xml',
    plist: 'xml',
    config: 'xml',
    html: 'html',
    htm: 'html',
    // TypeScript
    tsx: 'typescript',
    ts: 'typescript',
    // JavaScript
    jsx: 'javascript',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    // Styles
    css: 'css',
    scss: 'scss',
    less: 'less',
    // Data formats
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    // Python
    py: 'python',
    // SQL
    sql: 'sql',
    // Shell
    sh: 'shell',
    bash: 'shell',
  };

  return languageMap[ext] || 'plaintext';
};

export default function FileEditor({ file, onChange, onAddToChat, readOnly }) {
  const language = getLanguageFromFilename(file.name);

  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0, showAbove: true });
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState(null);
  const [contextBefore, setContextBefore] = useState('');
  const [contextAfter, setContextAfter] = useState('');

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const POPUP_HEIGHT = 160; // Approximate popup height
  const POPUP_WIDTH = 320;

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Listen for selection changes
    // Wrapped in try/catch to prevent crashes on mobile devices during rapid text operations
    editor.onDidChangeCursorSelection((e) => {
      if (readOnly) return;
      try {
        const selection = editor.getSelection();
        const model = editor.getModel();

        // Defensive check: model can be null/disposed during rapid updates on mobile
        if (!model || typeof model.getValueInRange !== 'function') {
          setShowAIPopup(false);
          return;
        }

        if (selection && !selection.isEmpty()) {
          // Validate selection range before accessing
          const lineCount = model.getLineCount();
          if (selection.startLineNumber < 1 || selection.endLineNumber > lineCount) {
            setShowAIPopup(false);
            return;
          }

          let text;
          try {
            text = model.getValueInRange(selection);
          } catch (rangeError) {
            // Model may have changed during rapid text deletion
            console.debug('Selection range error (expected during rapid edits):', rangeError);
            setShowAIPopup(false);
            return;
          }

          if (text && text.trim().length > 0) {
            setSelectedText(text);
            setSelectionRange(selection);

            // Get surrounding context (up to 50 lines before and after)
            const startLine = Math.max(1, selection.startLineNumber - 50);
            const endLine = Math.min(lineCount, selection.endLineNumber + 50);

            try {
              const beforeRange = {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: selection.startLineNumber,
                endColumn: selection.startColumn
              };
              const afterRange = {
                startLineNumber: selection.endLineNumber,
                startColumn: selection.endColumn,
                endLineNumber: endLine,
                endColumn: model.getLineMaxColumn(endLine)
              };

              setContextBefore(model.getValueInRange(beforeRange));
              setContextAfter(model.getValueInRange(afterRange));
            } catch (contextError) {
              // Non-critical: context is only used for AI edits, not core functionality
              console.debug('Context extraction error:', contextError);
              setContextBefore('');
              setContextAfter('');
            }

            // Calculate popup position - try to show above selection start
            const startPosition = editor.getScrolledVisiblePosition({
              lineNumber: selection.startLineNumber,
              column: selection.startColumn
            });

            const endPosition = editor.getScrolledVisiblePosition({
              lineNumber: selection.endLineNumber,
              column: selection.endColumn
            });

            // Validate positions exist and have required properties
            if (startPosition && endPosition && containerRef.current &&
              typeof startPosition.top === 'number' && typeof endPosition.top === 'number') {
              const containerRect = containerRef.current.getBoundingClientRect();

              // Validate container dimensions
              if (containerRect.width <= 0 || containerRect.height <= 0) {
                setShowAIPopup(false);
                return;
              }

              // Calculate x position - center on selection, but keep in bounds
              const selectionCenterX = (startPosition.left + endPosition.left) / 2;
              let x = Math.max(10, Math.min(selectionCenterX - POPUP_WIDTH / 2, containerRect.width - POPUP_WIDTH - 10));

              // Calculate y position - prefer above selection
              const spaceAbove = startPosition.top;
              const endHeight = endPosition.height || 20; // Fallback if height is undefined
              const spaceBelow = containerRect.height - endPosition.top - endHeight;

              let y, showAbove;
              if (spaceAbove >= POPUP_HEIGHT + 10) {
                // Show above selection
                y = startPosition.top - POPUP_HEIGHT - 10;
                showAbove = true;
              } else if (spaceBelow >= POPUP_HEIGHT + 10) {
                // Show below selection
                y = endPosition.top + endHeight + 10;
                showAbove = false;
              } else {
                // Not enough space - show at top of container
                y = 10;
                showAbove = true;
              }

              // Final validation of calculated positions
              if (isFinite(x) && isFinite(y) && x >= 0 && y >= 0) {
                setPopupPosition({ x, y, showAbove });
                setShowAIPopup(true);
              } else {
                setShowAIPopup(false);
              }
            } else {
              setShowAIPopup(false);
            }
          } else {
            setShowAIPopup(false);
          }
        } else {
          setShowAIPopup(false);
        }
      } catch (error) {
        // Catch-all for any unexpected errors in selection handling
        // Prevents app crash on mobile devices during rapid text operations
        console.debug('Selection handler error (expected during rapid edits):', error);
        setShowAIPopup(false);
      }
    });
  };

  const handleAIEdit = async () => {
    if (!aiPrompt.trim() || !selectedText) return;

    setIsLoading(true);
    try {
      const res = await api.post('/ai/edit-selection', {
        selection: selectedText,
        context_before: contextBefore.slice(-2000),
        context_after: contextAfter.slice(0, 2000),
        instruction: aiPrompt,
        file_type: language
      });

      setAiResponse(res.data.edited_content);
      setShowResponse(true);
    } catch (error) {
      toast.error('AI edit failed');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplace = () => {
    if (!editorRef.current || !selectionRange || !aiResponse) return;

    const editor = editorRef.current;
    editor.executeEdits('ai-edit', [{
      range: selectionRange,
      text: aiResponse
    }]);

    onChange(editor.getValue());
    closePopup();
    toast.success('Replaced with AI edit');
  };

  const handleInsertBelow = () => {
    if (!editorRef.current || !selectionRange || !aiResponse) return;

    const editor = editorRef.current;
    const model = editor.getModel();

    // Defensive check: model can be null during rapid updates
    if (!model) return;

    const insertPosition = {
      lineNumber: selectionRange.endLineNumber,
      column: model.getLineMaxColumn(selectionRange.endLineNumber)
    };

    editor.executeEdits('ai-edit', [{
      range: {
        startLineNumber: insertPosition.lineNumber,
        startColumn: insertPosition.column,
        endLineNumber: insertPosition.lineNumber,
        endColumn: insertPosition.column
      },
      text: '\n' + aiResponse
    }]);

    onChange(editor.getValue());
    closePopup();
    toast.success('Inserted below');
  };

  const closePopup = () => {
    setShowAIPopup(false);
    setAiPrompt('');
    setAiResponse('');
    setShowResponse(false);
    setSelectedText('');
  };

  return (
    <div ref={containerRef} className="h-full w-full bg-[#1e1e1e] relative overflow-hidden">
      <EditorErrorBoundary>
        <MonacoEditor
          height="100%"
          defaultLanguage={language}
          language={language}
          value={file.content || ''}
          theme="vs-dark"
          onChange={(value) => onChange(value || '')}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            padding: { top: 16 },
            fontFamily: 'JetBrains Mono, monospace',
            scrollBeyondLastLine: false,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            readOnly: readOnly
          }}
        />
      </EditorErrorBoundary>

      {/* AI Edit Popup - positioned relative to container */}
      {showAIPopup && (
        <div
          className="absolute z-50 transition-all duration-150"
          style={{
            left: popupPosition.x,
            top: popupPosition.y,
          }}
        >
          {!showResponse ? (
            <div className="bg-background/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl p-3 w-80">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Edit with AI</span>
                <button
                  onClick={closePopup}
                  className="ml-auto p-1 hover:bg-white/10 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="How should I modify this?"
                className="min-h-[50px] text-sm mb-2 bg-secondary/50 border-white/10 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAIEdit();
                  }
                  if (e.key === 'Escape') {
                    closePopup();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                {onAddToChat && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      console.log('[Editor] Add to Chat clicked', { text: selectedText, range: selectionRange });
                      onAddToChat({ text: selectedText, range: selectionRange });
                      closePopup();
                    }}
                    className="rounded-lg h-8 border-white/10 hover:bg-white/5"
                    title="Add selection to chat"
                  >
                    <MessageSquarePlus className="h-3 w-3 mr-1" />
                    Chat
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleAIEdit}
                  disabled={isLoading || !aiPrompt.trim()}
                  className="rounded-lg h-8"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-background/95 backdrop-blur-xl border border-primary/30 rounded-xl shadow-2xl p-3 w-96 max-h-80">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Suggestion</span>
                <button
                  onClick={closePopup}
                  className="ml-auto p-1 hover:bg-white/10 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2 mb-3 max-h-36 overflow-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">{aiResponse}</pre>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={closePopup}
                  className="rounded-lg flex-1 h-8"
                >
                  <X className="h-3 w-3 mr-1" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleInsertBelow}
                  className="rounded-lg flex-1 h-8"
                >
                  <ArrowDown className="h-3 w-3 mr-1" />
                  Below
                </Button>
                <Button
                  size="sm"
                  onClick={handleReplace}
                  className="rounded-lg flex-1 h-8"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Replace
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
