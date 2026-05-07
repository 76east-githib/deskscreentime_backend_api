import moment from 'moment-timezone';

// India timezone constant
export const INDIA_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30'; // IST is UTC+5:30

/**
 * Get current date/time in IST
 */
export function getCurrentIST(): Date {
  return moment.tz(INDIA_TIMEZONE).toDate();
}

/**
 * Get current date string in IST (YYYY-MM-DD)
 */
export function getCurrentISTDateString(): string {
  return moment.tz(INDIA_TIMEZONE).format('YYYY-MM-DD');
}

/**
 * Get start of day in IST (00:00:00 IST)
 */
export function getStartOfDayIST(date?: Date | string): Date {
  const dateObj = date ? moment.tz(date, INDIA_TIMEZONE) : moment.tz(INDIA_TIMEZONE);
  return dateObj.startOf('day').toDate();
}

/**
 * Get end of day in IST (23:59:59 IST)
 */
export function getEndOfDayIST(date?: Date | string): Date {
  const dateObj = date ? moment.tz(date, INDIA_TIMEZONE) : moment.tz(INDIA_TIMEZONE);
  return dateObj.endOf('day').toDate();
}

/**
 * Convert any date to IST Date object
 */
export function convertToIST(date: Date | string): Date {
  return moment.tz(date, INDIA_TIMEZONE).toDate();
}

/**
 * Format date in IST timezone
 */
export function formatDateIST(date: Date | string, format: string = 'DD-MM-YYYY'): string {
  return moment.tz(date, INDIA_TIMEZONE).format(format);
}

/**
 * Format date-time in IST timezone
 */
export function formatDateTimeIST(date: Date | string, format: string = 'DD-MM-YYYY HH:mm:ss'): string {
  return moment.tz(date, INDIA_TIMEZONE).format(format);
}

/**
 * Get date range for today in IST (start and end)
 */
export function getTodayRangeIST(): { start: Date; end: Date } {
  const start = getStartOfDayIST();
  const end = getEndOfDayIST();
  return { start, end };
}

/**
 * Get date range for a specific date in IST
 */
export function getDateRangeIST(date: Date | string): { start: Date; end: Date } {
  const start = getStartOfDayIST(date);
  const end = getEndOfDayIST(date);
  return { start, end };
}

/**
 * Convert date to IST ISO string for MongoDB queries
 * Returns date in format: YYYY-MM-DDTHH:mm:ss.SSSZ (in IST)
 */
export function toISTISOString(date?: Date | string): string {
  const dateObj = date ? moment.tz(date, INDIA_TIMEZONE) : moment.tz(INDIA_TIMEZONE);
  return dateObj.toISOString();
}

/**
 * Get IST date string for MongoDB date range queries
 * Returns: YYYY-MM-DDTHH:mm:ss.SSSZ format
 */
export function getISTDateRangeForQuery(date?: Date | string): { start: string; end: string } {
  const dateObj = date ? moment.tz(date, INDIA_TIMEZONE) : moment.tz(INDIA_TIMEZONE);
  const start = dateObj.clone().startOf('day').toISOString();
  const end = dateObj.clone().endOf('day').toISOString();
  return { start, end };
}

/**
 * Parse date string and convert to IST Date
 */
export function parseToIST(dateString: string, format?: string): Date {
  if (format) {
    return moment.tz(dateString, format, INDIA_TIMEZONE).toDate();
  }
  return moment.tz(dateString, INDIA_TIMEZONE).toDate();
}

/**
 * Get yesterday's date in IST
 */
export function getYesterdayIST(): Date {
  return moment.tz(INDIA_TIMEZONE).subtract(1, 'days').toDate();
}

/**
 * Get yesterday's date string in IST
 */
export function getYesterdayISTString(): string {
  return moment.tz(INDIA_TIMEZONE).subtract(1, 'days').format('YYYY-MM-DD');
}

/**
 * Check if date is today in IST
 */
export function isTodayIST(date: Date | string): boolean {
  const today = moment.tz(INDIA_TIMEZONE).startOf('day');
  const checkDate = moment.tz(date, INDIA_TIMEZONE).startOf('day');
  return today.isSame(checkDate);
}

/**
 * Get difference in milliseconds between two dates (handles IST)
 */
export function getDifferenceInMs(startDate: Date | string, endDate: Date | string): number {
  const start = moment.tz(startDate, INDIA_TIMEZONE);
  const end = moment.tz(endDate, INDIA_TIMEZONE);
  return end.diff(start);
}

/**
 * Add days to a date in IST
 */
export function addDaysIST(date: Date | string, days: number): Date {
  return moment.tz(date, INDIA_TIMEZONE).add(days, 'days').toDate();
}

/**
 * Subtract days from a date in IST
 */
export function subtractDaysIST(date: Date | string, days: number): Date {
  return moment.tz(date, INDIA_TIMEZONE).subtract(days, 'days').toDate();
}


