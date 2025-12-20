import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Data is considered fresh for 30 seconds
            staleTime: 30 * 1000,
            // Cache is kept for 5 minutes after component unmounts
            gcTime: 5 * 60 * 1000,
            // Refetch when window regains focus
            refetchOnWindowFocus: true,
            // Only retry once on failure
            retry: 1,
            // Don't refetch on mount if data exists and is fresh
            refetchOnMount: false,
        },
    },
});
