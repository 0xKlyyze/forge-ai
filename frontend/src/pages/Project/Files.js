import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardFooter } from '../../components/ui/card';
import { 
  FileText, Code, Image as ImageIcon, File, 
  MoreVertical, ExternalLink, Search, Plus, 
  LayoutGrid, List as ListIcon, Trash2, Eye, Upload, Download,
  Pin
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function ProjectFiles() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState('All');
  
  // Creation State
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState('Docs');
  const [uploadFile, setUploadFile] = useState(null);
  
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/files`);
      setFiles(res.data);
    } catch (error) {
      toast.error("Failed to load files");
    }
  };

  const handleTogglePin = async (file) => {
      try {
          const updated = { ...file, pinned: !file.pinned };
          await api.put(`/files/${file.id}`, { pinned: updated.pinned });
          setFiles(files.map(f => f.id === file.id ? updated : f));
          toast.success(updated.pinned ? "Artifact pinned" : "Artifact unpinned");
      } catch (error) {
          toast.error("Failed to update pin");
      }
  };

  // ... (Create/Delete logic same as before, simplified for brevity here, but I must preserve it)
  const handleCreateFile = async (e) => {
    e.preventDefault();
    let type = 'other';
    if (newFileCategory === 'Docs') type = 'doc';
    if (newFileCategory === 'Mockups') type = 'mockup';
    if (newFileCategory === 'Assets') type = 'asset';
    
    let name = newFileName;
    if (!uploadFile) {
        if (type === 'doc' && !name.endsWith('.md')) name += '.md';
        if (type === 'mockup' && !name.endsWith('.jsx')) name += '.jsx';
    }

    let content = '# New File';
    if (type === 'mockup') content = 'export default function Component() {\n  return <div>New Component</div>\n}';

    if (uploadFile) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            await submitFile(name, type, newFileCategory, e.target.result);
        };
        const isText = uploadFile.type.startsWith('text/') || uploadFile.name.match(/\.(js|jsx|ts|tsx|md|json|css|html)$/);
        if (isText) reader.readAsText(uploadFile);
        else reader.readAsDataURL(uploadFile);
    } else {
        await submitFile(name, type, newFileCategory, content);
    }
  };

  const submitFile = async (name, type, category, content) => {
      try {
        const res = await api.post('/files', { project_id: projectId, name, type, category, content });
        setFiles([res.data, ...files]);
        setNewFileName('');
        setUploadFile(null);
        setIsDialogOpen(false);
        toast.success("Artifact created");
      } catch (error) { toast.error("Creation failed"); }
  }

  const handleDelete = async (id) => {
      if(!window.confirm("Permanently delete artifact?")) return;
      try {
          await api.delete(`/files/${id}`);
          setFiles(files.filter(f => f.id !== id));
          toast.success("Deleted");
      } catch (error) { toast.error("Failed"); }
  };

  const handleDownload = (file) => {
      let blob;
      if (file.content.startsWith('data:')) {
          const arr = file.content.split(',');
          const mime = arr[0].match(/:(.*?);/)[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while(n--){ u8arr[n] = bstr.charCodeAt(n); }
          blob = new Blob([u8arr], {type:mime});
      } else {
          blob = new Blob([file.content], { type: 'text/plain' });
      }
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
  };

  const getIcon = (type) => {
      switch(type) {
          case 'doc': return <FileText className="h-8 w-8 text-blue-400" />;
          case 'mockup': return <Code className="h-8 w-8 text-yellow-400" />;
          case 'asset': return <ImageIcon className="h-8 w-8 text-purple-400" />;
          default: return <File className="h-8 w-8 text-gray-400" />;
      }
  };

  const sortedFiles = [...files].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.last_edited) - new Date(a.last_edited);
  });

  const filteredFiles = sortedFiles
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .filter(f => filterType === 'All' || f.category === filterType);

  return (
    <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col p-6 lg:p-10 space-y-6 overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-mono font-bold tracking-tight">ARTIFACTS</h1>
                    <p className="text-muted-foreground">Manage project resources.</p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Types</SelectItem>
                            <SelectItem value="Docs">Docs</SelectItem>
                            <SelectItem value="Mockups">Mockups</SelectItem>
                            <SelectItem value="Assets">Assets</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1 md:w-[250px]">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." className="pl-8 bg-secondary/20 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    
                    <div className="flex items-center bg-secondary/20 rounded-md border border-white/10 p-1">
                        <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}><LayoutGrid className="h-4 w-4" /></Button>
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}><ListIcon className="h-4 w-4" /></Button>
                    </div>
                    
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New</Button></DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Create Artifact</DialogTitle></DialogHeader>
                            <Tabs defaultValue="blank" className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="blank">Create Blank</TabsTrigger>
                                    <TabsTrigger value="upload">Upload File</TabsTrigger>
                                </TabsList>
                                <form onSubmit={handleCreateFile} className="mt-4 space-y-4">
                                    <TabsContent value="blank" className="space-y-4">
                                        <Input placeholder="Filename (e.g. Note.md)" value={newFileName} onChange={e => setNewFileName(e.target.value)} />
                                    </TabsContent>
                                    <TabsContent value="upload" className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <Input type="file" onChange={(e) => { const file = e.target.files[0]; if(file) { setUploadFile(file); setNewFileName(file.name); } }} />
                                            <p className="text-xs text-muted-foreground">Supports images, code, and text files.</p>
                                        </div>
                                    </TabsContent>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Category</label>
                                        <Select value={newFileCategory} onValueChange={setNewFileCategory}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Docs">Documentation</SelectItem>
                                                <SelectItem value="Mockups">Component</SelectItem>
                                                <SelectItem value="Assets">Asset</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="submit" className="w-full">Initialize Artifact</Button>
                                </form>
                            </Tabs>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Grid/List View */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredFiles.map(file => (
                            <Card key={file.id} className={`group bg-secondary/10 border-white/5 hover:border-primary/50 transition-all cursor-pointer overflow-hidden relative ${file.pinned ? 'border-l-4 border-l-accent' : ''}`}>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                                    <Button variant="secondary" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleTogglePin(file); }}>
                                        <Pin className={`h-3 w-3 ${file.pinned ? 'fill-current text-accent' : ''}`} />
                                    </Button>
                                    <Button variant="secondary" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                        <Download className="h-3 w-3" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreVertical className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => navigate(`/project/${projectId}/editor/${file.id}`)}>
                                                <ExternalLink className="mr-2 h-4 w-4" /> Open in Editor
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                                                <Eye className="mr-2 h-4 w-4" /> Quick Look
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleTogglePin(file)}>
                                                <Pin className="mr-2 h-4 w-4" /> {file.pinned ? 'Unpin' : 'Pin'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(file.id)}>
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <CardContent className="flex flex-col items-center justify-center p-8 space-y-4" onClick={() => setPreviewFile(file)}>
                                    {file.pinned && <div className="absolute top-2 left-2 text-accent"><Pin className="h-3 w-3 fill-current" /></div>}
                                    {file.type === 'asset' && file.content.startsWith('data:image') ? (
                                        <img src={file.content} alt={file.name} className="h-16 w-16 object-cover rounded-md" />
                                    ) : ( getIcon(file.type) )}
                                    <div className="text-center">
                                        <p className="font-medium text-sm truncate w-[120px]">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{file.category}</p>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-black/20 p-2 text-[10px] text-muted-foreground justify-center font-mono">
                                    {formatDistanceToNow(new Date(file.last_edited))} ago
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredFiles.map(file => (
                            <div key={file.id} className="flex items-center justify-between p-3 rounded bg-secondary/10 border border-white/5 hover:bg-secondary/20 transition-colors group">
                                <div className="flex items-center gap-4">
                                    {getIcon(file.type)}
                                    <div>
                                        <p className="font-medium text-sm flex items-center gap-2">
                                            {file.name} 
                                            {file.pinned && <Pin className="h-3 w-3 text-accent fill-current" />}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{file.category} • {formatDistanceToNow(new Date(file.last_edited))} ago</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" onClick={() => handleTogglePin(file)}><Pin className={`h-4 w-4 ${file.pinned ? 'fill-current text-accent' : ''}`} /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDownload(file)}><Download className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="sm" onClick={() => setPreviewFile(file)}>Quick Look</Button>
                                    <Button variant="secondary" size="sm" onClick={() => navigate(`/project/${projectId}/editor/${file.id}`)}>Open Editor</Button>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(file.id)}><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
                <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle className="font-mono">{previewFile?.name}</DialogTitle></DialogHeader>
                    <div className="flex-1 bg-black/50 rounded-md border border-white/10 p-4 overflow-auto font-mono text-sm whitespace-pre-wrap flex items-center justify-center">
                        {previewFile?.type === 'asset' && previewFile.content.startsWith('data:image') ? (
                             <img src={previewFile.content} alt={previewFile.name} className="max-w-full max-h-full" />
                        ) : (
                             <div className="w-full h-full text-left">{previewFile?.content || 'No content.'}</div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
                        <Button variant="secondary" onClick={() => handleDownload(previewFile)}>Download</Button>
                        <Button onClick={() => { setPreviewFile(null); navigate(`/project/${projectId}/editor/${previewFile.id}`); }}>Open Full Editor</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    </div>
  );
}
