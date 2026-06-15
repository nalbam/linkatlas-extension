import { QueryClient } from '@tanstack/react-query'

// Bookmarks and analysis results are relatively stable within a session, so we
// favour cache reuse over aggressive refetching.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
