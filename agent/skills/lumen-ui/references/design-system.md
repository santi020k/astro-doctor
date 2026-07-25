# Lumen Design System

## Character

Aim for calm, precise, product-focused interfaces. Favor legibility, clear hierarchy, restrained
surfaces, and predictable interaction over ornamental effects. Make the product feel authored by
its content and workflow, not by adding generic dashboard decoration.

## Semantic Color Contract

Use these public tokens:

| Role | Tokens |
| --- | --- |
| Base | `canvas`, `surface`, `surface-muted`, `surface-strong` |
| Text | `ink`, `ink-soft`, `ink-muted` |
| Border | `line` |
| Primary action | `brand`, `brand-solid`, `brand-soft` |
| Secondary accent | `accent` |
| Status | `success`, `warning`, `danger` |

In CSS, consume tokens through `hsl(var(--token))`, for example:

```css
.product-panel {
  border: 1px solid hsl(var(--line));
  background: hsl(var(--surface));
  color: hsl(var(--ink));
}
```

Override the semantic variables at a theme boundary rather than styling every component
individually. Keep foreground/background contrast valid in both light and dark modes.

## Composition Principles

- Establish hierarchy with spacing, alignment, weight, and content grouping before adding effects.
- Keep primary actions visually dominant and destructive actions unmistakable.
- Use `surface-muted` to group supporting content and `surface-strong` sparingly for emphasis.
- Use borders to clarify structure. Use shadows and large radii only when they explain elevation.
- Use `glass`, `glass="subtle"`, or `glass="strong"` only where the selected component exposes the
  public glass contract. Keep dense reading and form surfaces opaque when translucency hurts clarity.
- Reuse spacing and alignment patterns across a screen; avoid one-off offsets.
- Provide responsive behavior based on content pressure, not arbitrary device labels.
- Respect reduced-motion preferences and keep transitions short and functional.

## Accessibility and Product States

- Associate every field with a visible label or an equivalent accessible name.
- Preserve logical heading order and landmark structure.
- Keep focus visible and return focus after dismissing overlays.
- Give icon-only controls a clear pointer target and an accessible label.
- Do not rely on color alone for selection, validation, or status.
- Design loading, empty, error, success, disabled, selected, and destructive states when relevant.
- Use `AlertDialog` or confirmation patterns only for consequential actions; avoid confirmation
  friction for safe, reversible changes.

## Review Smells

Revise interfaces that show these patterns:

- hardcoded brand hex values alongside Lumen tokens;
- hand-built buttons, fields, dialogs, or menus that duplicate a Lumen primitive;
- excessive cards nesting every piece of content;
- several equal-weight primary actions;
- glass on every surface;
- emoji used as functional icons;
- placeholder charts or metrics unrelated to the product;
- hover-only cues or interactions with no keyboard path;
- desktop-only fixed widths that force horizontal scrolling;
- visual polish that removes labels, context, or status feedback.
