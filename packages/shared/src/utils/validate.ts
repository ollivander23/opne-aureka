/**
 * Validate file type for upload
 */
export function isValidFileType(fileName: string): boolean {
  const validExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  return validExtensions.includes(ext);
}

/**
 * Validate file size (max 100MB)
 */
export function isValidFileSize(bytes: number, maxMB = 100): boolean {
  return bytes > 0 && bytes <= maxMB * 1024 * 1024;
}

/**
 * Check if a string is a valid email
 */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Check if a string looks like a phone number (CN)
 */
export function isPhoneNumber(value: string): boolean {
  return /^1[3-9]\d{9}$/.test(value.replace(/[\s-]/g, ''));
}

/**
 * Check if a string looks like an ID card (CN)
 */
export function isIdCard(value: string): boolean {
  return /^\d{17}[\dXx]$/.test(value.replace(/[\s-]/g, ''));
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
