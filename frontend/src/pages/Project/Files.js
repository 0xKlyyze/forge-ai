import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { ScrollArea } from '../../components/ui/scroll-area';
import {
    FileText, Code, Image as ImageIcon, File, FileCode,
    MoreVertical, ExternalLink, Search, Plus,
    LayoutGrid, List as ListIcon, Trash2, Eye, Upload, Download,
    Pin, FolderOpen, X, Check, Tag, Hash, Bot
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../../components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useProjectContext } from '../../context/ProjectContext';
import { useCreateFile, useUpdateFile, useDeleteFile } from '../../hooks/useProjectQueries';
import { FilesSkeleton } from '../../components/skeletons/PageSkeletons';
import { XmlPreviewCompact } from '../../components/XmlViewer';

// Helper to check if a file is XML
const isXmlFile = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    return ['xml', 'svg', 'xsl', 'xslt', 'xsd', 'plist', 'config'].includes(ext);
};

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

export default function ProjectFiles() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    // Use shared context data
    const { project, files, isLoadingFiles, readOnly, baseUrl } = useProjectContext();

    // Mutation hooks
    const createFileMutation = useCreateFile(projectId);
    const updateFileMutation = useUpdateFile(projectId);
    const deleteFileMutation = useDeleteFile(projectId);

    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [filterType, setFilterType] = useState('All');
    const [filterTag, setFilterTag] = useState('All');
    const [showChatFiles, setShowChatFiles] = useState(false); // Hide ai-chat files by default

    // Creation State
    const [newFileName, setNewFileName] = useState('');
    const [newFileCategory, setNewFileCategory] = useState('Docs');
    const [uploadFile, setUploadFile] = useState(null);

    const [previewFile, setPreviewFile] = useState(null);

    // Drag and drop
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    // Show skeleton while loading
    if (isLoadingFiles) {
        return <FilesSkeleton />;
    }

    // Drag and drop handlers
    const handleDragEnter = useCallback((e) => {
        if (readOnly) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounter.current = 0;

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) return;

        for (const file of droppedFiles) {
            await uploadFileFromDrop(file);
        }
    }, [projectId]);

    const uploadFileFromDrop = async (file) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            let type = 'other';
            let category = 'Docs';

            if (file.type.startsWith('image/')) {
                type = 'asset';
                category = 'Assets';
            } else if (file.name.match(/\.(jsx?|tsx?)$/)) {
                type = 'mockup';
                category = 'Mockups';
            } else if (file.name.match(/\.(md|txt|json|css|html|xml|svg|xsl|xslt|xsd|plist|config)$/)) {
                type = 'doc';
                category = 'Docs';
            }

            try {
                await createFileMutation.mutateAsync({
                    name: file.name,
                    type,
                    category,
                    content: e.target.result
                });
                toast.success(`Uploaded: ${file.name}`);
            } catch (error) {
                toast.error(`Failed to upload: ${file.name}`);
            }
        };

        const isText = file.type.startsWith('text/') || file.name.match(/\.(js|jsx|ts|tsx|md|json|css|html|xml|svg|xsl|xslt|xsd|plist|config)$/);
        if (isText) reader.readAsText(file);
        else reader.readAsDataURL(file);
    };

    const handleTogglePin = async (file) => {
        try {
            await updateFileMutation.mutateAsync({ id: file.id, updates: { pinned: !file.pinned } });
            toast.success(!file.pinned ? "Pinned" : "Unpinned");
        } catch (error) {
            toast.error("Failed to update pin");
        }
    };

    const handleUpdateTags = async (file, newTags) => {
        try {
            await updateFileMutation.mutateAsync({ id: file.id, updates: { tags: newTags } });
        } catch (error) {
            toast.error("Failed to update tags");
        }
    };

    const handleRename = async (file, newName) => {
        if (!newName.trim() || newName === file.name) return;
        try {
            await updateFileMutation.mutateAsync({ id: file.id, updates: { name: newName } });
            toast.success("Renamed");
        } catch (error) {
            toast.error("Rename failed");
        }
    };

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
            const isText = uploadFile.type.startsWith('text/') || uploadFile.name.match(/\.(js|jsx|ts|tsx|md|json|css|html|xml|svg|xsl|xslt|xsd|plist|config)$/);
            if (isText) reader.readAsText(uploadFile);
            else reader.readAsDataURL(uploadFile);
        } else {
            await submitFile(name, type, newFileCategory, content);
        }
    };

    const submitFile = async (name, type, category, content) => {
        try {
            await createFileMutation.mutateAsync({ name, type, category, content });
            setNewFileName('');
            setUploadFile(null);
            setIsDialogOpen(false);
            toast.success("Created");
        } catch (error) { toast.error("Creation failed"); }
    };

    const handleDelete = async (id) => {
        try {
            await deleteFileMutation.mutateAsync(id);
        } catch (error) { /* handled by mutation */ }
    };

    const handleDownload = (file) => {
        let blob;
        if (file.content.startsWith('data:')) {
            const arr = file.content.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) { u8arr[n] = bstr.charCodeAt(n); }
            blob = new Blob([u8arr], { type: mime });
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

    const getIcon = (type, fileName) => {
        const iconClasses = "h-8 w-8";
        // Check for XML files
        if (isXmlFile(fileName)) {
            return <FileCode className={`${iconClasses} text-amber-400`} />;
        }
        switch (type) {
            case 'doc': return <FileText className={`${iconClasses} text-primary`} />;
            case 'mockup': return <Code className={`${iconClasses} text-accent`} />;
            case 'asset': return <ImageIcon className={`${iconClasses} text-purple-400`} />;
            default: return <File className={`${iconClasses} text-muted-foreground`} />;
        }
    };

    const sortedFiles = [...files].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.last_edited) - new Date(a.last_edited);
    });

    // Get all unique tags from files (excluding 'ai-chat' from user visible tags)
    const allTags = [...new Set(files.flatMap(f => f.tags || []))].filter(t => t !== 'ai-chat');

    // Count of ai-chat files
    const chatFilesCount = files.filter(f => (f.tags || []).includes('ai-chat')).length;

    const filteredFiles = sortedFiles
        .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
        .filter(f => filterType === 'All' || f.category === filterType)
        .filter(f => filterTag === 'All' || (f.tags || []).includes(filterTag))
        .filter(f => showChatFiles || !(f.tags || []).includes('ai-chat')); // Hide ai-chat files unless toggle is on

    return (
        <div
            className="h-full flex flex-col relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && !readOnly && (
                <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-2xl m-4 flex items-center justify-center">
                    <div className="text-center">
                        <Upload className="h-16 w-16 mx-auto text-primary mb-4 animate-bounce" />
                        <p className="text-xl font-semibold text-primary">Drop files to upload</p>
                        <p className="text-sm text-muted-foreground mt-1">Images, documents, code files</p>
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-hidden">
                {/* Header */}
                <div className={`flex-shrink-0 border-b border-white/5 ${isMobile ? 'pb-4' : 'pb-6'}`}>
                    {isMobile ? (
                        <div className="flex flex-col gap-3">
                            {/* Mobile Top Row: Title + Actions */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-xl font-bold tracking-tight">Files</h1>
                                    <p className="text-xs text-muted-foreground">
                                        <span className="text-primary">{files.length}</span> items
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {chatFilesCount > 0 && (
                                        <button
                                            onClick={() => setShowChatFiles(!showChatFiles)}
                                            className={`h-8 w-8 rounded-full flex items-center justify-center transition-all border ${showChatFiles
                                                ? 'bg-accent/20 border-accent/40 text-accent'
                                                : 'bg-secondary/30 border-white/10 text-muted-foreground'
                                                }`}
                                        >
                                            <Bot className="h-4 w-4" />
                                        </button>
                                    )}
                                    {!readOnly && (
                                        <Button size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsDialogOpen(true)}>
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search files..."
                                    className="pl-9 h-10 w-full bg-secondary/30 border-white/10 rounded-xl"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>

                            {/* Mobile Filters Scroll */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger className="w-[110px] h-9 rounded-xl bg-secondary/30 border-white/10 flex-shrink-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Types</SelectItem>
                                        <SelectItem value="Docs">Docs</SelectItem>
                                        <SelectItem value="Mockups">Mockups</SelectItem>
                                        <SelectItem value="Assets">Assets</SelectItem>
                                        {(project?.custom_categories || []).map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {allTags.length > 0 && (
                                    <Select value={filterTag} onValueChange={setFilterTag}>
                                        <SelectTrigger className="w-[110px] h-9 rounded-xl bg-secondary/30 border-white/10 flex-shrink-0">
                                            <Tag className="h-3 w-3 mr-1" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Tags</SelectItem>
                                            {allTags.map(tag => (
                                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                <div className="flex items-center bg-secondary/30 rounded-xl p-1 flex-shrink-0 ml-auto">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                                    >
                                        <ListIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Files</h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    <span className="text-primary">{files.length}</span> artifacts · <span className="text-accent">{files.filter(f => f.pinned).length}</span> pinned
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger className="w-[110px] h-9 rounded-xl bg-secondary/30 border-white/10">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All</SelectItem>
                                        <SelectItem value="Docs">Docs</SelectItem>
                                        <SelectItem value="Mockups">Mockups</SelectItem>
                                        <SelectItem value="Assets">Assets</SelectItem>
                                        {(project?.custom_categories || []).map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {/* Tag filter */}
                                {allTags.length > 0 && (
                                    <Select value={filterTag} onValueChange={setFilterTag}>
                                        <SelectTrigger className="w-[110px] h-9 rounded-xl bg-secondary/30 border-white/10">
                                            <Tag className="h-3 w-3 mr-1" />
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="All">All Tags</SelectItem>
                                            {allTags.map(tag => (
                                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search..."
                                        className="pl-9 h-9 w-[180px] bg-secondary/30 border-white/10 rounded-xl"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>

                                {/* View Toggle */}
                                <div className="flex items-center bg-secondary/30 rounded-xl p-1">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        <ListIcon className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Show Chat Files Toggle */}
                                {chatFilesCount > 0 && (
                                    <button
                                        onClick={() => setShowChatFiles(!showChatFiles)}
                                        className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all border ${showChatFiles
                                            ? 'bg-accent/20 border-accent/40 text-accent'
                                            : 'bg-secondary/30 border-white/10 text-muted-foreground hover:text-foreground'
                                            }`}
                                        title={showChatFiles ? 'Hide AI chat files' : 'Show AI chat files'}
                                    >
                                        <Bot className="h-3.5 w-3.5" />
                                        <span>{chatFilesCount} chat</span>
                                    </button>
                                )}

                                {!readOnly && (
                                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="h-9 rounded-xl">
                                                <Plus className="mr-2 h-4 w-4" /> New
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="rounded-2xl">
                                            <DialogHeader><DialogTitle>Create File</DialogTitle></DialogHeader>
                                            <Tabs defaultValue="blank" className="w-full">
                                                <TabsList className="grid w-full grid-cols-2 rounded-xl">
                                                    <TabsTrigger value="blank" className="rounded-lg">Create Blank</TabsTrigger>
                                                    <TabsTrigger value="upload" className="rounded-lg">Upload</TabsTrigger>
                                                </TabsList>
                                                <form onSubmit={handleCreateFile} className="mt-4 space-y-4">
                                                    <TabsContent value="blank" className="space-y-4">
                                                        <Input
                                                            placeholder="filename.md"
                                                            value={newFileName}
                                                            onChange={e => setNewFileName(e.target.value)}
                                                            className="rounded-xl"
                                                        />
                                                    </TabsContent>
                                                    <TabsContent value="upload" className="space-y-4">
                                                        <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-primary/30 transition-colors">
                                                            <Input
                                                                type="file"
                                                                className="hidden"
                                                                id="file-upload"
                                                                onChange={(e) => {
                                                                    const file = e.target.files[0];
                                                                    if (file) { setUploadFile(file); setNewFileName(file.name); }
                                                                }}
                                                            />
                                                            <label htmlFor="file-upload" className="cursor-pointer">
                                                                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                                                <p className="text-sm text-muted-foreground">
                                                                    {uploadFile ? uploadFile.name : 'Click to select file'}
                                                                </p>
                                                            </label>
                                                        </div>
                                                    </TabsContent>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Category</label>
                                                        <Select value={newFileCategory} onValueChange={setNewFileCategory}>
                                                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Docs">Document</SelectItem>
                                                                <SelectItem value="Mockups">Component</SelectItem>
                                                                <SelectItem value="Assets">Asset</SelectItem>
                                                                {(project?.custom_categories || []).map(cat => (
                                                                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button type="submit" className="w-full rounded-xl">Create</Button>
                                                </form>
                                            </Tabs>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <ScrollArea className={`flex-1 ${isMobile ? 'pt-4' : 'pt-6'}`}>
                    <div key={viewMode} className="animate-in fade-in duration-200 pb-32">
                        {filteredFiles.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="h-20 w-20 rounded-3xl bg-secondary/30 flex items-center justify-center mb-4">
                                    <FolderOpen className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-1">No files yet</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {search ? 'No files match your search' : 'Create a file or drag and drop to upload'}
                                </p>
                                {!search && !readOnly && (
                                    <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl">
                                        <Plus className="h-4 w-4 mr-2" /> Create File
                                    </Button>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                {filteredFiles.map(file => (
                                    <FileCard
                                        key={file.id}
                                        file={file}
                                        isMobile={isMobile}
                                        onOpen={() => navigate(`${baseUrl}/editor/${file.id}`)}
                                        onPreview={() => setPreviewFile(file)}
                                        onPin={() => handleTogglePin(file)}
                                        onDownload={() => handleDownload(file)}
                                        onDelete={() => handleDelete(file.id)}
                                        onRename={(name) => handleRename(file, name)}
                                        onUpdateTags={(tags) => handleUpdateTags(file, tags)}
                                        getIcon={getIcon}
                                        readOnly={readOnly}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredFiles.map(file => (
                                    <FileListItem
                                        key={file.id}
                                        file={file}
                                        isMobile={isMobile}
                                        onOpen={() => navigate(`${baseUrl}/editor/${file.id}`)}
                                        onPreview={() => setPreviewFile(file)}
                                        onPin={() => handleTogglePin(file)}
                                        onDownload={() => handleDownload(file)}
                                        onDelete={() => handleDelete(file.id)}
                                        onRename={(name) => handleRename(file, name)}
                                        onUpdateTags={(tags) => handleUpdateTags(file, tags)}
                                        getIcon={getIcon}
                                        readOnly={readOnly}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Preview Modal */}
                <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
                    <DialogContent className={`${isMobile ? 'w-full h-full max-w-none rounded-none border-0 p-0 flex flex-col' : 'max-w-3xl h-[80vh] flex flex-col rounded-2xl'}`}>
                        <DialogHeader className={isMobile ? 'p-4 border-b border-white/10 bg-black/40' : ''}>
                            <DialogTitle className="font-mono">{previewFile?.name}</DialogTitle>
                        </DialogHeader>
                        <div className={`flex-1 overflow-hidden flex items-center justify-center ${isMobile ? 'bg-black' : 'bg-black/50 rounded-xl border border-white/10'}`}>
                            {previewFile?.type === 'asset' && previewFile.content.startsWith('data:image') ? (
                                <img src={previewFile.content} alt={previewFile.name} className="max-w-full max-h-full rounded-lg object-contain" />
                            ) : isXmlFile(previewFile?.name) ? (
                                <XmlPreviewCompact content={previewFile?.content || ''} fileName={previewFile?.name} />
                            ) : (
                                <pre className="w-full h-full p-4 text-left font-mono text-sm whitespace-pre-wrap overflow-auto">
                                    {previewFile?.content || 'No content.'}
                                </pre>
                            )}
                        </div>
                        <div className={`flex justify-end gap-2 flex-wrap ${isMobile ? 'p-4 border-t border-white/10 bg-black/40' : 'pt-2'}`}>
                            <Button variant="outline" size={isMobile ? "sm" : "default"} className="rounded-xl" onClick={() => setPreviewFile(null)}>Close</Button>
                            <Button variant="secondary" size={isMobile ? "sm" : "default"} className="rounded-xl" onClick={() => handleDownload(previewFile)}>
                                <Download className="h-4 w-4 mr-2" /> {isMobile ? 'Download' : 'Download'}
                            </Button>
                            <Button size={isMobile ? "sm" : "default"} className="rounded-xl" onClick={() => { setPreviewFile(null); navigate(`${baseUrl}/editor/${previewFile.id}`); }}>
                                <ExternalLink className="h-4 w-4 mr-2" /> {isMobile ? 'Open' : 'Open Editor'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE CARD (Grid View)
// ═══════════════════════════════════════════════════════════════════════════════

function FileCard({ file, isMobile, onOpen, onPreview, onPin, onDownload, onDelete, onRename, onUpdateTags, getIcon, readOnly }) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameValue, setNameValue] = useState(file.name);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTag, setNewTag] = useState('');

    const handleSaveRename = () => {
        if (nameValue.trim() && nameValue !== file.name) {
            onRename(nameValue);
        }
        setIsRenaming(false);
    };

    const handleAddTag = () => {
        if (newTag.trim() && !(file.tags || []).includes(newTag.trim())) {
            onUpdateTags([...(file.tags || []), newTag.trim()]);
        }
        setNewTag('');
        setIsAddingTag(false);
    };

    const handleRemoveTag = (tagToRemove) => {
        onUpdateTags((file.tags || []).filter(t => t !== tagToRemove));
    };

    return (
        <Card
            className={`group bg-secondary/20 border-white/10 hover:border-primary/30 transition-all cursor-pointer overflow-hidden rounded-2xl
        ${file.pinned ? 'ring-2 ring-accent/30' : ''}`}
        >
            {/* Thumbnail area */}
            <CardContent className="p-0">
                <div
                    className="relative aspect-square flex items-center justify-center bg-gradient-to-br from-secondary/50 to-secondary/20"
                    onClick={onPreview}
                >
                    {/* Pin indicator */}
                    {file.pinned && (
                        <div className="absolute top-2 left-2">
                            <Pin className="h-4 w-4 text-accent fill-accent" />
                        </div>
                    )}

                    {/* Quick Actions - Always visible on mobile (dropdown only), hover on desktop */}
                    <div className={`absolute top-2 right-2 flex gap-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {!isMobile && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDownload(); }}
                                    className="p-1.5 rounded-lg bg-black/50 hover:bg-primary/80 transition-colors"
                                    title="Download"
                                >
                                    <Download className="h-3.5 w-3.5 text-white" />
                                </button>
                                {!readOnly && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onPin(); }}
                                        className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                                    >
                                        <Pin className={`h-3.5 w-3.5 ${file.pinned ? 'text-accent fill-accent' : 'text-white'}`} />
                                    </button>
                                )}
                            </>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-1.5 rounded-lg bg-black/50 hover:bg-black/70 transition-colors">
                                    <MoreVertical className="h-3.5 w-3.5 text-white" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={onOpen}>
                                    <ExternalLink className="mr-2 h-4 w-4" /> Open Editor
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onPreview}>
                                    <Eye className="mr-2 h-4 w-4" /> Preview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onDownload}>
                                    <Download className="mr-2 h-4 w-4" /> Download
                                </DropdownMenuItem>
                                {!readOnly && (
                                    <>
                                        <DropdownMenuItem onClick={() => onPin()}>
                                            <Pin className={`mr-2 h-4 w-4 ${file.pinned ? 'text-accent fill-accent' : ''}`} /> {file.pinned ? 'Unpin' : 'Pin'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                                            <FileText className="mr-2 h-4 w-4" /> Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-500" onClick={onDelete}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Icon or Thumbnail - bigger on hover */}
                    {file.type === 'asset' && file.content.startsWith('data:image') ? (
                        <img src={file.content} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className={`p-4 transition-transform duration-200 ${!isMobile && 'group-hover:scale-125'}`}>
                            {getIcon(file.type, file.name)}
                        </div>
                    )}
                </div>

                {/* File info */}
                <div className="p-4 border-t border-white/5">
                    {isRenaming ? (
                        <div className="flex items-center gap-1">
                            <Input
                                value={nameValue}
                                onChange={(e) => setNameValue(e.target.value)}
                                onBlur={handleSaveRename}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="h-6 text-xs p-1"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    ) : (
                        <button
                            className={`text-sm font-medium truncate w-full text-left transition-colors ${readOnly ? 'cursor-default' : 'hover:text-primary'}`}
                            onClick={(e) => { e.stopPropagation(); if (!readOnly) setIsRenaming(true); }}
                            title={readOnly ? file.name : "Click to rename"}
                        >
                            {file.name}
                        </button>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                        {(file.tags || []).map(tag => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 group/tag"
                            >
                                <Hash className="h-2 w-2" />
                                {tag}
                                {!readOnly && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                                        className="ml-0.5 opacity-0 group-hover/tag:opacity-100 hover:text-red-400"
                                    >
                                        <X className="h-2 w-2" />
                                    </button>
                                )}
                            </span>
                        ))}
                        {isAddingTag ? (
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onBlur={handleAddTag}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setIsAddingTag(false); }}
                                placeholder="tag"
                                className="w-12 text-[9px] px-1 py-0.5 bg-transparent border border-primary/30 rounded-md outline-none"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            !readOnly && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsAddingTag(true); }}
                                    className="text-[9px] px-1.5 py-0.5 rounded-md border border-dashed border-white/20 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                                >
                                    <Plus className="h-2 w-2" />
                                </button>
                            )
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-muted-foreground">{file.category}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(file.last_edited))} ago</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE LIST ITEM (List View)
// ═══════════════════════════════════════════════════════════════════════════════

function FileListItem({ file, isMobile, onOpen, onPreview, onPin, onDownload, onDelete, onRename, onUpdateTags, getIcon, readOnly }) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [nameValue, setNameValue] = useState(file.name);
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [newTag, setNewTag] = useState('');

    const handleSaveRename = () => {
        if (nameValue.trim() && nameValue !== file.name) {
            onRename(nameValue);
        }
        setIsRenaming(false);
    };

    const handleAddTag = () => {
        if (newTag.trim() && !(file.tags || []).includes(newTag.trim())) {
            onUpdateTags([...(file.tags || []), newTag.trim()]);
        }
        setNewTag('');
        setIsAddingTag(false);
    };

    const handleRemoveTag = (tagToRemove) => {
        onUpdateTags((file.tags || []).filter(t => t !== tagToRemove));
    };

    return (
        <div className={`flex items-center justify-between p-4 rounded-2xl bg-secondary/20 border border-white/10 hover:border-primary/30 transition-all group
      ${file.pinned ? 'ring-2 ring-accent/30' : ''}`}>
            <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110">
                    {getIcon(file.type, file.name)}
                </div>
                <div className="flex-1 min-w-0">
                    {isRenaming ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={nameValue}
                                onChange={(e) => setNameValue(e.target.value)}
                                onBlur={handleSaveRename}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); if (e.key === 'Escape') setIsRenaming(false); }}
                                className="h-7 text-sm"
                                autoFocus
                            />
                            <button onClick={handleSaveRename} className="p-1 hover:text-green-500">
                                <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setIsRenaming(false)} className="p-1 hover:text-red-500">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                className={`font-medium text-sm flex items-center gap-2 transition-colors ${readOnly ? 'cursor-default' : 'hover:text-primary'}`}
                                onClick={() => !readOnly && setIsRenaming(true)}
                                title={readOnly ? file.name : "Click to rename"}
                            >
                                <span className="truncate">{file.name}</span>
                                {file.pinned && <Pin className="h-3 w-3 text-accent fill-accent flex-shrink-0" />}
                            </button>
                            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                    {file.category} · {formatDistanceToNow(new Date(file.last_edited))} ago
                                </p>
                                {/* Tags */}
                                <div className="flex gap-1">
                                    {(file.tags || []).map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 group/tag whitespace-nowrap"
                                        >
                                            <Hash className="h-2 w-2" />
                                            {tag}
                                            {!readOnly && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                                                    className="ml-0.5 opacity-0 group-hover/tag:opacity-100 hover:text-red-400"
                                                >
                                                    <X className="h-2 w-2" />
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                    {isAddingTag ? (
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onBlur={handleAddTag}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setIsAddingTag(false); }}
                                            placeholder="tag"
                                            className="w-12 text-[9px] px-1 py-0.5 bg-transparent border border-primary/30 rounded-md outline-none"
                                            autoFocus
                                        />
                                    ) : (
                                        !readOnly && (
                                            <button
                                                onClick={() => setIsAddingTag(true)}
                                                className="text-[9px] px-1.5 py-0.5 rounded-md border border-dashed border-white/20 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                                            >
                                                <Plus className="h-2 w-2" />
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <div className={`flex items-center gap-1 transition-opacity ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {isMobile ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={onOpen}>
                                <ExternalLink className="mr-2 h-4 w-4" /> Open Editor
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onPreview}>
                                <Eye className="mr-2 h-4 w-4" /> Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onDownload}>
                                <Download className="mr-2 h-4 w-4" /> Download
                            </DropdownMenuItem>
                            {!readOnly && (
                                <>
                                    <DropdownMenuItem onClick={() => onPin()}>
                                        <Pin className={`mr-2 h-4 w-4 ${file.pinned ? 'text-accent fill-accent' : ''}`} /> {file.pinned ? 'Unpin' : 'Pin'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                                        <FileText className="mr-2 h-4 w-4" /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-500" onClick={onDelete}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onDownload} title="Download">
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onPin}>
                            <Pin className={`h-4 w-4 ${file.pinned ? 'text-accent fill-accent' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-lg" onClick={onPreview}>
                            Preview
                        </Button>
                        <Button variant="secondary" size="sm" className="rounded-lg" onClick={onOpen}>
                            Open
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-red-500/20 hover:text-red-500" onClick={onDelete}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
