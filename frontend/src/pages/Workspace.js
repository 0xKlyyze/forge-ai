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
    fetchFiles();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch (error) {
      toast.error("Failed to load project");
      navigate('/dashboard');
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/files`);
      setFiles(res.data);
      if (res.data.length > 0 && !activeFile) {
        // Optional: auto-select first file or readme
        const readme = res.data.find(f => f.name.toLowerCase().includes('overview'));
        if (readme) setActiveFile(readme);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateFile = async (name, type, category) => {
    try {
      const res = await api.post('/files', {
        project_id: projectId,
        name,
        type,
        category,
        content: type === 'mockup' ? 'export default function Component() {\n  return <div>New Component</div>\n}' : '# New File'
      });
      setFiles([...files, res.data]);
      setActiveFile(res.data);
      toast.success("File created");
    } catch (error) {
      toast.error("Failed to create file");
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      await api.delete(`/files/${fileId}`);
      setFiles(files.filter(f => f.id !== fileId));
      if (activeFile && activeFile.id === fileId) setActiveFile(null);
      toast.success("File deleted");
    } catch (error) {
      toast.error("Failed to delete file");
    }
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
    
    // Update in files list to keep sync
    setFiles(files.map(f => f.id === activeFile.id ? updatedFile : f));
    
    // Trigger server save
    saveContent(activeFile.id, newContent);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-secondary/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
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
          {/* File Browser Panel */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="border-r border-border bg-secondary/5">
            <FileBrowser 
              files={files} 
              activeFile={activeFile} 
              onSelect={setActiveFile} 
              onCreate={handleCreateFile}
              onDelete={handleDeleteFile}
            />
          </ResizablePanel>
          
          <ResizableHandle />

          {/* Editor Panel */}
          <ResizablePanel defaultSize={40}>
             {activeFile ? (
               <Editor 
                 file={activeFile} 
                 onChange={handleContentChange} 
               />
             ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
                 Select a file to initiate editing sequence.
               </div>
             )}
          </ResizablePanel>

          <ResizableHandle />

          {/* Preview Panel */}
          <ResizablePanel defaultSize={40} className="border-l border-border bg-black">
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
