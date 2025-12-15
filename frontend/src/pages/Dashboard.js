import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Search, FolderOpen, Clock, Activity, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (error) {
      console.error("Failed to fetch projects", error);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;
    setIsCreating(true);
    try {
      const res = await api.post('/projects', { name: newProjectName, user_id: "temp" });
      setProjects([res.data, ...projects]);
      setNewProjectName('');
      toast.success("Project initialized");
      navigate(`/project/${res.data.id}/onboarding`);
    } catch (error) {
      toast.error("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id, e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent card click
    if (!window.confirm("Delete this project and all files?")) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects(projects.filter(p => p.id !== id));
      toast.success("Project deleted");
    } catch (error) {
      toast.error("Failed to delete project");
    }
  }


  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-mono font-bold tracking-tight text-white">CONTROL ROOM</h1>
          <p className="text-muted-foreground mt-2">Manage your development operations.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search protocols..."
              className="pl-8 w-[250px] bg-secondary/50 border-white/5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Create New Card */}
        <Card className="border-dashed border-2 border-muted hover:border-primary/50 transition-colors bg-transparent flex flex-col items-center justify-center p-6 h-[200px]">
          <form onSubmit={handleCreateProject} className="w-full space-y-4 text-center">
            <h3 className="font-semibold text-lg">Initialize New Protocol</h3>
            <Input
              placeholder="Project Name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="text-center bg-secondary/30"
            />
            <Button type="submit" disabled={isCreating} className="w-full">
              {isCreating ? <Activity className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {isCreating ? 'Initializing...' : 'Create Project'}
            </Button>
          </form>
        </Card>

        {/* Project Cards */}
        {filteredProjects.map((project) => (
          <Link key={project.id} to={`/project/${project.id}`}>
            <Card className="h-[200px] hover:border-accent/50 transition-all cursor-pointer group relative bg-secondary/20 backdrop-blur-sm border-white/5 overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteProject(project.id, e)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="font-mono text-xl truncate pr-6">{project.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${project.status === 'planning' ? 'bg-yellow-500' : project.status === 'building' ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="capitalize">{project.status}</span>
                </div>
              </CardContent>
              <CardFooter className="absolute bottom-0 w-full bg-black/20 p-4 border-t border-white/5">
                <div className="flex justify-between w-full text-xs text-muted-foreground font-mono">
                  <span className="flex items-center"><FolderOpen className="mr-1 h-3 w-3" /> FILES</span>
                  <span className="flex items-center"><Clock className="mr-1 h-3 w-3" /> {formatDistanceToNow(new Date(project.last_edited), { addSuffix: true })}</span>
                </div>
              </CardFooter>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
