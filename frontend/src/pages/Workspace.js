import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import FileBrowser from '../components/FileBrowser';
import Editor from '../components/Editor';
import Preview from '../components/Preview';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import { Button } from '../components/ui/button';
import { Upload, FileText, FileCode, ArrowLeft, Eye, Code as CodeIcon, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { useProjectContext } from '../context/ProjectContext';
import { useCreateFile, useUpdateFile, useDeleteFile } from '../hooks/useProjectQueries';

// Hook to detect mobile viewport
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  return isMobile;
};

export default function Workspace() {
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState('files'); // 'files', 'editor', 'preview'

  const { projectId, fileId } = useParams();
  const navigate = useNavigate();

  // Get data from context (shared with other project pages)
  const { project: contextProject, files: contextFiles, isLoading, readOnly, baseUrl } = useProjectContext();

  // Mutation hooks
  const createFileMutation = useCreateFile(projectId);
  const updateFileMutation = useUpdateFile(projectId);
  const deleteFileMutation = useDeleteFile(projectId);

  // Local state for real-time editing (synced with context on mount)
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [project, setProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Update mobile view when activeFile changes
  useEffect(() => {
    if (isMobile && activeFile) {
      setMobileView('editor');
    }
  }, [activeFile, isMobile]);

  // Track if we've synced from context
  const hasSynced = useRef(false);

  // Key for storing last opened file per project
  const LAST_FILE_KEY = `forge-ai-last-file-${projectId}`;

  // Sync context data to local state on initial load
  useEffect(() => {
    if (isLoading || hasSynced.current) return;
    if (contextFiles && contextProject) {
      setFiles(contextFiles);
      setProject(contextProject);
      hasSynced.current = true;

      // Now restore the file session
      restoreFileSession(contextFiles);
    }
  }, [contextFiles, contextProject, isLoading]);

  // Reset sync flag when project changes
  useEffect(() => {
    hasSynced.current = false;
    setActiveFile(null);
  }, [projectId]);

  // Handle URL fileId changes
  useEffect(() => {
    if (fileId && files.length > 0) {
      const found = files.find(f => f.id === fileId);
      if (found && found.id !== activeFile?.id) {
        setActiveFile(found);
        localStorage.setItem(LAST_FILE_KEY, fileId);
      }
    }
  }, [fileId, files]);

  const restoreFileSession = (filesData) => {
    // Priority: URL fileId > URL query param > localStorage > nothing
    if (fileId) {
      const found = filesData.find(f => f.id === fileId);
      if (found) {
        setActiveFile(found);
        localStorage.setItem(LAST_FILE_KEY, fileId);
      }
    } else {
      // Check for ?file= query param
      const searchParams = new URLSearchParams(window.location.search);
      const fileName = searchParams.get('file');
      if (fileName) {
        const found = filesData.find(f => f.name === fileName);
        if (found) {
          setActiveFile(found);
          localStorage.setItem(LAST_FILE_KEY, found.id);
          navigate(`${baseUrl}/editor/${found.id}`, { replace: true });
        }
      } else {
        // Check localStorage for last opened file
        const lastFileId = localStorage.getItem(LAST_FILE_KEY);
        if (lastFileId) {
          const found = filesData.find(f => f.id === lastFileId);
          if (found) {
            setActiveFile(found);
            navigate(`${baseUrl}/editor/${found.id}`, { replace: true });
          }
        }
      }
    }
  };

  const handleCreateFile = async (name, type, category) => {
    try {
      let content = '';
      if (type === 'mockup') {
        content = `export default function Component() {\n  return (\n    <div className="p-8">\n      <h1 className="text-2xl font-bold">New Component</h1>\n    </div>\n  )\n}`;
      } else if (type === 'doc') {
        content = `# ${name.replace(/\.(md|txt)$/, '')}\n\nStart writing here...`;
      }

      const newFile = await createFileMutation.mutateAsync({ name, type, category, content });
      setFiles(prev => [...prev, newFile]);
      setActiveFile(newFile);
      localStorage.setItem(LAST_FILE_KEY, newFile.id);
      navigate(`${baseUrl}/editor/${newFile.id}`);
      toast.success("File created");
    } catch (error) {
      toast.error("Failed to create file");
    }
  };

  const handleDeleteFile = async (id) => {
    // Confirmation handled by FileBrowser component
    try {
      await deleteFileMutation.mutateAsync(id);
      const newFiles = files.filter(f => f.id !== id);
      setFiles(newFiles);
      if (activeFile && activeFile.id === id) {
        setActiveFile(null);
        localStorage.removeItem(LAST_FILE_KEY);
        navigate(`${baseUrl}/editor`);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  // Update file metadata (category, type, name)
  const handleUpdateFile = async (id, updates) => {
    try {
      await updateFileMutation.mutateAsync({ id, updates });
      setFiles(files.map(f => f.id === id ? { ...f, ...updates } : f));
      if (activeFile?.id === id) {
        setActiveFile(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleUpdateProject = async (updates) => {
    try {
      const res = await api.put(`/projects/${projectId}`, updates);
      setProject(res.data);
    } catch (error) {
      toast.error("Project update failed");
      throw error;
    }
  };

  // Debounced save for content changes
  const saveContent = useCallback(
    debounce(async (id, content) => {
      setSaving(true);
      try {
        await api.put(`/files/${id}`, { content });
        setSaving(false);
      } catch (error) {
        setSaving(false);
        toast.error("Auto-save failed");
      }
    }, 1000),
    []
  );

  const handleContentChange = (newContent) => {
    if (!activeFile || readOnly) return;

    const updatedFile = { ...activeFile, content: newContent };
    setActiveFile(updatedFile);
    setFiles(files.map(f => f.id === activeFile.id ? updatedFile : f));
    saveContent(activeFile.id, newContent);
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    // Save to localStorage for session persistence
    localStorage.setItem(LAST_FILE_KEY, file.id);
    navigate(`${baseUrl}/editor/${file.id}`);
  };

  // Handle dropped files (images, etc.)
  const handleDropFiles = async (droppedFiles) => {
    for (const file of droppedFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext);

      if (isImage) {
        // Convert to base64 for storage
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const newFile = await createFileMutation.mutateAsync({
              name: file.name,
              type: 'asset',
              category: 'Assets',
              content: e.target.result
            });
            setFiles(prev => [...prev, newFile]);
            toast.success(`Uploaded ${file.name}`);
          } catch (error) {
            toast.error(`Failed to upload ${file.name}`);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Read as text
        const reader = new FileReader();
        reader.onload = async (e) => {
          let type = 'other';
          let category = 'Other';

          if (['jsx', 'js', 'tsx', 'ts'].includes(ext)) {
            type = 'mockup';
            category = 'Mockups';
          } else if (['md', 'txt'].includes(ext)) {
            type = 'doc';
            category = 'Docs';
          }

          try {
            const newFile = await createFileMutation.mutateAsync({
              name: file.name,
              type,
              category,
              content: e.target.result
            });
            setFiles(prev => [...prev, newFile]);
            toast.success(`Added ${file.name}`);
          } catch (error) {
            toast.error(`Failed to add ${file.name}`);
          }
        };
        reader.readAsText(file);
      }
    }
  };

  // Global drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    if (readOnly) return;
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleDropFiles(droppedFiles);
    }
  }, [projectId]);

  if (isMobile) {
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden relative">
        {/* Mobile Header */}
        <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-black/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            {mobileView !== 'files' && (
              <Button variant="ghost" size="icon" onClick={() => setMobileView('files')} className="-ml-2 h-9 w-9" title="Toggle Sidebar">
                <PanelLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="min-w-0 flex flex-col">
              <span className="font-mono font-bold text-sm truncate">
                {mobileView === 'files' ? (project?.name || 'Files') : activeFile?.name}
              </span>
              {mobileView !== 'files' && activeFile && (
                <span className="text-[10px] text-muted-foreground truncate">{activeFile.category || 'File'}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle between Editor and Preview */}
            {mobileView === 'editor' && activeFile && (
              <Button size="sm" variant="ghost" onClick={() => setMobileView('preview')} className="h-8 px-2">
                <Eye className="h-4 w-4 mr-2" /> Preview
              </Button>
            )}
            {mobileView === 'preview' && (
              <Button size="sm" variant="ghost" onClick={() => setMobileView('editor')} className="h-8 px-2">
                <CodeIcon className="h-4 w-4 mr-2" /> Editor
              </Button>
            )}
            {/* Save Indicator */}
            <div className={`h-2 w-2 rounded-full ${saving ? 'bg-yellow-500' : 'bg-green-500'}`} />
          </div>
        </header>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden relative">
          {mobileView === 'files' && (
            <FileBrowser
              files={files}
              activeFile={activeFile}
              project={project}
              onSelect={(file) => {
                handleFileSelect(file);
                setMobileView('editor');
              }}
              onCreate={handleCreateFile}
              onDelete={handleDeleteFile}
              onUpdateFile={handleUpdateFile}
              onUpdateProject={handleUpdateProject}
              onDropFiles={handleDropFiles}
              readOnly={readOnly}
            />
          )}
          {mobileView === 'editor' && activeFile && (
            <Editor
              file={activeFile}
              onChange={handleContentChange}
              readOnly={readOnly}
            />
          )}
          {mobileView === 'preview' && activeFile && (
            <Preview file={activeFile} projectId={projectId} />
          )}
          {!activeFile && mobileView !== 'files' && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>No file selected</p>
              <Button variant="link" onClick={() => setMobileView('files')}>Go to Files</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full flex flex-col bg-background overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Global Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
          <div className="bg-background/90 border border-primary/50 rounded-2xl p-8 text-center">
            <Upload className="h-12 w-12 mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-muted-foreground mt-1">Images, code files, or documents</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-black/50 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-mono font-bold text-sm">{project?.name || 'Loading...'}</h1>
          {activeFile && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-primary text-sm font-medium">{activeFile.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Format Toggle - only for doc files */}
          {activeFile?.type === 'doc' && !readOnly && (
            <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 border border-white/5 transition-all duration-200" title="Switch document format">
              <button
                onClick={async () => {
                  if (!activeFile.name.endsWith('.md')) {
                    const newName = activeFile.name.replace(/\.[^.]+$/, '.md');
                    await handleUpdateFile(activeFile.id, { name: newName });
                    toast.success('Converted to Markdown');
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${activeFile.name.endsWith('.md')
                  ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 hover:scale-[1.02]'
                  }`}
              >
                <FileText className="h-3 w-3 transition-transform duration-200" />
                <span>Markdown</span>
              </button>
              <button
                onClick={async () => {
                  if (!activeFile.name.endsWith('.xml')) {
                    const newName = activeFile.name.replace(/\.[^.]+$/, '.xml');
                    await handleUpdateFile(activeFile.id, { name: newName });
                    toast.success('Converted to XML');
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${activeFile.name.endsWith('.xml')
                  ? 'bg-amber-500/90 text-white shadow-md scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5 hover:scale-[1.02]'
                  }`}
              >
                <FileCode className="h-3 w-3 transition-transform duration-200" />
                <span>XML</span>
              </button>
            </div>
          )}

          {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
          <div className={`h-2 w-2 rounded-full ${saving ? 'bg-yellow-500' : 'bg-green-500'}`} />
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup
          direction="horizontal"
          autoSaveId={`forge-ai-workspace-layout-${projectId}`}
        >

          {/* File Browser */}
          <ResizablePanel defaultSize={18} minSize={15} maxSize={30} className="border-r border-white/5 bg-black/30">
            <FileBrowser
              files={files}
              activeFile={activeFile}
              project={project}
              onSelect={handleFileSelect}
              onCreate={handleCreateFile}
              onDelete={handleDeleteFile}
              onUpdateFile={handleUpdateFile}
              onUpdateProject={handleUpdateProject}
              onDropFiles={handleDropFiles}
              readOnly={readOnly}
            />
          </ResizablePanel>

          <ResizableHandle className="bg-white/5 hover:bg-primary/50 transition-colors w-1" />

          {/* Editor Panel */}
          <ResizablePanel defaultSize={41}>
            {activeFile ? (
              <Editor
                file={activeFile}
                onChange={handleContentChange}
                readOnly={readOnly}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm bg-[#0a0a0a]">
                Select a file from the explorer
              </div>
            )}
          </ResizablePanel>

          <ResizableHandle className="bg-white/5 hover:bg-primary/50 transition-colors w-1" />

          {/* Preview Panel */}
          <ResizablePanel defaultSize={41} className="border-l border-white/5">
            {activeFile ? (
              <Preview file={activeFile} projectId={projectId} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm bg-[#0a0a0a]">
                Preview offline
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
