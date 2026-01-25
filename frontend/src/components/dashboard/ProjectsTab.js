import React from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Clock, Activity, Trash2, ArrowRight, Zap, Code, Shield, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

import ProjectCard from './ProjectCard';

function HeroProject({ project, priorityTasks = [], onDelete }) {
    const { onMouseMove, onMouseLeave, rotateX, rotateY } = use3DTilt(400, 90, 8);
    if (!project) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full mb-8"
            style={{ perspective: 1000 }}
        >
            <Link to={`/project/${project.id}`}>
                <motion.div
                    onMouseMove={onMouseMove}
                    onMouseLeave={onMouseLeave}
                    style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                    className="group relative w-full overflow-hidden rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-blue-500/20 transition-all duration-500 shadow-2xl"
                >
                    <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-blue-600/10 transition-colors duration-500" />

                    <div className="relative z-10 p-8 flex flex-col md:flex-row gap-8 items-center justify-between" style={{ transform: "translateZ(30px)" }}>
                        <div className="flex items-center gap-6">
                            {project.icon ? (
                                <div className="w-20 h-20 rounded-2xl bg-black/50 border border-white/10 overflow-hidden shadow-2xl shrink-0">
                                    <img src={project.icon} alt={project.name} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 border border-white/10 flex items-center justify-center shrink-0 shadow-2xl">
                                    <Code className="h-10 w-10 text-white/40" />
                                </div>
                            )}

                            <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-wider border border-blue-500/20">Resume Work</span>
                                    <span className="text-[10px] text-zinc-500 font-medium">{project.last_edited ? formatDistanceToNow(new Date(project.last_edited), { addSuffix: true }) : 'Just now'}</span>
                                </div>
                                <h2 className="text-3xl font-bold text-white tracking-tight truncate">{project.name}</h2>
                                <div className="flex items-center gap-2 text-sm text-zinc-400">
                                    <Activity className="w-4 h-4 text-green-500" />
                                    {project.status || 'Active Development'}
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-6 right-6 h-10 w-10 text-white/10 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 z-20"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete(project);
                            }}
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                            {[
                                { label: 'FILES', value: project.file_count || 0, icon: FileText, color: 'text-blue-400' },
                                { label: 'PENDING', value: project.task_count ? project.task_count - (project.completed_tasks || 0) : 0, icon: AlertCircle, color: 'text-amber-400' },
                                { label: 'DONE', value: project.completed_tasks || 0, icon: CheckCircle2, color: 'text-green-400' },
                                { label: 'URGENT', value: priorityTasks.length, icon: Zap, color: 'text-red-400', visible: priorityTasks.length > 0 }
                            ].map((stat, i) => (
                                stat.visible !== false && (
                                    <div key={i} className="p-4 min-w-[100px] rounded-2xl bg-white/5 border border-white/5 text-center transition-all hover:bg-white/10 group/stat">
                                        <div className={`text-2xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
                                        <div className="text-[9px] text-zinc-500 font-bold tracking-widest flex items-center justify-center gap-1">
                                            <stat.icon className="w-3 h-3" /> {stat.label}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </motion.div>
            </Link>
        </motion.div>
    );
}

export default function ProjectsTab({
    projects,
    priorityTasks,
    search,
    setSearch,
    isExpanded,
    setIsExpanded,
    newProjectName,
    setNewProjectName,
    handleCreateProject,
    setProjectToDelete,
    isOwnerTab = true
}) {
    const inputRef = React.useRef(null);

    React.useEffect(() => {
        if (isExpanded && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isExpanded]);

    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    const showHero = search === '' && filteredProjects.length > 0 && isOwnerTab;
    const heroProject = filteredProjects[0];
    const gridProjects = showHero ? filteredProjects.slice(1) : filteredProjects;

    return (
        <div className="space-y-6">
            {/* Header with Search and Create */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                    <Input
                        type="search"
                        placeholder="Search projects..."
                        className="pl-11 h-12 bg-zinc-900/50 border-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-blue-500/50 rounded-2xl transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {isOwnerTab && (
                    <form onSubmit={handleCreateProject} className="w-full md:w-auto">
                        <div className={`flex items-center gap-2 transition-all duration-300 ${isExpanded ? 'w-full md:w-72' : 'w-full md:w-44'}`}>
                            {!isExpanded ? (
                                <Button
                                    type="button"
                                    onClick={() => setIsExpanded(true)}
                                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <Plus size={18} /> New Project
                                </Button>
                            ) : (
                                <div className="flex gap-2 w-full">
                                    <Input
                                        ref={inputRef}
                                        placeholder="Project Name"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        className="h-12 bg-zinc-900/50 border-white/5 rounded-2xl"
                                        onBlur={() => !newProjectName && setIsExpanded(false)}
                                    />
                                    <Button type="submit" size="icon" className="h-12 w-12 bg-blue-600 flex-shrink-0 rounded-2xl shadow-lg shadow-blue-600/20">
                                        <ArrowRight size={18} />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </form>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {showHero && (
                    <HeroProject
                        project={heroProject}
                        priorityTasks={priorityTasks.filter(t => t.project_id === heroProject.id)}
                        onDelete={setProjectToDelete}
                    />
                )}

                <AnimatePresence mode="popLayout">
                    {gridProjects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onDelete={setProjectToDelete}
                        />
                    ))}
                </AnimatePresence>

                {filteredProjects.length === 0 && (
                    <div className="col-span-full py-20 text-center flex flex-col items-center justify-center space-y-4 rounded-3xl bg-zinc-900/20 border border-dashed border-white/5">
                        <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5">
                            <Code className="h-10 w-10 text-zinc-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">No projects found</h3>
                            <p className="text-zinc-500">Try adjusting your search or create a new project.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
