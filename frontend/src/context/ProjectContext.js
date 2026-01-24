import React, { createContext, useContext, useMemo } from 'react';
import { useProject, useProjectTasks, useProjectFiles, useProjectDashboard } from '../hooks/useProjectQueries';

const ProjectContext = createContext(null);

/**
 * ProjectProvider - Wraps project pages to share data between routes
 * 
 * Data is fetched once at the layout level and shared with all child pages,
 * eliminating duplicate requests when navigating between Home, Tasks, Files, etc.
 */
export function ProjectProvider({ projectId, token, children }) {
    const projectQuery = useProject(projectId, token);
    const tasksQuery = useProjectTasks(projectId, token);
    const filesQuery = useProjectFiles(projectId, token);
    const dashboardQuery = useProjectDashboard(projectId);

    const value = useMemo(() => ({
        // Data
        project: projectQuery.data,
        readOnly: !!token,
        tasks: tasksQuery.data || [],
        files: filesQuery.data || [],
        dashboard: dashboardQuery.data,
        projectId,
        token,
        baseUrl: token ? `/s/${token}` : `/project/${projectId}`,

        // Loading states
        isLoading: projectQuery.isLoading,
        isLoadingTasks: tasksQuery.isLoading,
        isLoadingFiles: filesQuery.isLoading,
        isLoadingDashboard: dashboardQuery.isLoading,

        // Refetch functions
        refetch: {
            project: projectQuery.refetch,
            tasks: tasksQuery.refetch,
            files: filesQuery.refetch,
            dashboard: dashboardQuery.refetch,
        },
    }), [
        projectQuery.data, projectQuery.isLoading, projectQuery.refetch,
        tasksQuery.data, tasksQuery.isLoading, tasksQuery.refetch,
        filesQuery.data, filesQuery.isLoading, filesQuery.refetch,
        dashboardQuery.data, dashboardQuery.isLoading, dashboardQuery.refetch,
        token
    ]);

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
}

/**
 * useProjectContext - Access shared project data from any child component
 */
export function useProjectContext() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProjectContext must be used within a ProjectProvider');
    }
    return context;
}

export { ProjectContext };
