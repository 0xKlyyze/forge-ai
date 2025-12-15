import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../components/ui/accordion';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { FileText, Code, Image as ImageIcon, Plus, Trash2, File, FolderPlus, Move, Copy, GripVertical, Pencil, X, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

// Default categories
const DEFAULT_CATEGORIES = [
  { id: 'Mockups', icon: Code, label: 'UI Components' },
  { id: 'Docs', icon: FileText, label: 'Documentation' },
  { id: 'Assets', icon: ImageIcon, label: 'Assets' },
  { id: 'Other', icon: File, label: 'Other' }
];

// Auto-detect category and type from file extension
const inferFromExtension = (filename) => {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'jsx':
    case 'js':
    case 'tsx':
    case 'ts':
      return { type: 'mockup', category: 'Mockups' };
    case 'md':
    case 'txt':
    case 'doc':
    case 'docx':
      return { type: 'doc', category: 'Docs' };
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return { type: 'asset', category: 'Assets' };
    default:
      return { type: 'other', category: 'Other' };
  }
};

export default function FileBrowser({
  files,
  activeFile,
  project,
  onSelect,
  onCreate,
  onDelete,
  onUpdateFile,
  onUpdateProject,
  onDropFiles
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState('Mockups');
  const [newCategoryName, setNewCategoryName] = useState('');

  // Move file dialog
  const [moveDialogFile, setMoveDialogFile] = useState(null);
  const [moveTargetCategory, setMoveTargetCategory] = useState('');

  // Delete confirmation
  const [deleteConfirmFile, setDeleteConfirmFile] = useState(null);

  // Renaming state
  const [renamingFileId, setRenamingFileId] = useState(null);
  const [renamingName, setRenamingName] = useState('');

  // Custom categories (persisted in project)
  const customCategories = (project?.custom_categories || []).map(c => ({
    ...c,
    icon: File // Map string to icon component if needed, defaulting to File
  }));
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  // Handle file creation with auto-detection
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newFileName) return;

    // Auto-detect from extension
    const { type, category } = inferFromExtension(newFileName);
    const finalCategory = newFileCategory || category;

    // Add extension if missing for code files
    let name = newFileName;
    if (type === 'mockup' && !name.match(/\.(jsx?|tsx?)$/)) {
      name += '.jsx';
    }
    if (type === 'doc' && !name.match(/\.(md|txt)$/)) {
      name += '.md';
    }

    onCreate(name, type, finalCategory);
    setNewFileName('');
    setIsDialogOpen(false);
  };

  console.log("FileBrowser Render. Project:", project);
  console.log("FileBrowser Render. Custom Categories:", project?.custom_categories);

  // Handle category creation
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const newCat = {
      id: newCategoryName.replace(/\s+/g, '_'),
      label: newCategoryName
    };

    console.log("Creating category. Current project state:", project);
    const currentCats = project?.custom_categories || [];
    console.log("Current categories:", currentCats);
    console.log("New category payload:", [...currentCats, newCat]);

    // Update project with new category
    if (onUpdateProject) {
      // Prevent duplicates
      if (!currentCats.find(c => c.id === newCat.id)) {
        try {
          await onUpdateProject({ custom_categories: [...currentCats, newCat] });
          toast.success(`Created category: ${newCategoryName}`);
        } catch (error) {
          console.error("Failed to create category:", error);
          // Error handled by onUpdateProject
        }
      }
    }

    setNewCategoryName('');
    setIsCategoryDialogOpen(false);
  };

  // Handle moving file to different category
  const handleMoveFile = () => {
    if (!moveDialogFile || !moveTargetCategory) return;

    // Determine new type based on category
    let newType = moveDialogFile.type;
    if (moveTargetCategory === 'Mockups') newType = 'mockup';
    if (moveTargetCategory === 'Docs') newType = 'doc';
    if (moveTargetCategory === 'Assets') newType = 'asset';

    onUpdateFile?.(moveDialogFile.id, {
      category: moveTargetCategory,
      type: newType
    });
    toast.success(`Moved to ${allCategories.find(c => c.id === moveTargetCategory)?.label}`);
    setMoveDialogFile(null);
  };

  // Handle copy file content (images as blob, others as text)
  const handleCopyFile = async (file, e) => {
    e.stopPropagation();

    try {
      if (file.type === 'asset' && file.content?.startsWith('data:image')) {
        // For images, we need to convert to PNG blob for clipboard
        // Create an image element to load the base64
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = file.content;
        });

        // Draw to canvas and get as PNG blob
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
              ]);
              toast.success('Image copied to clipboard');
            } catch (err) {
              // Fallback: copy the data URL
              await navigator.clipboard.writeText(file.content);
              toast.success('Image data copied');
            }
          }
        }, 'image/png');
      } else {
        // For text content
        await navigator.clipboard.writeText(file.content || '');
        toast.success('Copied to clipboard');
      }
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback for any errors
      await navigator.clipboard.writeText(file.content || '');
      toast.success('Copied to clipboard');
    }
  };

  // Handle delete with confirmation
  const handleDeleteConfirm = () => {
    if (deleteConfirmFile) {
      onDelete(deleteConfirmFile.id);
      setDeleteConfirmFile(null);
    }
  };

  // Auto-update category when filename changes
  const handleFilenameChange = (filename) => {
    setNewFileName(filename);
    const { category } = inferFromExtension(filename);
    setNewFileCategory(category);
  };

  // Inline renaming
  const startRenaming = (file, e) => {
    e.stopPropagation();
    setRenamingFileId(file.id);
    setRenamingName(file.name);
  };

  const submitRename = async (e) => {
    e?.stopPropagation();
    if (renamingFileId && renamingName.trim()) {
      await onUpdateFile(renamingFileId, { name: renamingName });
      setRenamingFileId(null);
      setRenamingName('');
      toast.success("File renamed");
    }
  };

  const cancelRename = (e) => {
    e?.stopPropagation();
    setRenamingFileId(null);
    setRenamingName('');
  };

  return (
    <div className="h-full flex flex-col relative">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <span className="font-mono text-xs font-bold text-muted-foreground">EXPLORER</span>
        <div className="flex items-center gap-1">
          {/* Create Category */}
          <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="New Category" disabled={!project}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/80 backdrop-blur-xl border-white/10">
              <DialogHeader>
                <DialogTitle>New Category</DialogTitle>
                <DialogDescription>Create a new category to organize your files.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCategory} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category Name</label>
                  <Input
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Utilities"
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create File */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" title="New File">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background/80 backdrop-blur-xl border-white/10">
              <DialogHeader>
                <DialogTitle>New File</DialogTitle>
                <DialogDescription>
                  Files are auto-categorized by extension (.jsx → UI Components, .md → Documentation)
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filename</label>
                  <Input
                    value={newFileName}
                    onChange={e => handleFilenameChange(e.target.value)}
                    placeholder="e.g., Header.jsx or README.md"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={newFileCategory} onValueChange={setNewFileCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto-detected from extension, but you can change it.
                  </p>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <label className="flex-1">
                    <input
                      type="file"
                      className="hidden"
                      accept=".jsx,.js,.tsx,.ts,.md,.txt,.png,.jpg,.jpeg,.gif,.svg,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && onDropFiles) {
                          onDropFiles([file]);
                          setIsDialogOpen(false);
                        }
                      }}
                    />
                    <Button type="button" variant="outline" className="w-full" asChild>
                      <span>Upload File</span>
                    </Button>
                  </label>
                  <Button type="submit">Create Empty</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* File List */}
      <ScrollArea className="flex-1">
        <Accordion type="multiple" defaultValue={['Mockups', 'Docs']} className="w-full">
          {allCategories.map(category => {
            const categoryFiles = files.filter(f => f.category === category.id);
            return (
              <AccordionItem key={category.id} value={category.id} className="border-none">
                <AccordionTrigger className="px-4 py-2 hover:bg-white/5 hover:no-underline text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <category.icon className="h-4 w-4 text-muted-foreground" />
                    {category.label}
                    <span className="ml-2 text-xs text-muted-foreground/50 rounded-full bg-white/5 px-1.5">
                      {categoryFiles.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="flex flex-col">
                    {categoryFiles.map(file => (
                      <div
                        key={file.id}
                        className={`
                                                    group flex items-center gap-2 px-4 py-1.5 text-sm cursor-pointer border-l-2 w-full max-w-full
                                                    ${activeFile?.id === file.id
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
                          }
                                                `}
                        onClick={() => !renamingFileId && onSelect(file)}
                      >
                        <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-50 cursor-grab flex-shrink-0" />

                        {renamingFileId === file.id ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                            <Input
                              value={renamingName}
                              onChange={e => setRenamingName(e.target.value)}
                              className="h-6 text-xs py-0 px-1"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') submitRename();
                                if (e.key === 'Escape') cancelRename();
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={submitRename}><Check className="h-3 w-3 text-green-500" /></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelRename}><X className="h-3 w-3 text-red-500" /></Button>
                          </div>
                        ) : (
                          <span className="flex-1 truncate min-w-0 block">{file.name}</span>
                        )}

                        {/* Quick actions */}
                        {!renamingFileId && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            {/* Rename */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => startRenaming(file, e)}
                              title="Rename"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>

                            {/* Copy content */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => handleCopyFile(file, e)}
                              title="Copy content"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>

                            {/* Move to category */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveDialogFile(file);
                                setMoveTargetCategory(file.category);
                              }}
                              title="Move to..."
                            >
                              <Move className="h-3 w-3" />
                            </Button>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirmFile(file); }}
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {categoryFiles.length === 0 && (
                      <div className="px-8 py-2 text-xs text-muted-foreground/40 italic">Empty</div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </ScrollArea>

      {/* Move File Dialog */}
      <Dialog open={!!moveDialogFile} onOpenChange={(open) => !open && setMoveDialogFile(null)}>
        <DialogContent className="bg-background/80 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle>Move File</DialogTitle>
            <DialogDescription>
              Move "{moveDialogFile?.name}" to a different category.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={moveTargetCategory} onValueChange={setMoveTargetCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveDialogFile(null)}>Cancel</Button>
            <Button onClick={handleMoveFile}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmFile} onOpenChange={(open) => !open && setDeleteConfirmFile(null)}>
        <DialogContent className="bg-background/80 backdrop-blur-xl border-white/10">
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmFile?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmFile(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
