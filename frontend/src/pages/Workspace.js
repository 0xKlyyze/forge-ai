import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import FileBrowser from '../components/FileBrowser';
import Editor from '../components/Editor';
import Preview from '../components/Preview';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';

export default function Workspace() {
  const { projectId, fileId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [project, setProject] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchData();
  }, [projectId, fileId]);

  const fetchData = async () => {
    try {
      const [projRes, filesRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/files`)
      ]);
      setProject(projRes.data);
      setFiles(filesRes.data);

      if (fileId) {
        const found = filesRes.data.find(f => f.id === fileId);
        if (found) setActiveFile(found);
      }
    } catch (error) {
      console.error("Failed to load workspace data", error);
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

      const res = await api.post('/files', {
        project_id: projectId,
        name,
        type,
        category,
        content
      });
      setFiles([...files, res.data]);
      setActiveFile(res.data);
      toast.success("File created");
    } catch (error) {
      toast.error("Failed to create file");
    }
  };

  const handleDeleteFile = async (id) => {
    // Confirmation handled by FileBrowser component
    try {
      await api.delete(`/files/${id}`);
      const newFiles = files.filter(f => f.id !== id);
      setFiles(newFiles);
      if (activeFile && activeFile.id === id) {
        setActiveFile(null);
        navigate(`/project/${projectId}/editor`);
      }
      toast.success("File deleted");
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  // Update file metadata (category, type, name)
  const handleUpdateFile = async (id, updates) => {
    try {
      await api.put(`/files/${id}`, updates);
      setFiles(files.map(f => f.id === id ? { ...f, ...updates } : f));
      if (activeFile?.id === id) {
        setActiveFile(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      toast.error("Update failed");
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
    if (!activeFile) return;

    const updatedFile = { ...activeFile, content: newContent };
    setActiveFile(updatedFile);
    setFiles(files.map(f => f.id === activeFile.id ? updatedFile : f));
    saveContent(activeFile.id, newContent);
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    navigate(`/project/${projectId}/editor/${file.id}`);
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
            const res = await api.post('/files', {
              project_id: projectId,
              name: file.name,
              type: 'asset',
              category: 'Assets',
              content: e.target.result
            });
            setFiles(prev => [...prev, res.data]);
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
            const res = await api.post('/files', {
              project_id: projectId,
              name: file.name,
              type,
              category,
              content: e.target.result
            });
            setFiles(prev => [...prev, res.data]);
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
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleDropFiles(droppedFiles);
    }
  }, [projectId]);

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
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>}
          <div className={`h-2 w-2 rounded-full ${saving ? 'bg-yellow-500' : 'bg-green-500'}`} />
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">

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
            />
          </ResizablePanel>

          <ResizableHandle className="bg-white/5 hover:bg-primary/50 transition-colors w-1" />

          {/* Editor Panel */}
          <ResizablePanel defaultSize={41}>
            {activeFile ? (
              <Editor
                file={activeFile}
                onChange={handleContentChange}
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
              <Preview file={activeFile} />
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
