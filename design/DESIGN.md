---
name: Ether Focus
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#918fa0'
  outline-variant: '#464554'
  surface-tint: '#c2c1ff'
  primary: '#c2c1ff'
  on-primary: '#1800a7'
  primary-container: '#5e5ce6'
  on-primary-container: '#f4f1ff'
  inverse-primary: '#4d4ad5'
  secondary: '#e9b3ff'
  on-secondary: '#510074'
  secondary-container: '#7d01b1'
  on-secondary-container: '#e5a9ff'
  tertiary: '#aac7ff'
  on-tertiary: '#003064'
  tertiary-container: '#006dd6'
  on-tertiary-container: '#f0f3ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c2c1ff'
  on-primary-fixed: '#0c006b'
  on-primary-fixed-variant: '#332dbc'
  secondary-fixed: '#f6d9ff'
  secondary-fixed-dim: '#e9b3ff'
  on-secondary-fixed: '#310048'
  on-secondary-fixed-variant: '#7200a3'
  tertiary-fixed: '#d6e3ff'
  tertiary-fixed-dim: '#aac7ff'
  on-tertiary-fixed: '#001b3e'
  on-tertiary-fixed-variant: '#00468d'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  label-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 40px
  gutter: 24px
  card-gap: 24px
  safe-area: 32px
---

## Brand & Style

The design system is centered on high-focus tranquility, designed for a browser start page that acts as a digital sanctuary. The brand personality is sophisticated, calm, and unobtrusive, catering to professionals and creatives who value a clutter-free transition into their deep-work sessions.

The aesthetic utilizes **Glassmorphism** combined with a **Minimalist** layout. Visual hierarchy is established through varying levels of background blur and transparency rather than heavy color blocking. The emotional response should be one of "digital weightlessness"—where elements feel like they are floating in a deep, atmospheric space. All interactions should feel fluid and intentional, reducing cognitive load from the moment a new tab is opened.

## Colors

This design system utilizes a "Deep Charcoal" foundation to minimize eye strain and provide a premium, cinematic backdrop. 

- **Primary & Secondary:** "Electric Blue" and "Soft Purple" are reserved for high-intent actions, active states, and data visualizations. 
- **Surface Strategy:** Surfaces are not solid colors but translucent layers (`surface_glass_hex`) that allow background gradients or imagery to subtly bleed through.
- **Accents:** Vibrant tints are applied to icons and progress indicators to ensure they pop against the dark canvas without breaking the minimalist harmony.

## Typography

The system relies on **Inter** for its exceptional readability and neutral, modern character. For technical or secondary metadata, **Geist** is introduced to provide a subtle "developer-tool" precision that complements the dashboard's functional nature.

- **Display Text:** Used for the primary clock or "Focus of the Day." It uses tight tracking and heavy weights.
- **Labels:** Always set in Geist with slight letter-spacing to distinguish metadata from content.
- **Hierarchy:** Contrast is created through weight and opacity (e.g., secondary text at 60% white) rather than a wide array of font sizes.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a centered "Stage" area. The design prioritizes generous whitespace to maintain the minimalist ethos.

- **Desktop:** A 12-column grid with wide 40px margins. Widgets are sized in increments of 3 or 4 columns.
- **Tablet:** 8-column grid with 32px margins. 
- **Mobile:** Single column stack with 20px margins.
- **Rhythm:** All spacing (padding, margins, gaps) is derived from an 8px base unit. Internal card padding should be a consistent 24px to match the corner radius, creating visual symmetry.

## Elevation & Depth

Depth is conveyed through **Backdrop Blurs** and **Ambient Shadows**. 

1.  **The Base:** The wallpaper or a deep charcoal gradient.
2.  **Level 1 (Cards/Widgets):** Semi-transparent background (65% opacity) with a `20px` backdrop-filter blur. A thin, 1px inner-border (stroke) at 10% white provides edge definition.
3.  **Level 2 (Modals/Popovers):** Higher opacity (80%) and a more pronounced shadow: `0 20px 40px rgba(0,0,0,0.4)`.
4.  **Shadow Character:** Shadows are extra-diffused and utilize a slight purple/blue tint in the dark mode to avoid "muddy" blacks and maintain the vibrant aesthetic.

## Shapes

The design system uses an exaggerated **Rounded** language to evoke a friendly, modern, and high-end feel.

- **Cards & Widgets:** Fixed `24px` radius to create a distinctive, nested look.
- **Buttons & Inputs:** Use a `12px` radius for a smaller footprint that still feels cohesive with the larger cards.
- **Selection States:** Use a "Squircle" or high-radius shape to highlight active icons in the sidebar or dock.

## Components

### Buttons
Primary buttons use a solid gradient of Primary to Secondary colors with white text. Secondary buttons are "Ghost" style—glassy backgrounds with a 1px border. All hover states should include a subtle scale-up (1.02x) and an increase in backdrop blur intensity.

### Cards
Cards are the primary container. They must never have a solid background. Use a `1px` top-down linear gradient for the border (White at 15% to White at 5%) to simulate a "rim light" effect.

### Input Fields
Inputs are minimalist: a simple underline or a glassy recessed well. Focus states are indicated by a glowing outer shadow using the Primary color at 30% opacity.

### Chips/Tags
Small, pill-shaped elements with low-opacity fills (10%) of their respective accent colors. These are used for categorization (e.g., "Work," "Personal," "Urgent").

### The "Pulse" Indicator
A unique component for this dashboard: a small, glowing dot (Primary color) next to the active task or clock, using a soft breathing animation to provide a "living" feel to the interface.