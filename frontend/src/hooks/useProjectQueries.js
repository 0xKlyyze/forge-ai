import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════════
// QUERY KEYS - Centralized key factory for consistent cache management
// ═══════════════════════════════════════════════════════════════════════════════

export const projectKeys = {
    all: ['projects'],
    lists: () => [...projectKeys.all, 'list'],
    list: (filters) => [...projectKeys.lists(), filters],
    details: () => [...projectKeys.all, 'detail'],
    detail: (id) => [...projectKeys.details(), id],
    files: (id) => [...projectKeys.detail(id), 'files'],
    tasks: (id) => [...projectKeys.detail(id), 'tasks'],
    dashboard: (id) => [...projectKeys.detail(id), 'dashboard'],
    chatSessions: (id) => [...projectKeys.detail(id), 'chat-sessions'],
    chatSession: (id, sessionId) => [...projectKeys.chatSessions(id), sessionId],
};

export const dashboardKeys = {
    all: ['dashboard'],
    main: () => [...dashboardKeys.all, 'main'],
};

export const modelKeys = {
    all: ['models'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useDashboard() {
    return useQuery({
        queryKey: dashboardKeys.main(),
        queryFn: () => api.get('/dashboard')
            .then(res => res.data)
            .catch(err => {
                console.error('[Dashboard Query] Failed:', err.response?.status, err.response?.data);
                throw err;
            }),
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useProject(projectId) {
    return useQuery({
        queryKey: projectKeys.detail(projectId),
        queryFn: () => api.get(`/projects/${projectId}`).then(res => res.data),
        enabled: !!projectId,
    });
}

export function useProjectFiles(projectId) {
    return useQuery({
        queryKey: projectKeys.files(projectId),
        queryFn: () => api.get(`/projects/${projectId}/files`).then(res => res.data),
        enabled: !!projectId,
    });
}

export function useProjectTasks(projectId) {
    return useQuery({
        queryKey: projectKeys.tasks(projectId),
        queryFn: () => api.get(`/projects/${projectId}/tasks`).then(res => res.data),
        enabled: !!projectId,
    });
}

export function useProjectDashboard(projectId) {
    return useQuery({
        queryKey: projectKeys.dashboard(projectId),
        queryFn: () => api.get(`/projects/${projectId}/dashboard`).then(res => res.data),
        enabled: !!projectId,
    });
}

export function useChatSessions(projectId) {
    return useQuery({
        queryKey: projectKeys.chatSessions(projectId),
        queryFn: () => api.get(`/projects/${projectId}/chat-sessions`).then(res => res.data),
        enabled: !!projectId,
    });
}

export function useChatSession(sessionId) {
    return useQuery({
        queryKey: ['chat-session', sessionId],
        queryFn: () => api.get(`/chat-sessions/${sessionId}`).then(res => res.data),
        enabled: !!sessionId,
    });
}

export function useModels() {
    return useQuery({
        queryKey: modelKeys.all,
        queryFn: () => api.get('/models').then(res => res.data),
        staleTime: 5 * 60 * 1000, // Models rarely change, cache for 5 min
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECT MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data) => api.post('/projects', data).then(res => res.data),
        onSuccess: (newProject) => {
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
    });
}

export function useDeleteProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (projectId) => api.delete(`/projects/${projectId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK MUTATIONS (with optimistic updates)
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateTask(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (taskData) => api.post('/tasks', { project_id: projectId, ...taskData }).then(res => res.data),
        onMutate: async (newTask) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.tasks(projectId) });
            const previousTasks = queryClient.getQueryData(projectKeys.tasks(projectId));

            // Optimistically add the new task
            const optimisticTask = {
                id: `temp-${Date.now()}`,
                project_id: projectId,
                status: 'todo',
                priority: 'medium',
                importance: 'medium',
                quadrant: 'q2',
                created_at: new Date().toISOString(),
                ...newTask,
            };

            queryClient.setQueryData(projectKeys.tasks(projectId), old =>
                old ? [optimisticTask, ...old] : [optimisticTask]
            );

            return { previousTasks };
        },
        onError: (err, newTask, context) => {
            queryClient.setQueryData(projectKeys.tasks(projectId), context.previousTasks);
            toast.error("Failed to create task");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
        },
    });
}

export function useUpdateTask(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }) => api.put(`/tasks/${id}`, updates),
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.tasks(projectId) });
            const previousTasks = queryClient.getQueryData(projectKeys.tasks(projectId));

            // Auto-calculate quadrant when priority or importance changes
            let finalUpdates = { ...updates };
            const task = previousTasks?.find(t => t.id === id);
            if (task && (updates.priority !== undefined || updates.importance !== undefined)) {
                const newPriority = updates.priority || task.priority;
                const newImportance = updates.importance || task.importance;
                const isUrgent = newPriority === 'high';
                const isImportant = newImportance === 'high';
                if (isUrgent && isImportant) finalUpdates.quadrant = 'q1';
                else if (!isUrgent && isImportant) finalUpdates.quadrant = 'q2';
                else if (isUrgent && !isImportant) finalUpdates.quadrant = 'q3';
                else finalUpdates.quadrant = 'q4';
            }

            queryClient.setQueryData(projectKeys.tasks(projectId), old =>
                old?.map(t => t.id === id ? { ...t, ...finalUpdates } : t)
            );

            return { previousTasks };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(projectKeys.tasks(projectId), context.previousTasks);
            toast.error("Update failed");
        },
    });
}

export function useDeleteTask(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (taskId) => api.delete(`/tasks/${taskId}`),
        onMutate: async (taskId) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.tasks(projectId) });
            const previousTasks = queryClient.getQueryData(projectKeys.tasks(projectId));

            queryClient.setQueryData(projectKeys.tasks(projectId), old =>
                old?.filter(t => t.id !== taskId)
            );

            return { previousTasks };
        },
        onError: (err, taskId, context) => {
            queryClient.setQueryData(projectKeys.tasks(projectId), context.previousTasks);
            toast.error("Failed to delete task");
        },
        onSuccess: () => {
            toast.success("Task deleted");
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILE MUTATIONS (with optimistic updates)
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateFile(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileData) => api.post('/files', { project_id: projectId, ...fileData }).then(res => res.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.files(projectId) });
        },
    });
}

export function useUpdateFile(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }) => api.put(`/files/${id}`, updates),
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.files(projectId) });
            const previousFiles = queryClient.getQueryData(projectKeys.files(projectId));

            queryClient.setQueryData(projectKeys.files(projectId), old =>
                old?.map(f => f.id === id ? { ...f, ...updates } : f)
            );

            return { previousFiles };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(projectKeys.files(projectId), context.previousFiles);
            toast.error("Update failed");
        },
    });
}

export function useDeleteFile(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (fileId) => api.delete(`/files/${fileId}`),
        onMutate: async (fileId) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.files(projectId) });
            const previousFiles = queryClient.getQueryData(projectKeys.files(projectId));

            queryClient.setQueryData(projectKeys.files(projectId), old =>
                old?.filter(f => f.id !== fileId)
            );

            return { previousFiles };
        },
        onError: (err, fileId, context) => {
            queryClient.setQueryData(projectKeys.files(projectId), context.previousFiles);
            toast.error("Failed to delete file");
        },
        onSuccess: () => {
            toast.success("File deleted");
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SESSION MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCreateChatSession(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => api.post(`/projects/${projectId}/chat-sessions`).then(res => res.data),
        onSuccess: (newSession) => {
            queryClient.setQueryData(projectKeys.chatSessions(projectId), old =>
                old ? [newSession, ...old] : [newSession]
            );
        },
    });
}

export function useDeleteChatSession(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (sessionId) => api.delete(`/chat-sessions/${sessionId}`),
        onMutate: async (sessionId) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.chatSessions(projectId) });
            const previousSessions = queryClient.getQueryData(projectKeys.chatSessions(projectId));

            queryClient.setQueryData(projectKeys.chatSessions(projectId), old =>
                old?.filter(s => s.id !== sessionId)
            );

            return { previousSessions };
        },
        onError: (err, sessionId, context) => {
            queryClient.setQueryData(projectKeys.chatSessions(projectId), context.previousSessions);
            toast.error("Failed to delete conversation");
        },
        onSuccess: () => {
            toast.success("Conversation deleted");
        },
    });
}

export function useUpdateChatSession(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sessionId, updates }) => api.put(`/chat-sessions/${sessionId}`, updates),
        onMutate: async ({ sessionId, updates }) => {
            await queryClient.cancelQueries({ queryKey: projectKeys.chatSessions(projectId) });
            const previousSessions = queryClient.getQueryData(projectKeys.chatSessions(projectId));

            queryClient.setQueryData(projectKeys.chatSessions(projectId), old =>
                old?.map(s => s.id === sessionId ? { ...s, ...updates } : s)
                    .sort((a, b) => {
                        if (a.pinned && !b.pinned) return -1;
                        if (!a.pinned && b.pinned) return 1;
                        return new Date(b.updated_at) - new Date(a.updated_at);
                    })
            );

            return { previousSessions };
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(projectKeys.chatSessions(projectId), context.previousSessions);
        },
    });
}

export function useSendChatMessage(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ sessionId, message, contextMode, referencedFiles, referencedTasks, webSearch, modelPreset, agenticMode = true }) =>
            api.post(`/chat-sessions/${sessionId}/messages`, {
                message,
                context_mode: contextMode,
                referenced_files: referencedFiles,
                referenced_tasks: referencedTasks,
                web_search: webSearch,
                model_preset: modelPreset,
                agentic_mode: agenticMode,
            }).then(res => res.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.chatSessions(projectId) });
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI TOOL EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

export function useExecuteToolCall(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ toolName, arguments: args }) =>
            api.post('/ai/execute-tool', {
                tool_name: toolName,
                arguments: args,
                project_id: projectId,
            }).then(res => res.data),
        onSuccess: (result) => {
            // Invalidate relevant queries based on tool type
            if (result.tool_name === 'create_document' || result.tool_name === 'modify_document') {
                queryClient.invalidateQueries({ queryKey: projectKeys.files(projectId) });
            }
            if (result.tool_name === 'create_tasks' || result.tool_name === 'modify_task') {
                queryClient.invalidateQueries({ queryKey: projectKeys.tasks(projectId) });
            }
        },
        onError: (error) => {
            toast.error(`Tool execution failed: ${error.response?.data?.detail || error.message}`);
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI DOCUMENT EDITING - Multi-step editing with diff preview
// ═══════════════════════════════════════════════════════════════════════════════

export function useEditDocument(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ toolName, fileId, fileName, instructions }) =>
            api.post('/ai/edit-document', {
                tool_name: toolName,
                file_id: fileId,
                file_name: fileName,
                instructions: instructions,
                project_id: projectId,
            }).then(res => res.data),
        onSuccess: () => {
            // Don't invalidate yet - wait for user to accept changes
            // Invalidation happens when user accepts the diff
        },
        onError: (error) => {
            toast.error(`Document edit failed: ${error.response?.data?.detail || error.message}`);
        },
    });
}

// Helper to save accepted changes after diff review
export function useAcceptDocumentChanges(projectId) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ fileId, newContent }) =>
            api.put(`/files/${fileId}`, { content: newContent }).then(res => res.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: projectKeys.files(projectId) });
            toast.success('Changes applied successfully');
        },
        onError: (error) => {
            toast.error(`Failed to save changes: ${error.response?.data?.detail || error.message}`);
        },
    });
}
