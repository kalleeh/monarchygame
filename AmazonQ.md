# Monarchy Game Modernization - Development Backlog

## Architecture Update: Aurora Serverless v2 PostgreSQL

**Key Change**: Switched from DynamoDB to Aurora Serverless v2 PostgreSQL to better support complex relational game queries while maintaining AWS ecosystem benefits.

**Benefits**:
- ✅ SQL for complex game logic (combat calculations, alliance management, leaderboards)
- ✅ Maintains TypeScript-first development with Amplify Gen 2
- ✅ Built-in real-time subscriptions via GraphQL
- ✅ AWS ecosystem integration with serverless scaling

## Project Overview
Modernize the classic Monarchy/Canon browser-based strategy game using AWS Amplify Gen 2, preserving the deep strategic gameplay while adding modern real-time features and improved user experience.

## Epic 1: Foundation & Authentication
**Priority**: Critical | **Estimated Effort**: 2-3 weeks

### User Stories
- **As a new player**, I want to create an account with email/username so I can start playing
- **As a returning player**, I want to log in securely and access my kingdoms
- **As a player**, I want my session to persist across browser sessions

### Technical Tasks
1. **Setup AWS Amplify Gen 2 Project**
   - Initialize project with `npm create amplify@latest`
   - Configure TypeScript and React with Vite
   - Setup ESLint, Prettier, and testing framework
   - Configure path aliases and project structure

2. **Implement Authentication**
   ```typescript
   // amplify/auth/resource.ts
   export const auth = defineAuth({
     loginWith: {
       email: true,
       username: true
     },
     userAttributes: {
       preferredUsername: {
         required: true,
         mutable: true
       }
     }
   })
   ```

3. **Create Authentication UI**
   - Login/Register forms with validation
   - Password reset functionality
   - User profile management
   - Session persistence and auto-refresh

### Acceptance Criteria
- [ ] Users can register with email and username
- [ ] Users can log in and stay logged in
- [ ] Password reset works via email
- [ ] Form validation provides clear error messages
- [ ] Authentication state persists across browser sessions

---

## Epic 2: Core Game Data Models
**Priority**: Critical | **Estimated Effort**: 2-3 weeks

### User Stories
- **As a player**, I want to create a kingdom and select a race with unique characteristics
- **As a player**, I want to see my kingdom's resources, territories, and units
- **As a developer**, I want type-safe data models for all game entities

### Technical Tasks
1. **Define GraphQL Schema**
   ```typescript
   // amplify/data/resource.ts
   const schema = a.schema({
     Kingdom: a.model({
       name: a.string().required(),
       race: a.enum(['Human', 'Elven', 'Goblin', 'Droben', 'Vampire', 'Elemental', 'Centaur', 'Sidhe', 'Dwarven', 'Fae']),
       resources: a.json(), // { gold, population, land, turns }
       stats: a.json(), // Racial bonuses and modifiers
       territories: a.hasMany('Territory', 'kingdomId'),
       owner: a.string()
     }).authorization(allow => [allow.owner()]),

     Territory: a.model({
       name: a.string().required(),
       coordinates: a.json(), // { x, y }
       buildings: a.json(), // Building counts and levels
       units: a.json(), // Unit counts by type
       fortifications: a.integer().default(0),
       kingdomId: a.id(),
       kingdom: a.belongsTo('Kingdom', 'kingdomId')
     }).authorization(allow => [allow.owner()])
   })
   ```

2. **Create Game Data Configuration**
   ```typescript
   // game-data/races/index.ts
   export const RACES = {
     Human: {
       name: 'Human',
       description: 'Balanced race with economic advantages',
       stats: {
         warOffense: 3, warDefense: 3, sorcery: 3,
         scum: 3, forts: 3, tithe: 4, // Best at economy
         training: 3, siege: 3, economy: 5, building: 3
       },
       specialAbility: 'Can send caravans twice as often',
       unitTypes: ['Peasants', 'Militia', 'Knights', 'Cavalry']
     },
     // ... other races
   }
   ```

3. **Implement Kingdom Creation**
   - Race selection with preview of bonuses
   - Kingdom naming with validation
   - Initial resource allocation
   - Starting territory generation

