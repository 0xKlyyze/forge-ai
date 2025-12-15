import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import FileBrowser from '../components/FileBrowser';
import Editor from '../components/Editor';
import Preview from '../components/Preview';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable';
import { Button } from '../components/ui/button';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';

export default function Workspace() {
  const { projectId, fileId } = useParams();
  const navigate = useNavigate();
  const [activeFile, setActiveFile] = useState(null);
  const [project, setProject] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProject();
    if (fileId) fetchFile();
  }, [projectId, fileId]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch (error) {
      toast.error("Failed to load project");
      navigate('/dashboard');
    }
  };

  const fetchFile = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/files`);
      const found = res.data.find(f => f.id === fileId);
      if (found) setActiveFile(found);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateFile = async (name, type, category) => {
    // Moved to ProjectFiles.js
  };

  const handleDeleteFile = async (fileId) => {
     // Moved to ProjectFiles.js
  };

  // Debounced save
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
    
    // Update local state immediately for UI responsiveness
    const updatedFile = { ...activeFile, content: newContent };
    setActiveFile(updatedFile);
    
    // Trigger server save
    saveContent(activeFile.id, newContent);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-secondary/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}/files`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-mono font-bold text-sm tracking-tight">{project?.name || 'Loading...'}</h1>
          <span className="text-muted-foreground text-xs px-2 py-0.5 rounded bg-secondary">
             {activeFile ? activeFile.name : 'No file selected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
           {saving && <span className="text-xs text-muted-foreground animate-pulse mr-2">Saving...</span>}
           <div className={`h-2 w-2 rounded-full ${saving ? 'bg-yellow-500' : 'bg-green-500'}`} />
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">

          {/* Editor Panel */}
          <ResizablePanel defaultSize={50}>
             {activeFile ? (
               <Editor 
                 file={activeFile} 
                 onChange={handleContentChange} 
               />
             ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                 Loading file...
               </div>
             )}
          </ResizablePanel>

          <ResizableHandle />

          {/* Preview Panel */}
          <ResizablePanel defaultSize={50} className="border-l border-border bg-black">
             {activeFile ? (
               <Preview file={activeFile} />
             ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                 Preview offline.
               </div>
             )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
