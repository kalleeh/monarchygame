---
inclusion: always
---

# Development Workflow and Standards

## Development Process

### Git Workflow
- **Primary Repository**: AWS CodeCommit (`codecommit://monarchygame`)
- **Mirror Repository**: GitHub (`https://github.com/kalleeh/monarchygame.git`)
- **Deployment**: Automatic on push to CodeCommit main branch

### Branch Strategy
- `main` - Production branch (auto-deploys to AWS Amplify)
- Feature branches for development
- Direct commits to main for hotfixes

### Commit Standards
- Clear, descriptive commit messages
- Reference issue numbers when applicable
- Atomic commits (one logical change per commit)

## Code Quality Standards

### TypeScript Requirements
- Strict TypeScript configuration
- No `any` types allowed
- Proper component typing with interfaces
- Complete dependency arrays in hooks

### React Standards
- Functional components with hooks
- Proper error boundaries
- Lazy loading for route components
- Default exports for lazy-loaded components
- Accessibility-first design (WCAG 2.1 AA)

### Testing Strategy
- Unit tests with Vitest
- Component tests with React Testing Library
- E2E tests with Playwright
- Visual regression testing with Lighthouse

### Performance Requirements
- Core Web Vitals compliance (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Bundle size optimization
- Proper code splitting
- Image optimization

## Build and Deployment

### Local Development
```bash
cd frontend && npm run dev    # Start development server
npm run build                 # Build for production
npm run test                  # Run test suite
```

### Deployment Process
1. Commit changes locally
2. Push to CodeCommit: `git push codecommit main`
3. AWS Amplify automatically builds and deploys
4. Monitor deployment in AWS Console

### Environment Configuration
- **Development**: Local with Amplify sandbox
- **Production**: AWS Amplify (https://monarchy.gurum.se)
- **Build Compute**: STANDARD_8GB for complex React builds

## Architecture Decisions

### Frontend Architecture
- React 19 with TypeScript
- Vite for build tooling
- AWS Amplify Gen 2 for backend
- React Router for client-side routing
- Zustand for state management

### Component Organization
- Feature-based directory structure
- Shared components in `components/ui/`
- Business logic in custom hooks
- Type definitions in dedicated files

### State Management
- Zustand stores for complex state
- React Context for theme/auth
- Local state for component-specific data
- Server state with Amplify client

## Security Standards

### Authentication
- AWS Amplify Auth with Cognito
- Demo mode for testing
- Proper session management
- Secure token handling

### Data Protection
- Input validation and sanitization
- XSS prevention
- CSRF protection via Amplify
- Secure API communication

### Secrets Management
- No hardcoded secrets in code
- Environment variables for configuration
- AWS Secrets Manager for sensitive data
- Proper .gitignore for local secrets

## Quality Assurance

### Code Review Process
- All changes reviewed before merge
- Automated testing in CI/CD
- Performance impact assessment
- Security review for sensitive changes

### Monitoring and Observability
- AWS CloudWatch for application logs
- Performance monitoring with Lighthouse
- Error tracking and alerting
- User experience metrics

### Release Process
- Version tagging in git
- Changelog maintenance
- Rollback procedures documented
- Post-deployment verification
