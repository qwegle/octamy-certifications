import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.error || text;
    } catch {
      // Plain-text response; use it as-is.
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options: { headers?: Record<string, string> } = {},
): Promise<Response> {
  // Use appropriate token based on route type
  const isAdminContext = typeof window !== "undefined" && (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/qwegle') || window.location.pathname.startsWith('/enhanced-admin'));
  const isAdminRoute = url.includes('/admin') || isAdminContext;
  const isRecruiterRoute = url.includes('/recruiter');
  
  let token: string | null = null;
  if (isAdminRoute) {
    token = localStorage.getItem('adminToken');
  } else if (isRecruiterRoute) {
    token = localStorage.getItem('recruiterToken');
  } else {
    token = localStorage.getItem('token');
  }
    
  const headers: Record<string, string> = { ...options.headers };
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle authentication errors
  if (res.status === 401) {
    const responseData = await res.clone().json().catch(() => null);
    if (responseData?.code === "TOKEN_EXPIRED" || responseData?.code === "INVALID_TOKEN") {
        if (isRecruiterRoute) {
          localStorage.removeItem('recruiterToken');
          localStorage.removeItem('recruiterData');
          if (!window.location.pathname.includes('/recruiter/auth')) {
            window.location.href = '/recruiter/auth';
          }
        } else if (isAdminRoute) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          if (!window.location.pathname.includes('/admin-login')) {
            window.location.href = '/admin-login';
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
        throw new Error("Session expired. Please login again.");
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const isAdminContext = typeof window !== "undefined" && (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/qwegle') || window.location.pathname.startsWith('/enhanced-admin'));
    const isAdminRoute = url.includes('/admin') || isAdminContext;
    const isRecruiterRoute = url.includes('/recruiter');
    const token = isAdminRoute
      ? localStorage.getItem('adminToken')
      : isRecruiterRoute
        ? localStorage.getItem('recruiterToken')
        : localStorage.getItem('token');
      
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      if (!isAdminRoute) {
        const responseData = await res.clone().json().catch(() => null);
        if (responseData?.code === "TOKEN_EXPIRED" || responseData?.code === "INVALID_TOKEN") {
            if (isRecruiterRoute) {
              localStorage.removeItem('recruiterToken');
              localStorage.removeItem('recruiterData');
              if (!window.location.pathname.includes('/recruiter/auth')) window.location.href = '/recruiter/auth';
            } else {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              if (!window.location.pathname.includes('/login')) window.location.href = '/login';
            }
        }
      }
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
