export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const validateFileSize = (file: File, maxSizeMB: number): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

export const validateVideoFile = (file: File): {
  valid: boolean;
  error?: string;
} => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg'];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only MP4, WebM, and OGG video formats are allowed',
    };
  }

  // Max 2GB
  if (!validateFileSize(file, 2048)) {
    return {
      valid: false,
      error: 'Video file size must not exceed 2GB',
    };
  }

  return { valid: true };
};

export const validateImageFile = (file: File): {
  valid: boolean;
  error?: string;
} => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, and WebP image formats are allowed',
    };
  }

  // Max 5MB
  if (!validateFileSize(file, 5)) {
    return {
      valid: false,
      error: 'Image file size must not exceed 5MB',
    };
  }

  return { valid: true };
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};
