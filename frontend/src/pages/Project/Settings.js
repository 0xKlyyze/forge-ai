import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

export default function ProjectSettings() {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

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

  const handleIconUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setIcon(ev.target.result);
      reader.readAsDataURL(file);
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
    </div>
  );
}
