import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Plus, Search, Clock, Activity, Trash2, ArrowRight, Zap, Code, Shield, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useDashboard, useCreateProject, useDeleteProject } from '../hooks/useProjectQueries';
import { DashboardSkeleton } from '../components/skeletons/PageSkeletons';

function use3DTilt(stiffness = 500, damping = 100, intensity = 7) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness, damping });
  const mouseY = useSpring(y, { stiffness, damping });

  function onMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const xPct = (clientX - left) / width - 0.5;
    const yPct = (clientY - top) / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-intensity, intensity]);

  return { onMouseMove, onMouseLeave, rotateX, rotateY };
}

function ProjectCard({ project, onDelete }) {
  const { onMouseMove, onMouseLeave, rotateX, rotateY } = use3DTilt();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      layoutId={project.id}
      style={{
        perspective: 1000,
      }}
    >
      <Link to={`/project/${project.id}`}>
        <motion.div
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          className="group relative h-[220px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl p-6 transition-colors duration-300 flex flex-col justify-between shadow-2xl shadow-black/50"
        >
          {/* Hover Glow - 3D adjusted */}
          <div
            className="absolute -inset-px bg-gradient-to-br from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl pointer-events-none"
            style={{ transform: "translateZ(-1px)" }}
          />

          <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                {project.icon ? (
                  <div className="h-10 w-10 rounded-lg bg-black/50 flex items-center justify-center border border-white/10 overflow-hidden shadow-lg">
                    <img src={project.icon} alt={project.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-800 to-black flex items-center justify-center border border-white/10 shadow-lg">
                    <Code className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg text-white group-hover:text-blue-100 transition-colors truncate max-w-[140px]" title={project.name}>
                    {project.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${project.status === 'planning' ? 'bg-yellow-500' :
                      project.status === 'building' ? 'bg-blue-500' :
                        'bg-green-500'
                      } shadow-[0_0_8px_rgba(0,0,0,0)]`} style={{
                        boxShadow: project.status === 'building' ? '0 0 8px rgba(59, 130, 246, 0.5)' : undefined
                      }}></span>
                    <span className="capitalize">{project.status || 'Active'}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(project);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative z-10 mt-auto space-y-3" style={{ transform: "translateZ(10px)" }}>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-black/30 p-2 rounded-lg border border-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{project.last_edited ? formatDistanceToNow(new Date(project.last_edited), { addSuffix: true }) : 'Just now'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Private</span>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

function HeroProject({ project, priorityTasks = [], onDelete }) {
  // Increased intensity to 15 for more pronounced effect on larger card
  const { onMouseMove, onMouseLeave, rotateX, rotateY } = use3DTilt(400, 90, 15);
  if (!project) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full mb-8 h-full"
      style={{ perspective: 1000 }}
    >
      <Link to={`/project/${project.id}`}>
        <motion.div
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-white/10 hover:border-blue-500/30 transition-all duration-500 shadow-2xl h-full"
        >
          {/* 3D Depth Layer */}
          <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors duration-500" style={{ transform: "translateZ(-10px)" }} />

          <div className="relative z-10 p-8 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between h-full" style={{ transform: "translateZ(20px)" }}>

            <div className="flex items-start gap-6 relative">
              {project.icon ? (
                <div className="w-24 h-24 rounded-2xl bg-black border border-white/10 overflow-hidden shadow-2xl shrink-0">
                  <img src={project.icon} alt={project.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shrink-0">
                  <Code className="h-10 w-10 text-white/50" />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono border border-blue-500/20">LAST EDITED</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {project.last_edited ? formatDistanceToNow(new Date(project.last_edited), { addSuffix: true }) : 'Just now'}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-white group-hover:text-blue-100 transition-colors">{project.name}</h2>
                <p className="text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  {project.status || 'Active Development'}
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto" style={{ transform: "translateZ(10px)" }}>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center transition-transform hover:scale-105 duration-200">
                <div className="text-2xl font-bold text-white mb-1">{project.file_count || 0}</div>
                <div className="text-xs text-muted-foreground font-mono flex items-center justify-center gap-1"><FileText className="w-3 h-3" /> DOCS</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center transition-transform hover:scale-105 duration-200">
                <div className="text-2xl font-bold text-white mb-1">{project.task_count ? project.task_count - (project.completed_tasks || 0) : 0}</div>
                <div className="text-xs text-muted-foreground font-mono flex items-center justify-center gap-1"><AlertCircle className="w-3 h-3" /> PENDING</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center transition-transform hover:scale-105 duration-200">
                <div className="text-2xl font-bold text-white mb-1">{project.completed_tasks || 0}</div>
                <div className="text-xs text-muted-foreground font-mono flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> DONE</div>
              </div>
              {priorityTasks.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center transition-transform hover:scale-105 duration-200">
                  <div className="text-2xl font-bold text-red-400 mb-1">{priorityTasks.length}</div>
                  <div className="text-xs text-red-300/70 font-mono flex items-center justify-center gap-1"><Zap className="w-3 h-3" /> URGENT</div>
                </div>
              )}
            </div>

            {/* Delete Button (Absolute) */}
            <div className="absolute top-4 right-4 z-20" style={{ transform: "translateZ(30px)" }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-500/10 group-hover:opacity-100 transition-all scale-100"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(project);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  // React Query hooks
  const { data, isLoading } = useDashboard();
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();

  const projects = data?.projects || [];
  const priorityTasks = data?.priority_tasks || [];

  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Keyboard shortcut for New Project
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsExpanded(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Show skeleton while loading
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName) return;
    try {
      const newProject = await createProjectMutation.mutateAsync({ name: newProjectName, user_id: "temp" });
      setNewProjectName('');
      setIsExpanded(false);
      toast.success("Project initialized");
      navigate(`/project/${newProject.id}/onboarding`);
    } catch (error) {
      toast.error("Failed to create project");
    }
  };

  const handleDeleteSubmision = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProjectMutation.mutateAsync(projectToDelete.id);
      toast.success("Project deleted");
    } catch (error) {
      toast.error("Failed to delete project");
    } finally {
      setProjectToDelete(null);
    }
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  // Split projects into Hero (first one) and Grid (rest)
  // Only use Hero if no search is active
  const showHero = search === '' && projects.length > 0;
  const heroProject = projects[0];
  const gridProjects = showHero ? filteredProjects.slice(1) : filteredProjects;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 py-12 relative z-10 max-w-7xl">

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
              <div className="relative bg-black rounded-xl p-2">
                <img src="/favicon.svg" alt="Forge" className="w-10 h-10 object-contain" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
                Forge
              </h1>
              <p className="text-sm text-muted-foreground font-medium">IDE & Development Suite</p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-4 border border-white/10 px-3 py-1.5 rounded-lg bg-white/5">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                N
              </kbd>
              <span>New Project</span>
            </div>
            <div className="relative w-full md:w-[320px] group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
              <Input
                type="search"
                placeholder="Search projects..."
                className="pl-10 h-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-blue-500/50 focus-visible:border-blue-500/50 rounded-lg transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </motion.div>

        {/* Content Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >

          {/* Hero Section */}
          {showHero && (
            <HeroProject
              project={heroProject}
              priorityTasks={priorityTasks.filter(t => t.project_id === heroProject.id)}
              onDelete={setProjectToDelete}
            />
          )}

          {/* Create New Project Card */}
          <motion.div variants={itemVariants} className="h-full" style={{ perspective: 1000 }}>
            <motion.div
              whileHover={{ scale: 1.02, rotateX: 2, rotateY: 2 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={`h-[220px] rounded-xl border border-dashed border-white/10 hover:border-blue-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 group relative p-6 flex flex-col items-center justify-center cursor-pointer ${isExpanded ? 'border-blue-500/50' : ''}`}
              onClick={() => setIsExpanded(true)}
            >
              <form onSubmit={handleCreateProject} className="w-full h-full flex flex-col items-center justify-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Plus className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-center w-full">
                  <h3 className="font-semibold text-lg text-white group-hover:text-blue-200 transition-colors">New Project</h3>
                  <p className="text-xs text-muted-foreground mb-4">Initialize a new codebase</p>

                  <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0'}`}>
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        placeholder="Project Name"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="h-9 bg-black/50 border-white/10 text-center text-sm"
                        onBlur={() => {
                          if (!newProjectName && !createProjectMutation.isPending) setIsExpanded(false);
                        }}
                      />
                      <Button size="icon" type="submit" disabled={createProjectMutation.isPending} className="h-9 w-9 bg-blue-600 hover:bg-blue-500">
                        {createProjectMutation.isPending ? <Activity className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>

          {/* Project List */}
          <AnimatePresence>
            {gridProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={setProjectToDelete}
              />
            ))}
          </AnimatePresence>

          {/* Empty State (if no search results but projects exist, or totally empty except create card) */}
          {filteredProjects.length === 0 && projects.length > 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No projects found matching "{search}"</p>
            </div>
          )}

          {projects.length === 0 && !createProjectMutation.isPending && (
            <div className="hidden md:flex col-span-2 items-center justify-center p-8 border border-white/5 border-dashed rounded-xl bg-white/[0.01]">
              <div className="text-center max-w-sm">
                <Zap className="h-10 w-10 text-yellow-500/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Start Building</h3>
                <p className="text-sm text-muted-foreground">Create your first project to get started with Forge. You'll be able to manage tasks, code, and deployments.</p>
              </div>
            </div>
          )}

        </motion.div>

        {/* Footer Info */}
        <div className="mt-20 text-center text-xs text-white/20 font-mono">
          <p>FORGE AI • v0.1.0 • SYSTEM ACTIVE</p>
        </div>

      </div>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent className="bg-black/90 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete <span className="text-white font-medium">{projectToDelete?.name}</span>? This action cannot be undone and will permanently remove all associated files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white border-0" onClick={handleDeleteSubmision}>
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
