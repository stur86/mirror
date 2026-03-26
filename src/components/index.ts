/**
 * Component abstraction layer.
 *
 * Import all UI components from this module.
 * If we switch component frameworks, only this file needs to change.
 */

// Re-export components as we need them
export {
  Button,
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
  Switch,
  OverlayToaster,
  Toast2,
  Intent,
} from '@blueprintjs/core';

// Re-export types
export type {
  ButtonProps,
  MenuItemProps,
  ToastProps,
} from '@blueprintjs/core';
