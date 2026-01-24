import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import {
  Upload, X, Users, Share2, Copy, Trash, Plus,
  Settings2, Globe, ShieldAlert, Check, ChevronRight,
  ExternalLink, Calendar, Fingerprint, Info
} from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { Checkbox } from '../../components/ui/checkbox';
import { ScrollArea } from '../../components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { useProjectContext } from '../../context/ProjectContext';
import { format } from 'date-fns';

export default function ProjectSettings() {
  const { projectId } = useParams();
  const { files } = useProjectContext();
  const [project, setProject] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [activeSection, setActiveSection] = useState('general');

  // Permission State
  const [selectedPages, setSelectedPages] = useState({ home: true, tasks: true, files: true });
  const [fileAccessMode, setFileAccessMode] = useState('all'); // 'all', 'specific', 'none'
  const [selectedFileIds, setSelectedFileIds] = useState(new Set());

  // Collaboration State
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

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
    if (e) e.preventDefault();
    try {
      await api.put(`/projects/${projectId}`, { name, icon });
      toast.success("Settings updated");
    } catch (error) {
      toast.error("Update failed");
    }
  };

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
    } catch (error) {
      toast.error("Failed to send invite");
    }
  };

  const handleRemoveCollaborator = async (userId) => {
    try {
      await api.delete(`/projects/${projectId}/collaborators/${userId}`);
      toast.success("Collaborator removed");
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

  if (!project) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/20" />
        <div className="text-muted-foreground font-mono text-xs">INITIALIZING SYSTEM...</div>
      </div>
    </div>
  );

  const sections = [
    { id: 'general', label: 'General', icon: Settings2, description: 'Project identity and metadata' },
    { id: 'collaboration', label: 'Collaboration', icon: Users, description: 'Manage team and access' },
    { id: 'public', label: 'Public Access', icon: Globe, description: 'Sharing and visibility' },
    { id: 'danger', label: 'Danger Zone', icon: ShieldAlert, description: 'Destructive actions' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Settings Navigation Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-black/20 backdrop-blur-md flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight">Settings</h2>
          <p className="text-xs text-muted-foreground mt-1">Configure project parameters</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${activeSection === section.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }`}
            >
              <section.icon className={`h-4 w-4 ${activeSection === section.id ? 'text-primary' : 'group-hover:text-foreground'}`} />
              <div className="text-left">
                <p className="text-sm font-medium leading-none">{section.label}</p>
              </div>
              {activeSection === section.id && <ChevronRight className="h-4 w-4 ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-secondary/20 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Info className="h-3 w-3" />
              <span>Project Meta</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground uppercase">ID</span>
                <span className="font-mono text-white/40 truncate ml-2 max-w-[100px]">{projectId}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-muted-foreground uppercase">CREATED</span>
                <span className="text-white/40">{project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : 'Recently'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Settings Content Area */}
      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight capitalize">{activeSection.replace('-', ' ')} Settings</h1>
              <p className="text-muted-foreground mt-1">
                {sections.find(s => s.id === activeSection)?.description}
              </p>
            </div>
            {activeSection === 'general' && (
              <Button onClick={handleUpdate} className="rounded-xl shadow-lg shadow-primary/20">
                Save Changes
              </Button>
            )}
          </div>

          <div className="space-y-8">
            {activeSection === 'general' && (
              <div className="space-y-8">
                {/* Project Brand */}
                <Card className="bg-secondary/10 border-white/5 overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg">Project Brand</CardTitle>
                    <CardDescription>Update your project's name and visual identity.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Project Name</Label>
                      <Input
                        id="project-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="h-11 bg-black/20 border-white/10 focus-visible:ring-primary/50"
                        placeholder="My Awesome Project"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Project Icon</Label>
                      <div className="flex items-center gap-6">
                        <div className="h-28 w-28 rounded-3xl bg-secondary/30 border border-white/10 flex items-center justify-center overflow-hidden relative group shadow-2xl">
                          {icon ? (
                            <>
                              <img src={icon} alt="Icon" className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setIcon('')}
                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                              >
                                <X className="h-8 w-8" />
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-bold text-4xl text-primary/50 uppercase">{name.charAt(0) || '?'}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="relative">
                            <Button type="button" variant="outline" className="h-10 px-4 rounded-xl border-white/10 hover:bg-white/5 transition-colors">
                              <Upload className="mr-2 h-4 w-4" /> Change Icon
                            </Button>
                            <input
                              type="file"
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              accept="image/*"
                              onChange={handleIconUpload}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Upload a high-resolution PNG or JPG.<br />
                            Recommended size: 512x512px.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Metadata Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-secondary/5 border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Fingerprint className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Instance ID</span>
                    </div>
                    <p className="font-mono text-xs">{projectId}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/5 border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Deployment Date</span>
                    </div>
                    <p className="text-xs">{project.created_at ? format(new Date(project.created_at), 'MMMM dd, yyyy') : 'Just now'}</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'collaboration' && (
              <div className="space-y-6">
                <Card className="bg-secondary/10 border-white/5">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Team Members
                    </CardTitle>
                    <CardDescription>People with full access to this project.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Active Collaborators */}
                    <div className="space-y-3">
                      {project.collaborators && project.collaborators.length > 0 ? (
                        <div className="grid gap-2">
                          {project.collaborators.map(collab => (
                            <div key={collab.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/20 shadow-inner">
                                  <span className="text-sm font-bold text-primary">{collab.email?.charAt(0).toUpperCase()}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{collab.email}</p>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Contributor</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleRemoveCollaborator(collab.id)}>
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No other team members yet.</p>
                        </div>
                      )}
                    </div>

                    {/* Invite Section */}
                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <div className="space-y-2">
                        <Label>Invite New Member</Label>
                        <div className="flex gap-3">
                          <Input
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            className="h-11 bg-black/20 border-white/10 rounded-xl"
                          />
                          <Button
                            onClick={handleInvite}
                            disabled={!inviteEmail}
                            className="h-11 px-6 rounded-xl"
                          >
                            <Plus className="mr-2 h-4 w-4" /> Send Invite
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'public' && (
              <div className="space-y-6">
                <Card className="bg-secondary/10 border-white/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Visibility & Hosting</CardTitle>
                        <CardDescription>Configure public read-only access for this project.</CardDescription>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${generatedLink ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-orange-500/10 text-orange-500 border border-orange-500/20'}`}>
                        {generatedLink ? 'Live' : 'Private'}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {/* Permissions */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-sm font-semibold">1. Visible Dashboard Pages</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {['home', 'tasks', 'files'].map(page => (
                            <div
                              key={page}
                              onClick={() => setSelectedPages(prev => ({ ...prev, [page]: !prev[page] }))}
                              className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${selectedPages[page]
                                  ? 'bg-primary/5 border-primary/30 text-primary shadow-sm'
                                  : 'bg-black/20 border-white/5 text-muted-foreground hover:border-white/10'
                                }`}
                            >
                              <Checkbox
                                id={`page-${page}`}
                                checked={selectedPages[page]}
                                onCheckedChange={() => { }} // Controlled by div click
                                className="pointer-events-none"
                              />
                              <span className="text-sm font-medium capitalize">{page}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="text-sm font-semibold">2. Artifact Access Level</Label>
                        <RadioGroup value={fileAccessMode} onValueChange={setFileAccessMode} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {[
                            { value: 'all', label: 'All Files', desc: 'Share everything' },
                            { value: 'none', label: 'No Files', desc: 'Keep assets private' },
                            { value: 'specific', label: 'Selective', desc: 'Pick specific files' }
                          ].map(item => (
                            <div
                              key={item.value}
                              onClick={() => setFileAccessMode(item.value)}
                              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1 ${fileAccessMode === item.value
                                  ? 'bg-primary/5 border-primary/30 text-primary shadow-sm'
                                  : 'bg-black/20 border-white/5 text-muted-foreground hover:border-white/10'
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value={item.value} id={`r-${item.value}`} className="pointer-events-none" />
                                <span className="text-sm font-bold">{item.label}</span>
                              </div>
                              <p className="text-[10px] opacity-60 ml-6">{item.desc}</p>
                            </div>
                          ))}
                        </RadioGroup>

                        {fileAccessMode === 'specific' && (
                          <ScrollArea className="h-[240px] w-full rounded-2xl border border-white/10 bg-black/40 p-2 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="grid gap-1">
                              {files.map(file => (
                                <div
                                  key={file.id}
                                  onClick={() => handleToggleFile(file.id)}
                                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedFileIds.has(file.id) ? 'bg-primary/10 text-primary' : 'hover:bg-white/5'}`}
                                >
                                  <Checkbox
                                    id={`file-${file.id}`}
                                    checked={selectedFileIds.has(file.id)}
                                    onCheckedChange={() => { }}
                                    className="pointer-events-none"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate font-medium">{file.name}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{file.type}</p>
                                  </div>
                                </div>
                              ))}
                              {files.length === 0 && <div className="text-sm text-muted-foreground p-8 text-center italic">No artifacts found in project.</div>}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="pt-8 border-t border-white/5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-bold">Public Deployment Link</h4>
                          <p className="text-xs text-muted-foreground">Creates an immutable read-only gateway.</p>
                        </div>
                        <Button
                          variant={generatedLink ? "secondary" : "default"}
                          onClick={handleCreateShareLink}
                          className="rounded-xl px-6"
                        >
                          {generatedLink ? 'Update Deployment' : 'Deploy Public Link'}
                        </Button>
                      </div>

                      {generatedLink && (
                        <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary">
                              <Check className="h-4 w-4" />
                              <span className="text-xs font-bold uppercase tracking-wider">Public Link Active</span>
                            </div>
                            <a
                              href={`${window.location.origin}/s/${generatedLink}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                            >
                              Visit Link <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1 px-4 py-3 bg-black/40 rounded-xl border border-white/10 font-mono text-xs text-primary/80 truncate">
                              {window.location.origin}/s/{generatedLink}
                            </div>
                            <Button size="icon" variant="secondary" className="h-10 w-10 rounded-xl" onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/s/${generatedLink}`);
                              toast.success("Copied to clipboard");
                            }}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeSection === 'danger' && (
              <div className="space-y-6">
                <Card className="bg-destructive/5 border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-lg text-destructive flex items-center gap-2">
                      Dangerous Actions
                    </CardTitle>
                    <CardDescription>Once performed, these actions cannot be undone. Please proceed with extreme caution.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-destructive/10 rounded-2xl border border-destructive/20 group">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold">Delete this project</h4>
                        <p className="text-xs text-muted-foreground">Successfully deleting will remove all files, tasks, and data permanently.</p>
                      </div>
                      <Button variant="destructive" className="px-6 rounded-xl hover:shadow-lg hover:shadow-destructive/20 transition-all">
                        Delete Project
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-black/20 rounded-2xl border border-white/5">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold">Transfer Ownership</h4>
                        <p className="text-xs text-muted-foreground">Hand over this project to another team member.</p>
                      </div>
                      <Button variant="outline" className="px-6 rounded-xl border-white/10 hover:bg-white/5 transition-all" disabled>
                        Transfer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
