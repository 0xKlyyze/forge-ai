import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardFooter, CardHeader } from '../../components/ui/card';
import { 
  FileText, Code, Image as ImageIcon, File, 
  MoreVertical, ExternalLink, Search, Plus, 
  LayoutGrid, List as ListIcon, Trash2, Eye 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function ProjectFiles() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState('Docs');

  // Preview State
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

  const handleCreateFile = async (e) => {
    e.preventDefault();
    let type = 'other';
    if (newFileCategory === 'Docs') type = 'doc';
    if (newFileCategory === 'Mockups') type = 'mockup';
    if (newFileCategory === 'Assets') type = 'asset';
    
    let name = newFileName;
    if (type === 'doc' && !name.endsWith('.md')) name += '.md';
    if (type === 'mockup' && !name.endsWith('.jsx')) name += '.jsx';

    try {
      const res = await api.post('/files', {
        project_id: projectId,
        name,
        type,
        category: newFileCategory,
        content: type === 'mockup' ? 'export default function Component() {\n  return <div>New Component</div>\n}' : '# New File'
      });
      setFiles([res.data, ...files]);
      setNewFileName('');
      setIsDialogOpen(false);
      toast.success("Artifact created");
    } catch (error) {
      toast.error("Creation failed");
    }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Permanently delete artifact?")) return;
      try {
          await api.delete(`/files/${id}`);
          setFiles(files.filter(f => f.id !== id));
          toast.success("Artifact deleted");
      } catch (error) {
          toast.error("Delete failed");
      }
  };

  const getIcon = (type) => {
      switch(type) {
          case 'doc': return <FileText className="h-8 w-8 text-blue-400" />;
          case 'mockup': return <Code className="h-8 w-8 text-yellow-400" />;
          case 'asset': return <ImageIcon className="h-8 w-8 text-purple-400" />;
          default: return <File className="h-8 w-8 text-gray-400" />;
      }
  };

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-10 h-full flex flex-col space-y-6 bg-background/50">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-mono font-bold tracking-tight">ARTIFACTS</h1>
           <p className="text-muted-foreground">Manage project resources and documentation.</p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-[300px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search artifacts..." 
                    className="pl-8 bg-secondary/20 border-white/10"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="flex items-center bg-secondary/20 rounded-md border border-white/10 p-1">
                <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => setViewMode('grid')}
                >
                    <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => setViewMode('list')}
                >
                    <ListIcon className="h-4 w-4" />
                </Button>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> New Artifact</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Artifact</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateFile} className="space-y-4 mt-4">
                        <Input placeholder="Filename..." value={newFileName} onChange={e => setNewFileName(e.target.value)} required />
                        <Select value={newFileCategory} onValueChange={setNewFileCategory}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Docs">Documentation</SelectItem>
                                <SelectItem value="Mockups">Component (Mockup)</SelectItem>
                                <SelectItem value="Assets">Asset</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button type="submit" className="w-full">Initialize</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
         {viewMode === 'grid' ? (
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                 {filteredFiles.map(file => (
                     <Card key={file.id} className="group bg-secondary/10 border-white/5 hover:border-primary/50 transition-all cursor-pointer overflow-hidden relative">
                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                     <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(file.id)}>
                                         <Trash2 className="mr-2 h-4 w-4" /> Delete
                                     </DropdownMenuItem>
                                 </DropdownMenuContent>
                             </DropdownMenu>
                         </div>
                         <CardContent className="flex flex-col items-center justify-center p-8 space-y-4" onClick={() => setPreviewFile(file)}>
                             {getIcon(file.type)}
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
                                 <p className="font-medium text-sm">{file.name}</p>
                                 <p className="text-xs text-muted-foreground">{file.category} • {formatDistanceToNow(new Date(file.last_edited))} ago</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button variant="ghost" size="sm" onClick={() => setPreviewFile(file)}>Quick Look</Button>
                             <Button variant="secondary" size="sm" onClick={() => navigate(`/project/${projectId}/editor/${file.id}`)}>Open Editor</Button>
                             <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(file.id)}><Trash2 className="h-4 w-4"/></Button>
                         </div>
                     </div>
                 ))}
             </div>
         )}
      </div>

      {/* Quick Look Modal */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
              <DialogHeader>
                  <DialogTitle className="font-mono">{previewFile?.name}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 bg-black/50 rounded-md border border-white/10 p-4 overflow-auto font-mono text-sm whitespace-pre-wrap">
                  {previewFile?.content || 'No content.'}
              </div>
              <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
                  <Button onClick={() => navigate(`/project/${projectId}/editor/${previewFile?.id}`)}>Open Full Editor</Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}