### Acceptance Criteria
- [ ] Players can create kingdoms with all 10 races
- [ ] Each race has unique stats and abilities
- [ ] Kingdom data persists correctly in DynamoDB
- [ ] Type safety maintained throughout data flow
- [ ] Race bonuses are correctly applied to calculations

---

## Epic 3: Kingdom Management Interface
**Priority**: High | **Estimated Effort**: 3-4 weeks

### User Stories
- **As a player**, I want to view my kingdom's status and resources
- **As a player**, I want to manage my territories and buildings
- **As a player**, I want to train units and manage my military

### Technical Tasks
1. **Kingdom Overview Dashboard**
   ```typescript
   // src/components/game/KingdomOverview.tsx
   interface KingdomOverviewProps {
     kingdom: Kingdom
     onUpdate: (kingdom: Kingdom) => void
   }
   ```
   - Resource display (gold, population, land, turns)
   - Territory summary with map view
   - Recent activity feed
   - Quick action buttons

2. **Territory Management**
   - Interactive territory list/grid
   - Building construction interface
   - Unit training interface
   - Fortification management

3. **Resource Management**
   - Income/expense breakdown
   - Resource generation calculations
   - Turn usage tracking
   - Economic efficiency metrics

### Acceptance Criteria
- [ ] Kingdom overview shows all key information
- [ ] Players can build/upgrade buildings
- [ ] Players can train different unit types
- [ ] Resource calculations are accurate
- [ ] Interface is responsive on mobile devices

---

## Epic 4: Combat System
**Priority**: High | **Estimated Effort**: 4-5 weeks

### User Stories
- **As a player**, I want to attack other kingdoms and capture territory
- **As a player**, I want to defend against attacks effectively
- **As a player**, I want to see detailed battle reports

### Technical Tasks
1. **Combat Calculation Engine**
   ```typescript
   // amplify/functions/combat-processor/handler.ts
   export const calculateCombat = (
     attacker: Army,
     defender: Army,
     terrain: TerrainType,
     raceModifiers: RaceStats
   ): CombatResult => {
     // Complex combat calculations based on original game
   }
   ```

2. **Attack Interface**
   - Target selection with kingdom search
   - Army composition selection
   - Attack type selection (raid, siege, controlled strike)
   - Confirmation with estimated outcomes

3. **Battle Reports**
   - Detailed combat breakdown
   - Casualty reports
   - Territory changes
   - Resource gains/losses

4. **Defense Management**
   - Defensive stance settings
   - Fortification effects
   - Defensive unit positioning

### Acceptance Criteria
- [ ] Combat calculations match original game mechanics
- [ ] Players can launch different types of attacks
- [ ] Battle reports are detailed and accurate
- [ ] Defensive bonuses are correctly applied
- [ ] Combat results are stored for history

---

## Epic 5: Real-Time Features
**Priority**: Medium | **Estimated Effort**: 2-3 weeks

### User Stories
- **As a player**, I want to receive notifications when attacked
- **As a player**, I want to chat with alliance members in real-time
- **As a player**, I want to see live updates of kingdom changes

### Technical Tasks
1. **Push Notifications**
   ```typescript
   // amplify/functions/notification-handler/handler.ts
   export const sendAttackNotification = async (
     playerId: string,
     attackDetails: AttackEvent
   ) => {
     await sns.publish({
       Message: `Your kingdom is under attack by ${attackDetails.attacker}!`,
       TargetArn: playerDeviceToken
     })
   }
   ```

2. **Real-Time Chat**
   ```typescript
   // GraphQL subscription for chat
   const subscription = client.models.ChatMessage.observeQuery({
     filter: { room: { eq: 'alliance-123' } }
   }).subscribe({
     next: ({ items }) => updateChatMessages(items)
   })
   ```

3. **Live Kingdom Updates**
   - Real-time resource updates
   - Live attack notifications
   - Alliance activity feed

### Acceptance Criteria
- [ ] Players receive push notifications for attacks
- [ ] Alliance chat works in real-time
- [ ] Kingdom updates appear without page refresh
- [ ] Notifications work on mobile devices
- [ ] Chat history is preserved

---

