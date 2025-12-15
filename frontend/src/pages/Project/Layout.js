import React, { useState } from 'react';
import { 
  Home, 
  FileText, 
  CheckSquare, 
  Settings, 
  ChevronRight 
} from 'lucide-react';
import { Outlet, useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Overview', path: 'home' },
  { id: 'files', icon: FileText, label: 'Workspace', path: 'files' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks', path: 'tasks' },
  { id: 'settings', icon: Settings, label: 'Settings', path: 'settings' }
];

export default function ProjectLayout() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop();

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-16 lg:w-64 border-r border-white/5 bg-secondary/10 flex flex-col items-center lg:items-stretch py-4">
        <div className="px-4 mb-8 flex items-center gap-2">
           <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-mono font-bold">F</div>
           <span className="hidden lg:block font-mono font-bold tracking-tight">FORGE</span>
        </div>
        
        <nav className="flex-1 space-y-1 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.path || (item.path === 'home' && currentPath === projectId);
            return (
              <Link 
                key={item.id} 
                to={`/project/${projectId}/${item.path}`}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                <span className="hidden lg:block">{item.label}</span>
                {isActive && <ChevronRight className="ml-auto h-4 w-4 opacity-50 hidden lg:block" />}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 mt-auto">
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => navigate('/dashboard')}>
                 <span className="hidden lg:inline">Exit Project</span>
                 <span className="lg:hidden">Exit</span>
            </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
         <Outlet />
      </main>
    </div>
  );
}
