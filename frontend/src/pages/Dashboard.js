import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../authContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// Icons & UI
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

// Hooks
import {
  useDashboard,
  useCreateProject,
  useDeleteProject,
  useAcceptInvite,
  useDeclineInvite
} from '../hooks/useProjectQueries';

// Components
import DashboardSidebar from '../components/DashboardSidebar';
import ProjectsTab from '../components/dashboard/ProjectsTab';
import InboxTab from '../components/dashboard/InboxTab';
import ProfileTab from '../components/dashboard/ProfileTab';
import SettingsTab from '../components/dashboard/SettingsTab';

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('projects');

  // Queries & Mutations
  const { data, isLoading, error } = useDashboard();
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const acceptInviteMutation = useAcceptInvite();
  const declineInviteMutation = useDeclineInvite();

  // Local State
  const [search, setSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createProjectMutation.mutate({ name: newProjectName }, {
      onSuccess: (newProject) => {
        setNewProjectName('');
        setIsExpanded(false);
        toast.success("Project created successfully");
        navigate(`/project/${newProject.id}/onboarding`);
      },
      onError: () => toast.error("Failed to create project")
    });
  };

  const handleDeleteConfirm = () => {
    if (!projectToDelete) return;
    deleteProjectMutation.mutate(projectToDelete.id, {
      onSuccess: () => {
        setProjectToDelete(null);
        toast.success("Project deleted");
      },
      onError: () => toast.error("Failed to delete project")
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success("Signed out successfully");
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white p-6">
        <div className="text-center space-y-4 max-w-md p-8 rounded-3xl bg-red-500/5 border border-red-500/20">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-2xl font-bold">Failed to load dashboard</h2>
          <p className="text-zinc-500">There was an error fetching your data. Please check your connection and try again.</p>
          <Button onClick={() => window.location.reload()} className="bg-white text-black hover:bg-zinc-200 font-bold px-8">
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  // Filter projects for tabs
  const ownedProjects = data?.projects?.filter(p => p.is_owner) || [];
  const sharedProjects = data?.projects?.filter(p => !p.is_owner) || [];

  return (
    <div className="flex h-screen w-screen bg-black overflow-hidden font-sans antialiased text-zinc-200">
      {/* Background Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[160px] pointer-events-none z-0 mix-blend-screen animate-pulse" />
      <div className="fixed bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none z-0 mix-blend-screen" />

      {/* Navigation */}
      <DashboardSidebar
        activeTab={activeTab === 'shared' ? 'shared' : activeTab} // Shared tab shares visual id for sub-projects logic if needed
        activeTabId={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        inboxCount={data?.invites?.length || 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative z-10 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-10 py-8 shrink-0">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {activeTab === 'projects' && 'My Projects'}
              {activeTab === 'shared' && 'Shared with me'}
              {activeTab === 'inbox' && 'Notifications & Inbox'}
              {activeTab === 'profile' && 'User Profile'}
              {activeTab === 'settings' && 'System Settings'}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              {activeTab === 'projects' && `Manage your ${ownedProjects.length} active workspaces.`}
              {activeTab === 'shared' && `Collaborating on ${sharedProjects.length} external projects.`}
              {activeTab === 'inbox' && `You have ${data?.invites?.length || 0} pending invitations.`}
              {activeTab === 'profile' && 'Update your presence and identity info.'}
              {activeTab === 'settings' && 'Adjust workspace and interface behavior.'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Dynamic header actions can go here */}
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-10 pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full"
            >
              {isLoading && activeTab !== 'profile' && activeTab !== 'settings' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[240px] rounded-2xl bg-zinc-900/40 border border-white/5 animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {activeTab === 'projects' && (
                    <ProjectsTab
                      projects={ownedProjects}
                      priorityTasks={data?.priority_tasks || []}
                      search={search}
                      setSearch={setSearch}
                      isExpanded={isExpanded}
                      setIsExpanded={setIsExpanded}
                      newProjectName={newProjectName}
                      setNewProjectName={setNewProjectName}
                      handleCreateProject={handleCreateProject}
                      setProjectToDelete={setProjectToDelete}
                      isOwnerTab={true}
                    />
                  )}
                  {activeTab === 'shared' && (
                    <ProjectsTab
                      projects={sharedProjects}
                      priorityTasks={data?.priority_tasks || []}
                      search={search}
                      setSearch={setSearch}
                      setProjectToDelete={setProjectToDelete}
                      isOwnerTab={false}
                    />
                  )}
                  {activeTab === 'inbox' && (
                    <InboxTab
                      invites={data?.invites || []}
                      onAccept={(token) => acceptInviteMutation.mutateAsync(token)}
                      onDecline={(token) => declineInviteMutation.mutateAsync(token)}
                      isLoading={isLoading}
                    />
                  )}
                  {activeTab === 'profile' && <ProfileTab />}
                  {activeTab === 'settings' && <SettingsTab />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Delete Confirmation */}
      <Dialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete <span className="text-white font-bold">"{projectToDelete?.name}"</span>?
              This action is permanent and will remove all files and documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="ghost" onClick={() => setProjectToDelete(null)} className="rounded-xl border border-white/5 hover:bg-white/5 text-zinc-400">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteProjectMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-500 font-bold"
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
