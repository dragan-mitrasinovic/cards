---
description: 'Angular coding standards and best practices'
applyTo: '**/*.ts, **/*.html, **/*.css'
---

# Angular Coding Standards

## Components
- Use standalone components (default in Angular 21, do not set `standalone: true`)
- Use `input()`, `output()`, `viewChild()`, `viewChildren()` functions instead of decorators
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in all components
- Keep components small and focused on a single responsibility
- Use host bindings inside the `host` object (avoid `@HostBinding`/`@HostListener`)

## State Management
- Use Signals (`signal()`, `computed()`, `effect()`) for reactive state
- Use writable signals for mutable state and computed signals for derived state
- Avoid legacy patterns (`@Input`, `@Output` decorators)

## Templates
- Use native control flow (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`, `*ngSwitch`
- Use `class` and `style` bindings — never `ngClass` or `ngStyle`
- Keep templates clean; move logic to component classes or services

## TypeScript
- Strict mode enabled in `tsconfig.json`
- Avoid `any`; use `unknown` when type is uncertain
- Prefer type inference when the type is obvious
- Define clear interfaces and types for models and services

## Dependency Injection
- Use `inject()` function for dependency injection in standalone components
- Use Angular's built-in DI system effectively

## Data Fetching
- Use `HttpClient` with proper typing
- Store API response data in signals for reactive updates
- Implement error handling with RxJS `catchError` or signal-based patterns

## Routing
- Implement lazy loading for feature routes
- Use functional route guards

## Forms
- Prefer reactive forms with typed `FormGroup`/`FormControl`

## Styling
- Use component-level CSS encapsulation (ViewEncapsulation.Emulated, the default)
- Follow responsive design practices with CSS Grid/Flexbox

## Testing
- Write unit tests using Jasmine and Karma (project default)
- Use `TestBed` for component testing with mocked dependencies
- Mock HTTP requests using `provideHttpClientTesting`

## Accessibility
- Use semantic HTML
- Include ARIA attributes where needed
- Ensure keyboard navigability
