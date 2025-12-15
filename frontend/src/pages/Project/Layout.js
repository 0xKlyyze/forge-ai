import React, { useState, useEffect } from 'react';
import { 
  Home, 
  FileText, 
  CheckSquare, 
  Settings, 
  Code,
  Plus,
  LogOut
} from 'lucide-react';
import { Outlet, useLocation, useNavigate, useParams, NavLink } from 'react-router-dom';
import api from '../../utils/api';

const MainNavLink = ({ to, label, icon: Icon }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `
            flex flex-col items-center justify-center gap-2 w-20 h-20 rounded-2xl 
            transition-all duration-200 group
            ${isActive ? 'bg-primary text-primary-foreground shadow-lg scale-105' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
        `}
    >
        <Icon size={24} strokeWidth={2} />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </NavLink>
);

export default function ProjectLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);

  useEffect(() => {
      const fetchProject = async () => {
          try {
              const res = await api.get(`/projects/${projectId}`);
              setProject(res.data);
          } catch (e) { console.error(e); }
      };
      fetchProject();
  }, [projectId]);

  const mainNavItems = [
    { to: `/project/${projectId}/home`, label: 'Home', icon: Home },
    { to: `/project/${projectId}/files`, label: 'Artifacts', icon: FileText },
    { to: `/project/${projectId}/editor`, label: 'Editor', icon: Code },
    { to: `/project/${projectId}/tasks`, label: 'Mission', icon: CheckSquare },
  ];

  return (
    <div className="h-screen w-screen bg-background flex antialiased overflow-hidden relative">
        
        {/* Navigation Sidebar */}
        <nav className="w-28 flex-shrink-0 flex flex-col items-center py-6 gap-6 bg-background border-r border-border/40 z-20">
            {/* 1. App Icon */}
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 mb-2 cursor-pointer overflow-hidden" onClick={() => navigate('/dashboard')}>
                {project?.icon ? (
                    <img src={project.icon} alt="Project Icon" className="w-full h-full object-cover" />
                ) : (
                    <span className="font-mono font-black text-2xl text-primary-foreground">{project ? project.name.charAt(0) : 'F'}</span>
                )}
            </div>
            
            {/* 2. Primary Action */}
            <button
                onClick={() => navigate(`/project/${projectId}/tasks`)}
                title="New Task"
                className="p-4 bg-secondary/50 rounded-full hover:bg-primary/10 border border-border text-muted-foreground hover:text-primary transition-colors duration-200"
            >
                <Plus size={24} strokeWidth={2} />
            </button>

            {/* 3. Main Navigation */}
            <div className="flex-1 flex flex-col items-center gap-4 w-full px-2">
                {mainNavItems.map(item => (
                    <MainNavLink key={item.to} {...item} />
                ))}
            </div>

            {/* 4. Utilities */}
            <div className="flex flex-col items-center gap-4 mb-4">
                <MainNavLink to={`/project/${projectId}/settings`} label="Config" icon={Settings} />
                <button 
                    onClick={() => navigate('/dashboard')}
                    className="p-3 text-muted-foreground hover:text-destructive transition-colors"
                    title="Exit Project"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </nav>
        
        {/* Main content wrapper */}
        <div className="flex-1 min-w-0 h-screen p-3 bg-background">
            <main className="h-full w-full bg-secondary/10 flex flex-col relative overflow-hidden rounded-2xl border border-white/5 shadow-2xl backdrop-blur-3xl">
                <div className="flex-1 overflow-y-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    </div>
  );
}
