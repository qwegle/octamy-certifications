// Token management utilities
export const clearTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('adminToken');
};

export const redirectToLogin = () => {
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};

export const handleAuthError = (response: any) => {
  if (response?.code === 'TOKEN_EXPIRED' || response?.code === 'INVALID_TOKEN') {
    clearTokens();
    redirectToLogin();
    return true;
  }
  return false;
};