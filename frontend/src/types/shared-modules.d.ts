declare module '@shared/features/lending/formConstants.js' {
  export const FORM_TEAMS: readonly string[];
  export const LOAN_TYPES: readonly string[];
  export const RETURN_TYPES: readonly string[];
  export const LOAN_TERMS: string;
  export const LOAN_NOTES: readonly string[];
  export const RETURN_TERMS: string;
}
declare module '@shared/features/lending/status.js' {
  export const MAX_LOAN_DAYS: number;
}
declare module '@shared/features/catalog/search.js' {
  export function matchCatalog<T extends { asset: string; serial: string; name: string }>(
    records: T[],
    query: string,
  ): T[];
  export function catalogCategory(name: string): string;
}
declare module '@shared/core/extensions/dates.js' {
  export function calendarDaysBetween(start: string, end: string): number;
  export function isIsoCalendarDate(value: unknown): boolean;
}
declare module '@shared/features/auth/profile.js' {
  export function googleProfileImageUrl(value: unknown): string;
}
declare module '@shared/features/auth/permissions.js' {
  export function permissionsForRole(role: string): string[];
}
