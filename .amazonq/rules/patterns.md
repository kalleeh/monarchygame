# Technical Implementation Patterns

## Component Architecture
- Always include demo mode support alongside authenticated mode
- Use error boundaries for graceful failure handling
- Implement TypeScript interfaces for all game data structures

## Technology Stack Decisions
- React Spring for animations and magical effects
- Recharts for data visualization and economic charts
- React Flow for interactive node-based maps
- GraphQL subscriptions for real-time features

## Code Quality Standards
- Full TypeScript compliance with strict typing
- Component-based architecture with clear separation
- Consistent error handling and user feedback

## Demo Mode Pattern
```typescript
// Always support both authenticated and demo modes
const isDemo = !user;
const kingdomData = isDemo ? generateDemoData() : user.kingdom;
```

## Error Boundary Pattern
```typescript
// Wrap complex components with error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <ComplexGameComponent />
</ErrorBoundary>
```

## Real-time Subscription Pattern
```typescript
// Use GraphQL subscriptions for live updates
const subscription = client.models.Kingdom.observeQuery()
  .subscribe({ next: ({ items }) => setKingdoms(items) });
```
