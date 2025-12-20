import { Skeleton } from '../ui/skeleton';

export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="container mx-auto px-6 py-12 relative z-10 max-w-7xl">
                {/* Header Skeleton */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-14 w-14 rounded-xl" />
                        <div>
                            <Skeleton className="h-8 w-32 mb-2" />
                            <Skeleton className="h-4 w-48" />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Skeleton className="h-10 w-80 rounded-lg" />
                    </div>
                </div>

                {/* Hero Skeleton */}
                <Skeleton className="h-48 w-full rounded-2xl mb-8" />

                {/* Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-56 rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ProjectHomeSkeleton() {
    return (
        <div className="h-full overflow-y-auto">
            <div className="relative p-6 lg:p-8 space-y-5 pb-28">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <div>
                        <Skeleton className="h-7 w-48 mb-2" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>

                {/* Hero Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-8">
                        <Skeleton className="h-44 w-full rounded-3xl" />
                    </div>
                    <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-3">
                        <Skeleton className="h-20 rounded-xl" />
                        <Skeleton className="h-20 rounded-xl" />
                    </div>
                </div>

                {/* Focus Row */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-8">
                        <Skeleton className="h-16 rounded-2xl" />
                    </div>
                    <div className="lg:col-span-4 flex gap-2">
                        <Skeleton className="flex-1 h-16 rounded-xl" />
                        <Skeleton className="flex-1 h-16 rounded-xl" />
                        <Skeleton className="flex-1 h-16 rounded-xl" />
                    </div>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                    <Skeleton className="h-64 rounded-xl" />
                </div>

                {/* Pinned */}
                <Skeleton className="h-36 rounded-xl" />
            </div>
        </div>
    );
}

export function TasksSkeleton() {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-6 lg:px-8 lg:pt-8 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-64" />
                    </div>
                    <Skeleton className="h-10 w-64 rounded-2xl" />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6 lg:p-8 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex flex-col rounded-2xl bg-secondary/20 border border-white/10 h-full">
                            <div className="p-4 border-b border-white/5">
                                <Skeleton className="h-6 w-32" />
                            </div>
                            <div className="flex-1 p-3 space-y-2">
                                {[...Array(4)].map((_, j) => (
                                    <Skeleton key={j} className="h-20 rounded-xl" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ChatSkeleton() {
    return (
        <div className="h-full flex bg-background/50 relative">
            {/* Sidebar */}
            <div className="w-72 flex-shrink-0 border-r border-white/5 bg-black/30 backdrop-blur-sm">
                <div className="p-4 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-8 w-16 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                            <Skeleton key={i} className="h-16 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto pb-40">
                    <div className="max-w-4xl mx-auto p-4 pt-14 space-y-6">
                        <div className="flex flex-col items-center justify-center py-20">
                            <Skeleton className="h-20 w-20 rounded-3xl mb-6" />
                            <Skeleton className="h-8 w-64 mb-4" />
                            <Skeleton className="h-4 w-96 mb-8" />
                            <div className="space-y-2 w-full max-w-md">
                                <Skeleton className="h-14 rounded-2xl" />
                                <Skeleton className="h-14 rounded-2xl" />
                                <Skeleton className="h-14 rounded-2xl" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 p-6 pt-0">
                    <div className="max-w-3xl mx-auto">
                        <Skeleton className="h-12 rounded-t-2xl" />
                        <Skeleton className="h-14 rounded-b-2xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FilesSkeleton() {
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-6 lg:px-8 lg:pt-8 pb-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-40 mb-2" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-64 rounded-lg" />
                        <Skeleton className="h-10 w-24 rounded-xl" />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 px-6 lg:px-8 py-3 border-b border-white/5">
                <div className="flex gap-6">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-5 w-20" />
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-auto p-6 lg:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-44 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
