import { API_PREFIX, API_ROUTES } from '@org/shared';

/** Browser-side API URLs: same origin as the page, rewritten to the backend by next.config.js (FQ3). */
export const clientApi = {
  position: (code: string) => `/${API_PREFIX}/${API_ROUTES.POSITIONS}/${encodeURIComponent(code)}`,
  applications: `/${API_PREFIX}/${API_ROUTES.APPLICATIONS}`,
  authLogin: `/${API_PREFIX}/${API_ROUTES.AUTH_LOGIN}`,
  authLogout: `/${API_PREFIX}/${API_ROUTES.AUTH_LOGOUT}`,
};
