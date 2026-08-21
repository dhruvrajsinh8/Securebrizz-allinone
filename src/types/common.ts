// Common types used across the application

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Status = 'open' | 'in_progress' | 'resolved' | 'false_positive' | 'accepted';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FilterOptions {
  search?: string;
  severity?: Severity[];
  status?: Status[];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface StatCard {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
  color?: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  read: boolean;
  createdAt: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface TableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}
