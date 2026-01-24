import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Upload, X, Users, Share2, Copy, Trash, Plus, Link as LinkIcon, Check } from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ScrollArea } from '../../components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { useProjectContext } from '../../context/ProjectContext';

export default function ProjectSettings() {
  const { projectId } = useParams();
  const { files } = useProjectContext();
  const [project, setProject] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  // Permission State
  const [selectedPages, setSelectedPages] = useState({ home: true, tasks: true, files: true });
  const [fileAccessMode, setFileAccessMode] = useState('all'); // 'all', 'specific', 'none'
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());

  const handleToggleFile = (fileId) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(fileId)) newSet.delete(fileId);
    else newSet.add(fileId);
    setSelectedFileIds(newSet);
  };

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await api.get(`/projects/${projectId}`);
        setProject(res.data);
        setName(res.data.name);
        setIcon(res.data.icon || '');
      } catch (error) {
        toast.error("Failed to load settings");
      }
    };
    fetchProject();
  }, [projectId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/projects/${projectId}`, { name, icon });
      toast.success("Settings updated");
    } catch (error) {
      toast.error("Update failed");
    }
  };

  // Collaboration State
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // ... existing icon upload ...
  const handleIconUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setIcon(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleInvite = async () => {
    try {
      await api.post(`/projects/${projectId}/invites`, { email: inviteEmail });
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      // Ideally refresh project data to see pending invite or if they auto-joined? 
      // For now just clear input.
    } catch (error) {
      toast.error("Failed to send invite");
    }
  };

  const handleRemoveCollaborator = async (userId) => {
    try {
      await api.delete(`/projects/${projectId}/collaborators/${userId}`);
      toast.success("Collaborator removed");
      // Refresh project data
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch (error) {
      toast.error("Failed to remove collaborator");
    }
  };

  const handleCreateShareLink = async () => {
    try {
      const permissions = {
        allow_pages: Object.keys(selectedPages).filter(k => selectedPages[k]),
        allow_all_files: fileAccessMode === 'all',
        allow_files: fileAccessMode === 'specific' ? Array.from(selectedFileIds) : []
      };

      const res = await api.post(`/projects/${projectId}/share`, permissions);
      setGeneratedLink(res.data.token);
      toast.success("Public link generated");
    } catch (error) {
      toast.error("Failed to generate link");
    }
  };

  if (!project) return <div className="p-10">Loading...</div>;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-mono font-bold tracking-tight">SYSTEM CONFIG</h1>
        <p className="text-muted-foreground">Manage project parameters.</p>
      </div>

      <Card className="bg-secondary/10 border-white/5">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Basic project identification.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Project Icon</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-2xl bg-secondary/30 border border-white/10 flex items-center justify-center overflow-hidden relative group">
                  {icon ? (
                    <>
                      <img src={icon} alt="Icon" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setIcon('')}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                      >
                        <X className="h-6 w-6" />
                      </button>
                    </>
                  ) : (
                    <span className="font-mono text-2xl font-bold text-muted-foreground">{name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" className="relative overflow-hidden">
                    <Upload className="mr-2 h-4 w-4" /> Upload Icon
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*"
                      onChange={handleIconUpload}
                    />
                  </Button>
                  <p className="text-xs text-muted-foreground">Recommended: 512x512 PNG</p>
                </div>
              </div>
            </div>

            <Button type="submit">Save Configuration</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-secondary/10 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Collaboration</CardTitle>
          <CardDescription>Manage team access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Active Collaborators */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Team Members</h3>
            {project.collaborators && project.collaborators.length > 0 ? (
              <div className="space-y-2">
                {project.collaborators.map(collab => (
                  <div key={collab.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold">{collab.email?.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-sm">{collab.email}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveCollaborator(collab.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic">No collaborators yet.</div>
            )}
          </div>

          {/* Invite */}
          <div className="space-y-2 pt-4 border-t border-white/5">
            <Label>Invite Collaborator</Label>
            <div className="flex gap-2">
              <Input placeholder="colleague@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
              <Button onClick={handleInvite} disabled={!inviteEmail}>
                <Plus className="mr-2 h-4 w-4" /> Invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-secondary/10 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Public Access</CardTitle>
          <CardDescription>Share your project with the world (Read Only).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-6">

            {/* Permissions Configuration */}
            <div className="space-y-4 border-b border-white/5 pb-4">
              <Label className="text-base">1. Visible Pages</Label>
              <div className="flex gap-6">
                {['home', 'tasks', 'files'].map(page => (
                  <div key={page} className="flex items-center space-x-2">
                    <Checkbox
                      id={`page-${page}`}
                      checked={selectedPages[page]}
                      onCheckedChange={(checked) => setSelectedPages(prev => ({ ...prev, [page]: checked }))}
                    />
                    <label
                      htmlFor={`page-${page}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize"
                    >
                      {page}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-b border-white/5 pb-4">
              <Label className="text-base">2. File Access</Label>
              <RadioGroup value={fileAccessMode} onValueChange={setFileAccessMode} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="r-all" />
                  <Label htmlFor="r-all">Share All Files</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="r-none" />
                  <Label htmlFor="r-none">No Files</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="r-specific" />
                  <Label htmlFor="r-specific">Specific Files</Label>
                </div>
              </RadioGroup>

              {fileAccessMode === 'specific' && (
                <ScrollArea className="h-[200px] w-full rounded-md border border-white/10 bg-black/20 p-4">
                  <div className="space-y-2">
                    {files.map(file => (
                      <div key={file.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`file-${file.id}`}
                          checked={selectedFileIds.has(file.id)}
                          onCheckedChange={() => handleToggleFile(file.id)}
                        />
                        <label
                          htmlFor={`file-${file.id}`}
                          className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                        >
                          {file.name} <span className="text-xs text-muted-foreground ml-2">({file.type})</span>
                        </label>
                      </div>
                    ))}
                    {files.length === 0 && <div className="text-sm text-muted-foreground p-2">No files in project.</div>}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="flex items-start justify-between pt-2">
              <div className="space-y-1">
                <Label>Generate Public Link</Label>
                <p className="text-xs text-muted-foreground">Creates a read-only link with above permissions.</p>
              </div>
              <Button variant="outline" onClick={handleCreateShareLink}>Generate Link</Button>
            </div>
          </div>

          {generatedLink && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
              <Label className="text-green-500">Public Link Active</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-black/20 rounded border border-white/10 font-mono text-xs truncate">
                  {window.location.origin}/s/{generatedLink}
                </div>
                <Button size="icon" variant="ghost" onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/s/${generatedLink}`);
                  toast.success("Copied to clipboard");
                }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
