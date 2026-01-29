import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Plus, Trash2, CheckCircle2, GripVertical, Target, Calendar, Zap, Archive, ListTodo, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable,
    pointerWithin,
    rectIntersection
} from '@dnd-kit/core';

// Custom collision detection that prioritizes container drop zones (columns/quadrants)
// over individual task cards when dragging
const customCollisionDetection = (args) => {
    const { droppableContainers, active, pointerCoordinates } = args;

    if (!pointerCoordinates || !active) {
        return closestCenter(args);
    }

    // Define container IDs (kanban columns and matrix quadrants)
    const containerIds = ['todo', 'in-progress', 'done', 'q1', 'q2', 'q3', 'q4'];

    // Get all containers and filter to only include our main drop zones
    const containers = droppableContainers.filter(container =>
        containerIds.includes(container.id)
    );

    // Check if pointer is within any container
    for (const container of containers) {
        if (!container.rect.current) continue;

        const { left, right, top, bottom } = container.rect.current;
        const { x, y } = pointerCoordinates;

        if (x >= left && x <= right && y >= top && y <= bottom) {
            // Pointer is within this container, return it as the drop target
            return [{ id: container.id }];
        }
    }

    // Fall back to closest center for other cases
    return closestCenter(args);
};
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SmartInput from '../../components/SmartInput';
import SmartText from '../../components/SmartText';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { useCreateTask, useUpdateTask, useDeleteTask } from '../../hooks/useProjectQueries';
import { TasksSkeleton } from '../../components/skeletons/PageSkeletons';

// Hook to detect mobile viewport
const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    return isMobile;
};

