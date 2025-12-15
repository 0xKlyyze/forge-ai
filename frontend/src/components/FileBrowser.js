import React, { useState } from 'react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from '../components/ui/accordion';
import { Button } from '../components/ui/button';
import { ScrollArea } from '../components/ui/scroll-area';
import { FileText, Code, Image as ImageIcon, Plus, Trash2, File } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const CATEGORIES = [
  { id: 'Docs', icon: FileText, label: 'Documentation' },
  { id: 'Mockups', icon: Code, label: 'UI Components' },
  { id: 'Assets', icon: ImageIcon, label: 'Assets' },
  { id: 'Other', icon: File, label: 'Resources' }
];

export default function FileBrowser({ files, activeFile, onSelect, onCreate, onDelete }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileCategory, setNewFileCategory] = useState('Docs');

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newFileName) return;
    
    // Infer type from category
    let type = 'other';
    if (newFileCategory === 'Docs') type = 'doc';
    if (newFileCategory === 'Mockups') type = 'mockup';
    if (newFileCategory === 'Assets') type = 'asset';
    
    // Add extension if missing
    let name = newFileName;
    if (type === 'doc' && !name.endsWith('.md')) name += '.md';
    if (type === 'mockup' && !name.endsWith('.js') && !name.endsWith('.jsx')) name += '.jsx';
    
    onCreate(name, type, newFileCategory);
    setNewFileName('');
    setIsDialogOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex justify-between items-center">
        <span className="font-mono text-xs font-bold text-muted-foreground">EXPLORER</span>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
          </DialogTrigger>
          <DialogContent className="bg-background/80 backdrop-blur-xl border-white/10">
            <DialogHeader>
              <DialogTitle>New File</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Filename</label>
                <Input value={newFileName} onChange={e => setNewFileName(e.target.value)} placeholder="e.g., Header.jsx" />
              </div>
              <div className="space-y-2">
                 <label className="text-sm font-medium">Category</label>
                 <Select value={newFileCategory} onValueChange={setNewFileCategory}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <DialogFooter>
                 <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <Accordion type="multiple" defaultValue={['Docs', 'Mockups']} className="w-full">
          {CATEGORIES.map(category => {
            const categoryFiles = files.filter(f => f.category === category.id);
            return (
              <AccordionItem key={category.id} value={category.id} className="border-none">
                <AccordionTrigger className="px-4 py-2 hover:bg-white/5 hover:no-underline text-sm font-medium">
                   <div className="flex items-center gap-2">
                      <category.icon className="h-4 w-4 text-muted-foreground" />
                      {category.label}
                      <span className="ml-2 text-xs text-muted-foreground/50 rounded-full bg-white/5 px-1.5">{categoryFiles.length}</span>
                   </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <div className="flex flex-col">
                    {categoryFiles.map(file => (
                      <div 
                        key={file.id} 
                        className={`
                          group flex items-center justify-between px-8 py-1.5 text-sm cursor-pointer border-l-2
                          ${activeFile?.id === file.id 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
                          }
                        `}
                        onClick={() => onSelect(file)}
                      >
                        <span className="truncate">{file.name}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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
    </div>
  );
}
