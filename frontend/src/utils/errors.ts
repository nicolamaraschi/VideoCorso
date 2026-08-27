interface BackendErrorBody {
  error?: string;
  message?: string;
}

interface AxiosLikeError {
  isAxiosError?: boolean;
  response?: {
    status?: number;
    data?: BackendErrorBody;
  };
  request?: unknown;
}

const isAxiosLikeError = (error: unknown): error is AxiosLikeError =>
  typeof error === 'object' && error !== null && 'isAxiosError' in error;

// Server errors (5xx) and generic network failures should never surface the
// raw backend/Axios message to end users: it can leak implementation detail
// or just read as unhelpful ("Request failed with status code 500"). Only
// 4xx responses carry a message worth showing, since those are the API's own
// validation/business-rule text meant for the caller.
export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosLikeError(error)) {
    const status = error.response?.status;
    const backendMessage = error.response?.data?.error || error.response?.data?.message;

    if (status && status >= 500) {
      return fallback;
    }
    if (!error.response) {
      // Network error, timeout, or request never reached the server.
      return fallback;
    }
    if (backendMessage && backendMessage.trim()) {
      return backendMessage;
    }
    return fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
};
