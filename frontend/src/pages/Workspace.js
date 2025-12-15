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
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [project, setProject] = useState(null);
  const [saving, setSaving] = useState(false);

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
      } else if (filesRes.data.length > 0 && !activeFile) {
         // Optional: Auto-select first file if none selected?
         // setActiveFile(filesRes.data[0]); 
      }
    } catch (error) {
      console.error("Failed to load workspace data", error);
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

  const handleDeleteFile = async (id) => {
      if(!window.confirm("Delete file?")) return;
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
    
    const updatedFile = { ...activeFile, content: newContent };
    setActiveFile(updatedFile);
    
    // Update in files list to keep sync
    setFiles(files.map(f => f.id === activeFile.id ? updatedFile : f));
    
    saveContent(activeFile.id, newContent);
  };

  const handleFileSelect = (file) => {
      setActiveFile(file);
      navigate(`/project/${projectId}/editor/${file.id}`);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-secondary/10 backdrop-blur-md">
        <div className="flex items-center gap-4">
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
          
          {/* File Browser (Restored) */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="border-r border-border bg-secondary/5">
            <FileBrowser 
              files={files} 
              activeFile={activeFile} 
              onSelect={handleFileSelect} 
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
                 Select a file from the explorer.
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
