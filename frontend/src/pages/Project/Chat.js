import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Sparkles, Send, Globe, FileText, Bot, User, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function ProjectChat() {
  const { projectId } = useParams();
  const [messages, setMessages] = useState([
      { role: 'model', content: "I'm Forge AI. I can help you with architecture, code, or planning. Type '@' to reference specific files." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  
  // Settings
  const [isFullContext, setIsFullContext] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  
  // Reference Logic
  const [referencedFiles, setReferencedFiles] = useState([]); // List of file objects
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages]);

  const fetchFiles = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/files`);
      setFiles(res.data);
    } catch (error) { console.error(error); }
  };

  const handleSend = async (e) => {
      e.preventDefault();
      if (!input.trim() || loading) return;

      const userMsg = { role: 'user', content: input };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      setReferencedFiles([]); // Clear after send? Or keep? Usually clear for next turn.

      try {
          const res = await api.post('/chat', {
              project_id: projectId,
              message: userMsg.content,
              history: messages,
              context_mode: isFullContext ? 'all' : 'selective',
              referenced_files: referencedFiles.map(f => f.id),
              web_search: isWebSearch
          });
          
          setMessages(prev => [...prev, { role: 'model', content: res.data.text }]);
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
          // Extract search term after last @
          const match = val.match(/@([\w\s\.-]*)$/);
          if (match) {
              setFileSearch(match[1]);
          } else {
              setShowFilePicker(false);
          }
      }
  };

  const selectFile = (file) => {
      // Replace @search with @Filename
      const newVal = input.replace(/@[\w\s\.-]*$/, `@${file.name} `);
      setInput(newVal);
      setReferencedFiles(prev => [...prev, file]);
      setShowFilePicker(false);
      inputRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col bg-background/50 relative">
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
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
                        : 'bg-secondary/40 border border-white/5 rounded-tl-sm backdrop-blur-md'
                      }
                  `}>
                      <ReactMarkdown 
                        components={{
                            code: ({node, inline, className, children, ...props}) => {
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
          <div className="h-24" /> {/* Spacer */}
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
  );
}
