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
  export const REQUEST_STATUS_PRESENTATION: Record<string, { label: string; color: string }>;
  export const LOAN_APPROVAL_STATUSES: string[];
  export const RETURN_APPROVAL_STATUSES: string[];
  export function requestStatusValue(record: {
    status?: string;
    kind?: string;
    completed?: boolean;
  }): string;
  export function requestStatusPresentation(status: string): { label: string; color: string };
  export function isReturnPending(record: {
    status?: string;
    kind?: string;
    completed?: boolean;
  }): boolean;
  export function approvalStatuses(kind: string): string[];
}
declare module '@shared/features/catalog/search.js' {
  export function matchCatalog<T extends { asset: string; serial: string; name: string }>(
    records: T[],
    query: string,
  ): T[];
  export function catalogCategory(name: string): string;
}
declare module '@shared/core/extensions/dates.js' {
  export function bangkokIsoDate(date?: Date): string;
  export function calendarDaysBetween(start: string, end: string): number;
  export function isIsoCalendarDate(value: unknown): boolean;
}
declare module '@shared/features/auth/profile.js' {
  export function googleProfileImageUrl(value: unknown): string;
}
declare module '@shared/features/auth/permissions.js' {
  export function permissionsForRole(role: string): string[];
}
declare module '@shared/features/records/dashboardFields.js' {
  export const editableDashboardHeaders: string[];
}
