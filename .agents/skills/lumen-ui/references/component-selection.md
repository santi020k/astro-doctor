# Component Selection and Composition

Confirm each selected component and prop against the current Lumen package, MCP server, CLI, or
component docs before implementation.

## Choose by Intent

| Intent | Start with |
| --- | --- |
| Primary or secondary action | `Button`, `ButtonLink`, `ButtonGroup` |
| Labeled form control | `Field`, `Label`, `Input`, `Textarea`, `NativeSelect` |
| Search or suggestion input | `SearchField`, `Autocomplete`, `Combobox`, `Command` |
| Boolean or mode choice | `Checkbox`, `Switch`, `Toggle`, `ToggleGroup`, `RadioGroup` |
| Compact metadata or status | `Badge`, `Marker`, `Pill`, `TagGroup` |
| Inline guidance or feedback | `Alert`, `Callout`, `Note`, `Progress`, `Spinner`, `Skeleton` |
| Transient feedback | `Sonner`, `Toast` |
| Blocking decision | `Dialog`, `AlertDialog` |
| Supplemental side surface | `Drawer`, `Sheet` |
| Anchored supplemental content | `Popover`, `HoverCard`, `Tooltip` |
| Navigation | `Breadcrumb`, `NavigationMenu`, `Tabs`, `Pagination`, `Sidebar` |
| Related code or command variants | `CodeTabs` |
| Structured content | `Card`, `Item`, `Table`, `DataTable`, `Descriptions` |
| Hierarchical or large collections | `Tree`, `TreeGrid`, `VirtualList` |
| Dates and planning | `Calendar`, `DatePicker`, `DateRangePicker`, `Schedule`, `Agenda` |
| Media or identity | `Avatar`, `Image`, `CoverImage`, `AspectRatio` |
| Dense workspace layout | `Resizable`, `ScrollArea`, `Toolbar`, `Separator` |
| Empty or first-run state | `Empty` with one clear next action |

## Common Product Compositions

### Settings form

Use a semantic form with `Field` + `Label` around each control. Group related fields with headings
and supporting text. Put the primary save action at the end, show inline validation, and use a toast
or alert only for submission-level feedback.

### Application shell

Use `Sidebar` or `NavigationMenu` for primary navigation, `Breadcrumb` for location when the
hierarchy is deeper than one level, and one main landmark for page content. Keep mobile navigation
reachable without duplicating conflicting active states.

### Data workspace

Use `SearchField` or `Command` for discovery, `DataTable` for structured rows, `Pagination` for
server-backed collections, and `Empty` or `Skeleton` for no-data and loading states. Use `Resizable`
only when side-by-side inspection materially helps the task.

### Create or edit flow

Use a full page for long or consequential workflows, `Sheet`/`Drawer` for supplemental editing, and
`Dialog` for short focused tasks. Preserve entered state on validation errors and announce the
result.

### Dashboard

Start from the decisions the user needs to make. Use `Stat`, `Chart`, `Progress`, or `Table` only for
real measures with labels, time ranges, and context. Avoid filling space with invented metrics.

### Scheduling

Compose `Schedule` with `Agenda`, `Calendar`, or date fields according to the task. Make event names,
times, conflicts, selected state, and keyboard movement understandable without color alone.

### Code examples

Use `CodeTabs` for package-manager commands, language variants, or alternative configuration
examples. Give each item a stable `value`, visible `label`, `code`, and optional `language`. Set a
descriptive `ariaLabel`, and reuse a stable `storageKey` only when matching groups should persist
and synchronize the reader's choice. Use `wrap={false}` for command lines that should scroll rather
than wrap. Do not recreate tab activation, keyboard behavior, copy controls, or persistence.

## Selection Tests

Before adding a component, ask:

1. Does it match the user's intent and information hierarchy?
2. Is a simpler semantic element or smaller Lumen primitive enough?
3. Does the current framework target expose it and its needed behavior?
4. Are loading, empty, error, disabled, and responsive states accounted for?
5. Can a keyboard and screen-reader user complete the same task?
