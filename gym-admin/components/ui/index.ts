// Barrel export for the design-system primitives.
//
// New components MUST live in this folder. Add their export here so
// callers can `import { Button, … } from '@/components/ui'`.
//
// See ./README.md for the token vocabulary and usage rules.

export { Button, type ButtonProps } from './button';
export { Field, type FieldProps } from './field';
export { Input, type InputProps } from './input';
export { Textarea, type TextareaProps } from './textarea';
export { Select, type SelectProps } from './select';
export { PasswordInput, type PasswordInputProps } from './password-input';
export { Modal, type ModalProps } from './modal';
export { Card, type CardProps } from './card';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { Tabs, type TabsProps, type TabsTriggerProps } from './tabs';
export { Badge, type BadgeProps } from './badge';
export { Avatar, type AvatarProps } from './avatar';
export { SearchInput, type SearchInputProps } from './search-input';
export { FilterDropdown, type FilterDropdownProps, type FilterOption } from './filter-dropdown';
export { Pagination, type PaginationProps } from './pagination';
export { DataTable, type DataTableProps, type DataTableColumn } from './data-table';