export default function ProjectTasks() {
    const isMobile = useIsMobile();
    const { projectId } = useParams();
    const { tasks, isLoadingTasks, readOnly } = useProjectContext();
    const [activeId, setActiveId] = useState(null);
    const [activeView, setActiveView] = useState('kanban');

    // Mutation hooks with optimistic updates
    const createTaskMutation = useCreateTask(projectId);
    const updateTaskMutation = useUpdateTask(projectId);
    const deleteTaskMutation = useDeleteTask(projectId);

    // Show skeleton while loading
    if (isLoadingTasks) {
        return <TasksSkeleton />;
    }

    const createTask = async (title, options = {}) => {
        if (!title.trim()) return;

        const priority = options.priority || 'medium';
        const importance = options.importance || 'medium';
        const status = options.status || 'todo';
        const difficulty = options.difficulty || 'medium';

        // Auto-calculate quadrant
        let quadrant = 'q2';
        const isUrgent = priority === 'high';
        const isImportant = importance === 'high';
        if (isUrgent && isImportant) quadrant = 'q1';
        else if (!isUrgent && isImportant) quadrant = 'q2';
        else if (isUrgent && !isImportant) quadrant = 'q3';
        else quadrant = 'q4';

        try {
            await createTaskMutation.mutateAsync({
                title,
                priority,
                importance,
                difficulty,
                quadrant: options.quadrant || quadrant,
                status
            });
            toast.success("Task created");
        } catch (error) {
            toast.error("Failed to create task");
        }
    };

    const updateTask = async (id, updates) => {
        try {
            await updateTaskMutation.mutateAsync({ id, updates });
        } catch (error) {
            // Error handling done in mutation hook
        }
    };

    const deleteTask = async (id) => {
        try {
            await deleteTaskMutation.mutateAsync(id);
        } catch (error) {
            // Error handling done in mutation hook
        }
    };

    const toggleDone = (task) => {
        const newStatus = task.status === 'done' ? 'todo' : 'done';
        updateTask(task.id, { status: newStatus });
    };

    // DnD
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event) => {
        if (readOnly) return;
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const taskId = active.id;
        const task = tasks.find(t => t.id === taskId);
        const containerId = over.id;

        if (['todo', 'in-progress', 'done'].includes(containerId) && task.status !== containerId) {
            updateTask(taskId, { status: containerId });
        }
        if (['q1', 'q2', 'q3', 'q4'].includes(containerId) && task.quadrant !== containerId) {
            // Map quadrant to priority/importance for consistency
            const quadrantMap = {
                q1: { priority: 'high', importance: 'high' },
                q2: { priority: 'low', importance: 'high' },
                q3: { priority: 'high', importance: 'low' },
                q4: { priority: 'low', importance: 'low' }
            };
            updateTask(taskId, { quadrant: containerId, ...quadrantMap[containerId] });
        }
    };

    const activeTask = tasks.find(t => t.id === activeId);

    // Stats
    const todoCount = tasks.filter(t => t.status === 'todo').length;
    const inProgressCount = tasks.filter(t => t.status === 'in-progress').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    return (
        <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 p-3 md:p-6 lg:px-8 lg:pt-8 pb-3 border-b border-white/5">
                    <div className="flex flex-row items-center justify-between gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">Mission Control</h1>
                            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                                <span className="text-primary">{todoCount}</span> <span className="hidden xs:inline">to do</span><span className="xs:hidden">do</span> · <span className="text-accent">{inProgressCount}</span> <span className="hidden xs:inline">in progress</span><span className="xs:hidden">prog</span> · <span className="text-green-500">{doneCount}</span> <span className="hidden xs:inline">done</span><span className="xs:hidden">ok</span>
                            </p>
                        </div>

                        {/* View Switcher with animated sliding pill */}
                        {(() => {
                            const views = [
                                { id: 'kanban', icon: LayoutGrid, label: 'Board' },
                                { id: 'matrix', icon: Target, label: 'Matrix' },
                                { id: 'list', icon: List, label: 'List' }
                            ];
                            const activeIndex = views.findIndex(v => v.id === activeView);

                            return (
                                <div className="relative flex items-center gap-1 bg-secondary/30 rounded-2xl p-1">
                                    {/* Animated background pill */}
                                    <div
                                        className="absolute h-[calc(100%-8px)] rounded-xl bg-primary shadow-lg transition-all duration-300 ease-out"
                                        style={{
                                            width: `calc(${100 / views.length}% - 4px)`,
                                            left: `calc(${activeIndex * (100 / views.length)}% + 4px)`,
                                        }}
                                    />
                                    {views.map((view, index) => {
                                        const ViewIcon = view.icon;
                                        return (
                                            <button
                                                key={view.id}
                                                onClick={() => setActiveView(view.id)}
                                                className={`relative z-10 flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-200 ${activeView === view.id
                                                    ? 'text-primary-foreground'
                                                    : 'text-muted-foreground hover:text-foreground'
                                                    }`}
                                            >
                                                <ViewIcon className={`h-4 w-4 transition-transform duration-200 ${activeView === view.id ? 'scale-110' : ''}`} />
                                                <span className="hidden sm:inline">{view.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Content - Add fade animation for view transitions */}
                <div className="flex-1 min-h-0 overflow-hidden p-4 md:p-6 lg:p-8 pt-2 md:pt-4 pb-20 md:pb-6 lg:pb-8">
                    <div key={activeView} className="h-full animate-in fade-in duration-200">
                        {activeView === 'kanban' && (
                            <div className="flex sm:grid sm:grid-cols-3 gap-4 h-full overflow-x-auto sm:overflow-x-visible snap-x snap-mandatory pb-4 no-scrollbar touch-pan-x">
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <KanbanColumn
                                        id="todo"
                                        title="To Do"
                                        icon={ListTodo}
                                        tasks={tasks.filter(t => t.status === 'todo')}
                                        onCreateTask={(title) => createTask(title, { status: 'todo' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <KanbanColumn
                                        id="in-progress"
                                        title="In Progress"
                                        icon={Zap}
                                        accentColor="accent"
                                        tasks={tasks.filter(t => t.status === 'in-progress')}
                                        onCreateTask={(title) => createTask(title, { status: 'in-progress' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <KanbanColumn
                                        id="done"
                                        title="Done"
                                        icon={CheckCircle2}
                                        accentColor="green"
                                        tasks={tasks.filter(t => t.status === 'done')}
                                        onCreateTask={(title) => createTask(title, { status: 'done' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                            </div>
                        )}

                        {activeView === 'matrix' && (
                            <div className="flex sm:grid sm:grid-cols-2 gap-4 h-full overflow-x-auto sm:overflow-x-visible snap-x snap-mandatory pb-4 no-scrollbar touch-pan-x">
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <MatrixQuadrant
                                        id="q1"
                                        title="Do First"
                                        subtitle="Urgent & Important"
                                        color="red"
                                        tasks={tasks.filter(t => t.quadrant === 'q1' && t.status !== 'done')}
                                        onCreateTask={(title) => createTask(title, { quadrant: 'q1', priority: 'high', importance: 'high' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <MatrixQuadrant
                                        id="q2"
                                        title="Schedule"
                                        subtitle="Important, Not Urgent"
                                        color="blue"
                                        tasks={tasks.filter(t => t.quadrant === 'q2' && t.status !== 'done')}
                                        onCreateTask={(title) => createTask(title, { quadrant: 'q2', priority: 'low', importance: 'high' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <MatrixQuadrant
                                        id="q3"
                                        title="Delegate"
                                        subtitle="Urgent, Not Important"
                                        color="amber"
                                        tasks={tasks.filter(t => t.quadrant === 'q3' && t.status !== 'done')}
                                        onCreateTask={(title) => createTask(title, { quadrant: 'q3', priority: 'high', importance: 'low' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                                <div className="w-[85vw] max-w-[85vw] sm:w-auto sm:max-w-none sm:min-w-0 h-full snap-center flex-shrink-0">
                                    <MatrixQuadrant
                                        id="q4"
                                        title="Eliminate"
                                        subtitle="Neither Urgent nor Important"
                                        color="gray"
                                        tasks={tasks.filter(t => t.quadrant === 'q4' && t.status !== 'done')}
                                        onCreateTask={(title) => createTask(title, { quadrant: 'q4', priority: 'low', importance: 'low' })}
                                        onToggle={toggleDone}
                                        onDelete={deleteTask}
                                        onUpdate={updateTask}
                                        isDragging={!!activeId}
                                    />
                                </div>
                            </div>
                        )}

                        {activeView === 'list' && (
                            <ListView
                                tasks={tasks.filter(t => t.status !== 'done')}
                                onToggle={toggleDone}
                                onDelete={deleteTask}
                                onUpdate={updateTask}
                                onCreateTask={createTask}
                            />
                        )}
                    </div>
                </div>

                <DragOverlay>
                    {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KANBAN COLUMN
// ═══════════════════════════════════════════════════════════════════════════════

function KanbanColumn({ id, title, icon: Icon, accentColor = 'primary', tasks, onCreateTask, onToggle, onDelete, onUpdate, isDragging }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const { readOnly } = useProjectContext();
    const [quickAdd, setQuickAdd] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef(null);

    const handleQuickAdd = (e) => {
        e.preventDefault();
        if (quickAdd.trim()) {
            onCreateTask(quickAdd);
            setQuickAdd('');
        }
        setIsAdding(false);
    };

    const colorClasses = {
        primary: 'text-primary border-primary/30',
        accent: 'text-accent border-accent/30',
        green: 'text-green-500 border-green-500/30'
    };

    const dropZoneColors = {
        primary: 'border-primary bg-primary/10',
        accent: 'border-accent bg-accent/10',
        green: 'border-green-500 bg-green-500/10'
    };

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-2xl bg-secondary/20 border transition-all duration-200 h-full overflow-hidden ${isOver
                ? 'border-primary ring-2 ring-primary/30 bg-primary/10 scale-[1.02]'
                : isDragging
                    ? 'border-primary/30 border-dashed'
                    : 'border-white/10'
                }`}
        >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${colorClasses[accentColor].split(' ')[0]}`} />
                        <span className="font-semibold text-sm">{title}</span>
                        <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{tasks.length}</span>
                    </div>
                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:bg-white/10"
                            onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Quick Add */}
                {isAdding && (
                    <form onSubmit={handleQuickAdd} className="mt-3">
                        <Input
                            ref={inputRef}
                            value={quickAdd}
                            onChange={(e) => setQuickAdd(e.target.value)}
                            placeholder="Task name..."
                            className="h-9 text-sm bg-background/50 border-white/10 rounded-xl"
                            onBlur={() => { if (!quickAdd.trim()) setIsAdding(false); }}
                            onKeyDown={(e) => { if (e.key === 'Escape') setIsAdding(false); }}
                        />
                    </form>
                )}
            </div>

            {/* Tasks */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <div className="space-y-2">
                    {/* Drop Zone Indicator - appears at TOP when dragging */}
                    {isDragging ? (
                        <div
                            className={`flex items-center justify-center py-6 px-4 rounded-xl border-2 border-dashed transition-all duration-300 ${isOver
                                ? `${dropZoneColors[accentColor]} scale-105`
                                : 'border-white/20 bg-white/5'
                                }`}
                        >
                            <div className={`flex items-center gap-2 text-sm font-medium transition-colors duration-200 ${isOver ? colorClasses[accentColor].split(' ')[0] : 'text-muted-foreground'
                                }`}>
                                <Plus className={`h-4 w-4 transition-transform duration-200 ${isOver ? 'scale-125' : ''}`} />
                                <span>{isOver ? 'Drop here' : 'Drop to move here'}</span>
                            </div>
                        </div>
                    ) : (
                        /* Always visible inline add at TOP - hide when dragging or readOnly */
                        !readOnly && (
                            <InlineTaskAdd
                                onAdd={onCreateTask}
                                placeholder={tasks.length === 0 ? 'Add your first task...' : 'Add another task...'}
                            />
                        )
                    )}

                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onToggle={() => onToggle(task)}
                            onDelete={() => onDelete(task.id)}
                            onUpdate={onUpdate}
                        />
                    ))}
                </div>
            </div>
        </div >
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MATRIX QUADRANT
// ═══════════════════════════════════════════════════════════════════════════════

function MatrixQuadrant({ id, title, subtitle, color, tasks, onCreateTask, onToggle, onDelete, onUpdate, isDragging }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    const { readOnly } = useProjectContext();
    const [quickAdd, setQuickAdd] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef(null);

    const handleQuickAdd = (e) => {
        e.preventDefault();
        if (quickAdd.trim()) {
            onCreateTask(quickAdd);
            setQuickAdd('');
        }
        setIsAdding(false);
    };

    const colorStyles = {
        red: 'border-red-500/30 bg-red-500/5',
        blue: 'border-primary/30 bg-primary/5',
        amber: 'border-amber-500/30 bg-amber-500/5',
        gray: 'border-white/10 bg-secondary/30'
    };

    const colorStylesActive = {
        red: 'border-red-500 ring-2 ring-red-500/30 bg-red-500/15',
        blue: 'border-primary ring-2 ring-primary/30 bg-primary/15',
        amber: 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/15',
        gray: 'border-white/50 ring-2 ring-white/20 bg-white/10'
    };

    const colorStylesDragging = {
        red: 'border-red-500/50 border-dashed',
        blue: 'border-primary/50 border-dashed',
        amber: 'border-amber-500/50 border-dashed',
        gray: 'border-white/30 border-dashed'
    };

    const dropZoneColors = {
        red: 'border-red-500 bg-red-500/10 text-red-400',
        blue: 'border-primary bg-primary/10 text-primary',
        amber: 'border-amber-500 bg-amber-500/10 text-amber-400',
        gray: 'border-white/40 bg-white/10 text-white/70'
    };

    const headerColors = {
        red: 'text-red-400',
        blue: 'text-primary',
        amber: 'text-amber-400',
        gray: 'text-muted-foreground'
    };

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-2xl border transition-all duration-200 h-full min-h-[280px] ${isOver
                ? `${colorStylesActive[color]} scale-[1.02]`
                : isDragging
                    ? colorStylesDragging[color]
                    : colorStyles[color]
                }`}
        >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className={`font-bold text-sm uppercase tracking-wide ${headerColors[color]}`}>{title}</h3>
                        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
                    </div>

                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-lg hover:bg-white/10"
                            onClick={() => { setIsAdding(true); setTimeout(() => inputRef.current?.focus(), 0); }}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {isAdding && (
                    <form onSubmit={handleQuickAdd} className="mt-3">
                        <Input
                            ref={inputRef}
                            value={quickAdd}
                            onChange={(e) => setQuickAdd(e.target.value)}
                            placeholder="Task name..."
                            className="h-9 text-sm bg-background/50 border-white/10 rounded-xl"
                            onBlur={() => { if (!quickAdd.trim()) setIsAdding(false); }}
                            onKeyDown={(e) => { if (e.key === 'Escape') setIsAdding(false); }}
                        />
                    </form>
                )}
            </div>

            {/* Tasks */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <div className="space-y-2">
                    {/* Drop Zone Indicator - appears at TOP when dragging */}
                    {isDragging ? (
                        <div
                            className={`flex items-center justify-center py-4 px-3 rounded-xl border-2 border-dashed transition-all duration-300 ${isOver
                                ? `${dropZoneColors[color]} scale-105`
                                : 'border-white/20 bg-white/5 text-muted-foreground'
                                }`}
                        >
                            <div className={`flex items-center gap-2 text-xs font-medium transition-all duration-200`}>
                                <Plus className={`h-3 w-3 transition-transform duration-200 ${isOver ? 'scale-125' : ''}`} />
                                <span>{isOver ? 'Drop here' : 'Drop to move'}</span>
                            </div>
                        </div>
                    ) : (
                        /* Always visible inline add at TOP - hide when dragging */
                        !readOnly && (
                            <InlineTaskAdd
                                onAdd={onCreateTask}
                                placeholder="Add task..."
                                compact
                            />
                        )
                    )}

                    {tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onToggle={() => onToggle(task)}
                            onDelete={() => onDelete(task.id)}
                            onUpdate={onUpdate}
                            compact
                        />
                    ))}
                </div>
            </div>
        </div >
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════════════════════════════════════


function ListView({ tasks, onToggle, onDelete, onUpdate, onCreateTask }) {
    const { readOnly } = useProjectContext();
    const [quickAdd, setQuickAdd] = useState('');
    const [sortBy, setSortBy] = useState('newest'); // newest, priority, importance, difficulty

    const handleQuickAdd = (e) => {
        e.preventDefault();
        if (quickAdd.trim()) {
            onCreateTask(quickAdd);
            setQuickAdd('');
        }
    };

    const getSortedTasks = () => {
        const sorted = [...tasks];
        const levels = { high: 3, medium: 2, low: 1 };

        switch (sortBy) {
            case 'priority':
                return sorted.sort((a, b) => (levels[b.priority] || 0) - (levels[a.priority] || 0));
            case 'importance':
                return sorted.sort((a, b) => (levels[b.importance] || 0) - (levels[a.importance] || 0));
            case 'difficulty':
                return sorted.sort((a, b) => (levels[b.difficulty] || 0) - (levels[a.difficulty] || 0));
            case 'newest':
            default:
                // Assuming new tasks are at top (prepended), so index order or created_at?
                // created_at string comparison is usually fine for ISO strings
                return sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }
    };

    const sortedTasks = getSortedTasks();

    const SortButton = ({ id, label }) => (
        <button
            onClick={() => setSortBy(id)}
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${sortBy === id
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="h-full flex flex-col sm:rounded-2xl sm:bg-secondary/20 sm:border sm:border-white/10 overflow-hidden">
            {/* Quick Add */}
            {!readOnly && (
                <form onSubmit={handleQuickAdd} className="flex-shrink-0 p-4 border-b border-white/5">
                    <div className="flex gap-2">
                        <Input
                            value={quickAdd}
                            onChange={(e) => setQuickAdd(e.target.value)}
                            placeholder="Add a new task..."
                            className="flex-1 h-10 bg-background/50 border-white/10 rounded-xl"
                        />
                        <Button type="submit" className="h-10 px-4 rounded-xl" disabled={!quickAdd.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                        </Button>
                    </div>
                </form>
            )}

            {/* Header - with Sort Controls */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                    <span className="ml-1">Tasks</span>
                    <span className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{tasks.length}</span>
                </div>

                <div className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground mr-1" />
                    <SortButton id="newest" label="Newest" />
                    <SortButton id="priority" label="Priority" />
                    <SortButton id="importance" label="Importance" />
                    <SortButton id="difficulty" label="Difficulty" />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="divide-y divide-white/5">
                    {sortedTasks.map(task => (
                        <ListItem
                            key={task.id}
                            task={task}
                            onToggle={() => onToggle(task)}
                            onDelete={() => onDelete(task.id)}
                            onUpdate={onUpdate}
                        />
                    ))}
                    {tasks.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground">
                            <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No tasks yet</p>
                            <p className="text-xs">Add one above to get started</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ListItem({ task, onToggle, onDelete, onUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(task.title);

    const handleSave = () => {
        if (editValue.trim() && editValue !== task.title) {
            onUpdate(task.id, { title: editValue });
        }
        setIsEditing(false);
    };

    const cyclePriority = (e) => {
        e?.stopPropagation();
        const cycle = { low: 'medium', medium: 'high', high: 'low' };
        onUpdate(task.id, { priority: cycle[task.priority] || 'medium' });
    };

    const cycleImportance = (e) => {
        e?.stopPropagation();
        const cycle = { low: 'medium', medium: 'high', high: 'low' };
        onUpdate(task.id, { importance: cycle[task.importance] || 'medium' });
    };

    const cycleDifficulty = (e) => {
        e?.stopPropagation();
        const cycle = { low: 'medium', medium: 'high', high: 'low' };
        onUpdate(task.id, { difficulty: cycle[task.difficulty] || 'medium' });
    };

    return (
        <div className={`hover:bg-white/5 transition-colors group ${task.status === 'done' ? 'opacity-50' : ''}`}>
            <div className="flex sm:grid sm:grid-cols-12 px-4 py-3 items-start gap-3 sm:gap-0">
                {/* Checkbox */}
                <div className="sm:col-span-1 pt-0.5 flex-shrink-0">
                    <button onClick={onToggle} className="p-1">
                        {task.status === 'done'
                            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                            : <div className="h-5 w-5 rounded-full border-2 border-muted-foreground hover:border-primary transition-colors" />
                        }
                    </button>
                </div>

                {/* Main Content (Title + Chips + Notes) */}
                <div className="flex-1 sm:col-span-8 md:col-span-9 pr-4 min-w-0">
                    {isEditing ? (
                        <div>
                            <SmartInput
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
                                className="h-8 text-sm bg-transparent border-white/10 w-full"
                                autoFocus
                            />
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                <button onClick={cyclePriority} title="Priority"><PriorityBadge priority={task.priority} label="P" clickable /></button>
                                <button onClick={cycleImportance} title="Importance"><ImportanceBadge importance={task.importance} clickable /></button>
                                <button onClick={cycleDifficulty} title="Difficulty"><DifficultyBadge difficulty={task.difficulty} clickable /></button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div
                                onClick={() => setIsEditing(true)}
                                className={`text-left text-sm font-medium w-full cursor-text ${task.status === 'done' ? 'line-through' : ''}`}
                            >
                                <div className="break-words mb-1">
                                    <SmartText text={task.title} className="inline" />
                                </div>

                                {/* Inline Tags */}
                                <div className="flex flex-wrap items-center gap-1.5 align-middle">
                                    <button onClick={cyclePriority} title="Priority" className="inline-flex"><PriorityBadge priority={task.priority} label="P" clickable /></button>
                                    <button onClick={cycleImportance} title="Importance" className="inline-flex"><ImportanceBadge importance={task.importance} clickable /></button>
                                    <button onClick={cycleDifficulty} title="Difficulty" className="inline-flex"><DifficultyBadge difficulty={task.difficulty} clickable /></button>

                                    {/* Status Badge (Desktop inline-ish/Mobile fallback) */}
                                    <span className={`sm:hidden text-[9px] font-medium uppercase px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground`}>
                                        {task.status.replace('-', ' ')}
                                    </span>
                                </div>
                            </div>

                            {/* Notes in List View */}
                            <div className="pl-0">
                                <TaskNotes task={task} onUpdate={onUpdate} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop Status Column */}
                <div className="hidden sm:block sm:col-span-2 pt-1.5">
                    <span className={`text-[10px] font-medium uppercase px-2 py-1 rounded-lg ${task.status === 'todo' ? 'bg-muted text-muted-foreground' :
                        task.status === 'in-progress' ? 'bg-accent/20 text-accent' :
                            'bg-green-500/20 text-green-500'
                        }`}>
                        {task.status.replace('-', ' ')}
                    </span>
                </div>

                {/* Delete */}
                <div className="sm:col-span-1 text-right pt-0.5 flex-shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-500 transition-all"
                        onClick={() => onDelete(task.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK CARD
// ═══════════════════════════════════════════════════════════════════════════════

function TaskCard({ task, onToggle, onDelete, onUpdate, isOverlay, compact }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const { readOnly } = useProjectContext();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(task.title);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const handleSave = () => {
        if (editValue.trim() && editValue !== task.title) {
            onUpdate?.(task.id, { title: editValue });
        }
        setIsEditing(false);
    };

    const cyclePriority = (e) => {
        e.stopPropagation();
        const cycle = { low: 'medium', medium: 'high', high: 'low' };
        onUpdate?.(task.id, { priority: cycle[task.priority] || 'medium' });
    };

    const cycleImportance = (e) => {
        e.stopPropagation();
        const cycle = { low: 'medium', medium: 'high', high: 'low' };
        onUpdate?.(task.id, { importance: cycle[task.importance] || 'medium' });
    };

    const cycleDifficulty = (e) => {
        e.stopPropagation();
        const cycle = { low: 'medium', medium: 'high', high: 'low' };
        onUpdate?.(task.id, { difficulty: cycle[task.difficulty] || 'medium' });
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            className={`
        border-white/10 hover:border-primary/30 transition-all cursor-grab active:cursor-grabbing group
        ${task.status === 'done' ? 'opacity-50 bg-secondary/20' : 'bg-secondary/40'}
        ${isDragging ? 'opacity-50 scale-105' : ''}
        ${isOverlay ? 'shadow-2xl shadow-black/50 rotate-2' : ''}
      `}
        >
            <CardContent className={compact ? 'p-2' : 'p-3'}>
                <div className="flex items-start gap-2">
                    {/* Drag Handle */}
                    {!readOnly && (
                        <div
                            {...attributes}
                            {...listeners}
                            className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-white/10 transition-colors touch-none"
                            title="Drag to move"
                        >
                            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                    )}

                    {/* Checkbox */}
                    {onToggle && (
                        <button
                            className={`mt-0.5 flex-shrink-0 ${readOnly ? 'cursor-default' : ''}`}
                            onClick={(e) => { e.stopPropagation(); if (!readOnly) onToggle(); }}
                        >
                            {task.status === 'done'
                                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground hover:border-green-500 hover:bg-green-500/20 transition-all" />
                            }
                        </button>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <div>
                                <SmartInput
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSave();
                                        if (e.key === 'Escape') { setEditValue(task.title); setIsEditing(false); }
                                    }}
                                    className="h-6 text-sm p-0 bg-transparent border-0 border-b border-primary/50 rounded-none focus-visible:ring-0 w-full"
                                    autoFocus
                                />
                                <div className="flex gap-1.5 mt-1.5">
                                    <button onClick={cyclePriority} onPointerDown={(e) => e.stopPropagation()} title="Priority">
                                        <PriorityBadge priority={task.priority} label="P" clickable />
                                    </button>
                                    <button onClick={cycleImportance} onPointerDown={(e) => e.stopPropagation()} title="Importance">
                                        <ImportanceBadge importance={task.importance} clickable />
                                    </button>
                                    <button onClick={cycleDifficulty} onPointerDown={(e) => e.stopPropagation()} title="Difficulty">
                                        <DifficultyBadge difficulty={task.difficulty} clickable />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => !readOnly && onUpdate && setIsEditing(true)}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={`text-left text-sm font-medium w-full ${!readOnly ? 'cursor-text' : ''} ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
                            >
                                <div className="break-words mb-1.5">
                                    <SmartText text={task.title} className="inline" />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        onClick={cyclePriority}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        title="Click to change priority"
                                        className="inline-flex"
                                    >
                                        <PriorityBadge priority={task.priority} label="P" clickable />
                                    </button>
                                    <button
                                        onClick={cycleImportance}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        title="Click to change importance"
                                        className="inline-flex"
                                    >
                                        <ImportanceBadge importance={task.importance} clickable />
                                    </button>
                                    <button
                                        onClick={cycleDifficulty}
                                        onPointerDown={(e) => e.stopPropagation()}
                                        title="Click to change difficulty"
                                        className="inline-flex"
                                    >
                                        <DifficultyBadge difficulty={task.difficulty} clickable />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Notes Section */}
                        <TaskNotes
                            task={task}
                            onUpdate={onUpdate}
                            isOverlay={isOverlay}
                        />

                        {!compact && (
                            /* Quick Priority & Importance Toggles - Only show in full view if needed, or keep them? 
                               User asked for "notes and smart references". 
                               The code I see in line 733 in previous view showed TaskNotes inside !compact.
                               Let's just remove the condition.
                            */
                            null
                        )}
                    </div>

                    {/* Delete - Bigger and more visible */}
                    {onDelete && !readOnly && (
                        <button
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/0 hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-all"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            title="Delete task"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function TaskNotes({ task, onUpdate, isOverlay }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [noteValue, setNoteValue] = useState(task.description || '');
    const [showFullNotes, setShowFullNotes] = useState(false);

    const hasNotes = !!task.description;
    const MAX_LENGTH = 120;
    const isLong = task.description && task.description.length > MAX_LENGTH;

    const handleSave = () => {
        if (noteValue !== task.description) {
            onUpdate?.(task.id, { description: noteValue });
        }
        setIsEditing(false);
    };

    if (isOverlay) return null; // Don't show complex notes in drag overlay

    return (
        <div className="mt-2" onPointerDown={(e) => e.stopPropagation()}>
            {!isExpanded && !hasNotes ? (
                <button
                    onClick={() => { setIsExpanded(true); setIsEditing(true); }}
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                    <Plus className="h-3 w-3" /> Add notes
                </button>
            ) : (
                <div className="text-xs">
                    {!isEditing ? (
                        <div className="group/notes cursor-pointer">
                            <div
                                onClick={() => setIsEditing(true)}
                                className="text-muted-foreground/80 hover:text-foreground transition-colors inline"
                            >
                                <SmartText
                                    text={!showFullNotes && isLong ? task.description.slice(0, MAX_LENGTH) + '...' : task.description}
                                    className="inline"
                                />
                                {isLong && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowFullNotes(!showFullNotes); }}
                                        className="text-[10px] text-primary hover:underline ml-1 inline font-medium align-baseline"
                                    >
                                        {showFullNotes ? 'Show less' : 'Show more'}
                                    </button>
                                )}
                            </div>
                            {!task.description && <span className="text-muted-foreground italic" onClick={() => setIsEditing(true)}>Empty notes...</span>}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <SmartInput
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSave();
                                    }
                                    if (e.key === 'Escape') {
                                        setIsEditing(false);
                                        setNoteValue(task.description || '');
                                        if (!task.description) setIsExpanded(false);
                                    }
                                }}
                                className="w-full text-xs bg-black/20 border-white/10 rounded-lg min-h-[60px] p-2 align-top"
                                placeholder="Add notes... (@ to reference files)"
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => { setIsEditing(false); setNoteValue(task.description || ''); if (!task.description) setIsExpanded(false); }} className="text-[10px] hover:underline">Cancel</button>
                                <button onClick={handleSave} className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded hover:bg-primary/30">Save</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Always visible inline task add
function InlineTaskAdd({ onAdd, placeholder = 'Add a task...', compact = false }) {
    const [value, setValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (value.trim()) {
            onAdd(value);
            setValue('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-2 text-left">
            <div className={`flex items-center gap-2 rounded-xl border transition-all ${isFocused ? 'border-primary/50 bg-primary/5' : 'border-dashed border-white/10 hover:border-white/20'
                } ${compact ? 'p-1.5' : 'p-2'}`}>
                <Plus className={`flex-shrink-0 text-muted-foreground ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
                <SmartInput
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    placeholder={placeholder}
                    className={`flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50 border-none h-auto p-0 focus-visible:ring-0 ${compact ? 'text-xs' : 'text-sm'}`}
                />
                {value.trim() && (
                    <Button type="submit" size="sm" className={`rounded-lg ${compact ? 'h-6 px-2 text-xs' : 'h-7 px-3'}`}>
                        Add
                    </Button>
                )}
            </div>
        </form>
    );
}

function PriorityBadge({ priority, label, clickable }) {
    const colors = {
        high: 'bg-red-500/20 text-red-400 border-red-500/30',
        medium: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        low: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };

    const fullLabel = priority.charAt(0).toUpperCase() + priority.slice(1);

    return (
        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border transition-all ${colors[priority]} ${clickable ? 'cursor-pointer hover:opacity-80 hover:scale-105' : ''}`}>
            {label ? `${label}:${fullLabel}` : fullLabel}
        </span>
    );
}

function ImportanceBadge({ importance, clickable }) {
    const colors = {
        high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        medium: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        low: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };

    const fullLabel = importance.charAt(0).toUpperCase() + importance.slice(1);

    return (
        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border transition-all ${colors[importance]} ${clickable ? 'cursor-pointer hover:opacity-80 hover:scale-105' : ''}`}>
            I:{fullLabel}
        </span>
    );
}

function DifficultyBadge({ difficulty, clickable }) {
    const colors = {
        high: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        medium: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        low: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    };

    const fullLabel = (difficulty || 'medium').charAt(0).toUpperCase() + (difficulty || 'medium').slice(1);

    return (
        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border transition-all ${colors[difficulty || 'medium']} ${clickable ? 'cursor-pointer hover:opacity-80 hover:scale-105' : ''}`}>
            D:{fullLabel}
        </span>
    );
}
