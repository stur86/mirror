/**
 * Component abstraction layer.
 *
 * Import all UI components from this module.
 * If we switch component frameworks, only this file needs to change.
 */

// Re-export components as we need them
export {
  Breadcrumbs,
  Button,
  InputGroup,
  Navbar,
  NavbarGroup,
  NavbarHeading,
  NavbarDivider,
  Menu,
  MenuItem,
  MenuDivider,
  Popover,
  Alignment,
  Dialog,
  DialogBody,
  DialogFooter,
  HTMLSelect,
  Radio,
  RadioGroup,
  Spinner,
  Switch,
  OverlayToaster,
  Toast2,
  Intent,
  Spinner,
} from '@blueprintjs/core';

// Re-export types
export type {
  ButtonProps,
  MenuItemProps,
  ToastProps,
} from '@blueprintjs/core';

export { FileBrowserDialog } from './FileBrowserDialog';
export type { FileFilter, FileBrowserResult } from './FileBrowserDialog';