## Epic 6: Alliance & Diplomacy System
**Priority**: Medium | **Estimated Effort**: 3-4 weeks

### User Stories
- **As a player**, I want to form alliances with other players
- **As a player**, I want to coordinate attacks and defense with allies
- **As a player**, I want to manage diplomatic relationships

### Technical Tasks
1. **Alliance Management**
   ```typescript
   Alliance: a.model({
     name: a.string().required(),
     description: a.string(),
     members: a.string().array(),
     leader: a.string().required(),
     officers: a.string().array(),
     treaties: a.hasMany('Treaty', 'allianceId')
   }).authorization(allow => [allow.authenticated()])
   ```

2. **Diplomatic Actions**
   - Alliance invitations and applications
   - Treaty negotiations
   - Trade agreements
   - Non-aggression pacts

3. **Alliance Features**
   - Member management interface
   - Alliance chat channels
   - Coordinated attack planning
   - Resource sharing

### Acceptance Criteria
- [ ] Players can create and join alliances
- [ ] Alliance leaders can manage members
- [ ] Diplomatic treaties can be negotiated
- [ ] Alliance chat is separate from global chat
- [ ] Treaty violations are tracked

---

## Epic 7: Advanced Game Features
**Priority**: Low | **Estimated Effort**: 4-6 weeks

### User Stories
- **As a player**, I want to research technologies to improve my kingdom
- **As a player**, I want to cast spells and use magic
- **As a player**, I want to participate in special events

### Technical Tasks
1. **Magic System**
   - Spell casting interface
   - Mana/magic point management
   - Spell effects and calculations
   - Racial magic bonuses

2. **Technology Research**
   - Research tree interface
   - Technology effects on gameplay
   - Research point generation
   - Prerequisites and dependencies

3. **Special Events**
   - Random events system
   - Seasonal events
   - Tournament modes
   - Special victory conditions

### Acceptance Criteria
- [ ] Magic system works as in original game
- [ ] Technology research provides meaningful benefits
- [ ] Special events add variety to gameplay
- [ ] All systems integrate with existing features

---

## Epic 8: Mobile Optimization & Polish
**Priority**: Medium | **Estimated Effort**: 2-3 weeks

### User Stories
- **As a mobile player**, I want the game to work well on my phone
- **As a player**, I want smooth animations and good performance
- **As a player**, I want helpful tutorials and onboarding

### Technical Tasks
1. **Mobile Interface**
   - Touch-friendly controls
   - Responsive layout optimization
   - Mobile-specific navigation
   - Gesture support

2. **Performance Optimization**
   - Code splitting and lazy loading
   - Image optimization
   - Bundle size reduction
   - Caching strategies

3. **User Experience**
   - Interactive tutorial system
   - Helpful tooltips and hints
   - Smooth transitions
   - Loading states

### Acceptance Criteria
- [ ] Game works well on mobile devices
- [ ] Load times are under 3 seconds
- [ ] Tutorial guides new players effectively
- [ ] Interface is intuitive and polished

---

## Technical Debt & Infrastructure

### Monitoring & Analytics
- CloudWatch dashboards for system health
- Player behavior analytics
- Performance monitoring
- Error tracking and alerting

### Security & Compliance
- Input validation and sanitization
- Rate limiting and abuse prevention
- Data encryption and privacy
- Security audit and testing

### Testing Strategy
- Unit tests for game logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Performance testing under load

---

## Release Strategy

### Phase 1: MVP (Months 1-2)
- Authentication and basic kingdom management
- Simple combat system
- Core game mechanics

### Phase 2: Enhanced Features (Month 3)
- Real-time features
- Alliance system
- Mobile optimization

### Phase 3: Advanced Features (Month 4+)
- Magic and technology systems
- Special events
- Community features

### Success Metrics
- **Player Retention**: 30% return after 7 days
- **Session Length**: Average 45+ minutes
- **Technical Performance**: <2s load times, 99.5% uptime
- **Community Engagement**: Active alliance formation
- **User Satisfaction**: 4.0+ rating from feedback

This backlog provides a structured approach to building a modern version of the classic Monarchy game while maintaining the strategic depth that made it successful for over 25 years.
