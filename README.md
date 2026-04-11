# Monarchy Game - Modern Strategy Game

A modern recreation of the classic Monarchy/Canon browser-based strategy game, built with AWS Amplify Gen 2, React 19, and TypeScript.

## 🎮 **Game Features**

### **Implemented Systems**
- **Welcome Page** - Parallax design with race previews
- **Authentication System** - AWS Amplify with demo mode
- **Kingdom Creation** - 10 unique races with racial bonuses
- **Kingdom Management** - Resource management and dashboard (localStorage-backed)
- **Territory System** - Land expansion and building management
- **Combat System** - Battles with detailed reports (single-player vs AI)
- **Combat Replay System** - Battle recording and playback
- **Alliance System** - Chat, invitations, and diplomacy (demo mode only)
- **World Map System** - Interactive territory visualization with React Flow
- **Magic System** - Animated spell casting with React Spring
- **Trade & Economy System** - Data visualization and resource trading
- **Thievery/Espionage System** - 8 operations with race-specific bonuses
- **Faith & Focus System** - Alignment selection and focus point abilities
- **Bounty System** - Target claiming and reward mechanics
- **Season System** - 6-week seasons with age progression (early/middle/late)
- **Achievement System** - 22 achievements across 6 categories with dashboard widget
- **Leaderboard** - Race tabs, guild rankings, rank deltas
- **Kingdom Cleanup** - Full kingdom deletion with cascading record removal

### **Technical Stack**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** AWS Amplify Gen 2 + DynamoDB
- **Real-time:** GraphQL Subscriptions via Amplify observeQuery
- **Authentication:** AWS Cognito User Pools
- **Database:** DynamoDB with GraphQL API
- **State Management:** Zustand
- **Deployment:** AWS Amplify Hosting
- **Visualization:** React Flow for interactive maps
- **Animations:** React Spring for magical effects
- **Charts:** Built-in chart components for economic data visualization

## 📚 **Documentation**

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment process
- **[Architecture Decisions](docs/architecture-decisions.md)** - Technical design decisions
- **[Game Mechanics Reference](docs/mechanics-reference.md)** - Game balance and formulas
- **[Feature Enhancement Plan](docs/feature-enhancement-plan.md)** - Development roadmap
- **[AWS Deployment Validation](docs/aws-deployment-validation.md)** - AWS setup guide
- **[Amplify Deployment Guide](docs/amplify-deployment-guide.md)** - Amplify configuration

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ 
- AWS CLI configured
- Git

### **Development Setup**

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd monarchygame
   ```

2. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Start development environment**
   ```bash
   # From project root
   ./dev-start.sh
   ```
   
   Or manually:
   ```bash
   # Terminal 1: Start Amplify sandbox
   npx ampx sandbox
   
   # Terminal 2: Start frontend
   cd frontend
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173/
   - Click "🎮 Demo Mode" for full feature access without registration

### **Deploy to AWS**
```bash
npx ampx sandbox deploy
```

## 📁 **Project Structure**

```
monarchygame/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API services
│   │   ├── stores/          # Zustand state management
│   │   ├── hooks/           # Custom React hooks
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
├── amplify/                  # AWS Amplify backend
│   ├── data/                # GraphQL schema
│   └── functions/           # 19 Lambda functions
├── shared/                   # Game mechanics shared between frontend and backend
├── reference/                # Historical source documentation
├── docs/                     # Documentation
├── tests/                    # E2E tests (Playwright)
├── dev-start.sh              # Development startup script
└── AmazonQ.md                # Development backlog
```

## 🧪 **Testing**

### **Unit Tests**
```bash
cd frontend
npm test
```

### **E2E Tests**
```bash
npx playwright test
```

### **Test Coverage**
- Backend Lambda tests: 220 tests across 18 files
- Shared mechanics tests: 433 tests across 10 files
- Frontend store/service tests: 125 tests across 23 files
- E2E tests: 21 Playwright specs

## 🎯 **Game Mechanics**

### **10 Unique Races**
Each race has distinct bonuses and special abilities:
- **Human** - Balanced, economic advantages
- **Elven** - Magic-focused, defensive
- **Goblin** - Early game warriors
- **Droben** - Elite combat units
- **Vampire** - Resource-intensive, powerful
- **Elemental** - Fighter-mage hybrid
- **Centaur** - Espionage specialists
- **Sidhe** - Master sorcerers
- **Dwarven** - Defensive specialists
- **Fae** - Versatile magic users

### **Core Systems**
- **Building System** - Strategic construction with optimal ratios
- **Combat System** - Real-time battles with detailed mechanics
- **Magic System** - Spell casting with animated effects
- **Alliance System** - Diplomatic relationships and coordination
- **Economy System** - Resource management and trading
- **Territory System** - Land expansion and control

## 🔧 **Development**

### **Available Scripts**
```bash
# Frontend development
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run unit tests
npm run lint         # Run ESLint

# Backend development
npx ampx sandbox     # Start Amplify sandbox
npx ampx generate    # Generate GraphQL types
```

### **Code Quality**
- **TypeScript**: 0 compilation errors (strict mode enabled)
- **ESLint**: 0 errors, 0 warnings (perfect compliance)
- **Tests**: 778/778 passing (100% pass rate)
- **Build**: Production ready (2.0MB JS, 8.28s)
- **Lambda Functions**: 19 registered + 2 EventBridge schedules
- **Component Testing**: React Testing Library
- **Mobile-first**: Responsive design

## 📊 **Performance Metrics**
- **Bundle Size:** 2.0MB (JS assets)
- **Build Time:** 8.28s
- **Load Time:** <3s on 3G
- **Lighthouse Score:** 95+ (Performance)
- **Test Pass Rate:** 100% (778/778 tests)
- **Code Quality:** Perfect (0 errors, 0 warnings)

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 **Play Now**

Experience the strategic depth of the classic Monarchy game with modern features and real-time multiplayer capabilities.

**Current Version:** v0.0.1 - In Development
**Code Quality:** 0 errors, 0 warnings, tests passing
**Last Updated:** April 3, 2026
