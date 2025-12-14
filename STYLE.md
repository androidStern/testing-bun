---
name: 'Shadcn UI Designer'
description: 'Designs modern, clean UI components and pages following Shadcn principles with minimalism, accessibility, and beautiful defaults. Use when building new UI components, redesigning pages, or creating consistent UI or simply wanting to use shadcn.'
version: '1.0.0'
allowed-tools: ['file_write', 'file_read', 'shadcn']
---

# Shadcn UI Designer

## Core Design Prompt

When designing any UI, apply this philosophy:

> "Design a modern, clean UI following Shadcn principles: apply minimalism with ample white space and simple sans-serif typography; use strategic, subtle shadows for depth and hierarchy; ensure accessibility with high-contrast neutrals and scalable elements; provide beautiful defaults for buttons, cards, and forms that compose modularly; incorporate fluid, non-intrusive animations; maintain a professional palette of soft grays, whites, and minimal accents like purple; output as responsive, customizable React code with Tailwind CSS."

## Design Rules

### 1. Typography Rule

- Limit to **2-3 font weights and sizes** per screen
- Use **Inter** or system fonts for consistency. in general you shouldnt need to specify a font unless were purposefully deviating for effect

```tsx
<h1 className="text-2xl font-semibold">Title</h1>
<p className="text-sm text-muted-foreground">Description</p>
```

### 2. Spacing Rule

- **4px-based scale**: Tailwind's `p-1`, `p-2`, `p-4`, `p-6`, `p-8` (4px, 8px, 16px, 24px, 32px)
- **Consistency is key**: pick spacing values and stick to them across the app (e.g., if cards use `p-6`, all cards use `p-6`)
- **Hierarchy principle**: tighter spacing within related elements, looser spacing between sections

```tsx
<div className="p-6 space-y-4">
  <div className="mb-8">...</div>
</div>
```

### 3. Color Rule

- Base on **OKLCH** for perceptual uniformity
- Use **50-950 scale grays** (background, foreground, muted)
- **Subtle accents** at 10% opacity to avoid visual noise
- **Colors live in theme CSS** - never hardcode hex/rgb in components
- To adjust colors, update design tokens in CSS, not inline

```tsx
<Card className="bg-card text-card-foreground border-border">
  <Button className="bg-primary text-primary-foreground">Action</Button>
  <div className="bg-primary/10">Subtle accent</div>
</Card>
```

### 4. Shadow Rule

- **3 levels only**:
  - `shadow-sm`: Subtle lift (0 1px 2px) - for cards
  - `shadow-md`: Medium depth (0 4px 6px) - for dropdowns
  - `shadow-lg`: High elevation (0 10px 15px) - for modals

```tsx
<Card className="shadow-sm hover:shadow-md transition-shadow">
```

### 5. Animation Rule

- **200-300ms durations**
- **ease-in-out** curves for transitions
- **Subtle feedback** only (hovers, state changes) - no decorative flourishes

```tsx
<Button className="transition-colors duration-200 hover:bg-primary/90">
<Card className="transition-transform duration-200 hover:scale-105">
```

### 6. Accessibility Rule

- **ARIA labels** on all interactive elements
- **WCAG 2.1 AA** contrast ratios (4.5:1 minimum)
- **Keyboard-focus styles** matching hover states
- **Semantic HTML** structure

```tsx
<Button aria-label="Submit form" className="focus:ring-2 focus:ring-primary focus:outline-none">
  Submit
</Button>
```

## Workflow

### 1. Interview User (if details not provided)

- **Scope**: Full page, section, or specific component?
- **Type**: Dashboard, form, card, modal, table?
- **Target file**: Where should this be implemented?
- **Requirements**: Features, interactions, data to display?

### 2. Design & Implement

1. **Match existing design** - align with current UI patterns in the app
2. **Pattern reuse** - check for existing UI patterns before building; extract components only when reuse is evident or a component exceeds ~350 lines
3. **Ensure responsiveness** - mobile, tablet, desktop

### 3. Top level Page Component Pattern

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function MyComponent() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Page Title</h1>
      </header>

      <main className="grid gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Section</CardTitle>
          </CardHeader>
          <CardContent>{/* Content */}</CardContent>
        </Card>
      </main>
    </div>
  );
}
```

### 4. Quality Checklist

Before completing, verify:

- [ ] Uses shadcn/ui components where applicable
- [ ] 2-3 font weights/sizes max per screen
- [ ] Spacing values consistent with existing patterns
- [ ] Theme color variables (no hardcoded colors)
- [ ] 3 shadow levels max, strategically applied
- [ ] Animations 200-300ms with ease-in-out
- [ ] ARIA labels on interactive elements
- [ ] WCAG AA contrast ratios (4.5:1 min)
- [ ] Keyboard focus styles implemented
- [ ] Mobile-first responsive design
- [ ] Modular, reusable code structure

## Common Patterns

### Dashboard Page

```tsx
<div className="container mx-auto p-6 space-y-6">
  <header className="space-y-2">
    <h1 className="text-2xl font-semibold">Dashboard</h1>
    <p className="text-sm text-muted-foreground">Overview of metrics</p>
  </header>

  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    {stats.map((stat) => (
      <Card key={stat.id} className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{stat.value}</div>
        </CardContent>
      </Card>
    ))}
  </div>
</div>
```

### Form Pattern

```tsx
const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Enter a valid email address.'),
});

function MyForm() {
  const form = useForm({
    defaultValues: { name: '', email: '' },
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      /* handle submit */
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
      </FieldGroup>
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

## Best Practices

- **Match existing design** - new designs align with current UI screens and components
- **UI-first approach** - complete visual interface before adding business logic
- **Pattern-aware code** - check for existing patterns before building new UI; formalize patterns that emerge across multiple uses
- **Token efficiency** - concise, well-structured code
- **Consistency** - follow existing color, spacing, and typography patterns
- **Composability** - build with shadcn's philosophy of small components that work together

## Common Shadcn Components

- **Layout**: Card, Tabs, Sheet, Dialog, Popover
- **Forms**: Input, Textarea, Select, Checkbox, Radio, Switch, Label
- **Buttons**: Button, Toggle, ToggleGroup
- **Display**: Badge, Avatar, Separator, Skeleton, Table
- **Feedback**: Alert, Toast, Progress
- **Navigation**: NavigationMenu, Dropdown, Command

## References

- [Shadcn UI](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com)
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
