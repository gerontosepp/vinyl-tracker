import axios from 'axios';

type ApiErrorPayload = {
  message?: string;
  error?: string;
  detail?: string;
};

const readErrorPayloadMessage = (data: unknown): string | null => {
  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return null;
  }

  const payload = data as ApiErrorPayload;
  return payload.message || payload.error || payload.detail || null;
};

export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const fromPayload = readErrorPayloadMessage(error.response?.data);
    if (fromPayload) {
      return fromPayload;
    }

    if (error.message && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};
