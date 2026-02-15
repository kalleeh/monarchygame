/**
 * Welcome Page Component
 * Engaging landing page that showcases the game before requiring authentication
 */

import React, { useState, useEffect } from 'react';
import { RACES } from '../shared-races';
import './WelcomePage.css';

interface WelcomePageProps {
  onGetStarted: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onGetStarted }) => {
  const [selectedRace, setSelectedRace] = useState<string>('Human');
  const [currentFeature, setCurrentFeature] = useState<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const rate = scrolled * -0.3; // Reduced parallax speed
      const bg = document.querySelector('.parallax-bg') as HTMLElement;
      if (bg) {
        bg.style.transform = `translate3d(0, ${Math.max(rate, -100)}px, 0)`; // Limit movement
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      title: "Build Your Kingdom",
      description: "Create and manage territories, construct buildings, and grow your population",
      icon: "🏰"
    },
    {
      title: "Epic Combat System", 
      description: "Launch strategic attacks, defend your realm, and conquer enemy territories",
      icon: "⚔️"
    },
    {
      title: "Choose Your Race",
      description: "Select from 10 unique races, each with special abilities and bonuses",
      icon: "👑"
    },
    {
      title: "Real-Time Strategy",
      description: "Experience live notifications, real-time battles, and dynamic gameplay",
      icon: "⚡"
    }
  ];

  const raceKeys = Object.keys(RACES);
  const currentRace = RACES[selectedRace as keyof typeof RACES];

  const getRaceImage = (raceName: string) => {
    const raceImages: Record<string, string> = {
      'Human': '/output/human-kingdom.png',
      'Elven': '/output/elven-kingdom.png', 
      'Goblin': '/output/goblin-kingdom.png',
      'Droben': '/output/droben-kingdom.png',
      'Vampire': '/output/vampire-kingdom.png',
      'Elemental': '/output/elemental-kingdom.png',
      'Centaur': '/output/centaur-kingdom.png',
      'Sidhe': '/output/sidhe-kingdom.png',
      'Dwarven': '/output/dwarven-kingdom.png',
      'Fae': '/output/fae-kingdom.png'
    };
    return raceImages[raceName] || '/output/human-kingdom.png';
  };

  return (
    <div className="welcome-page">
      {/* Parallax Background */}
      <div className="parallax-bg" />
      
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            <img src="/logo.png" alt="Monarchy Crown" className="hero-logo" />
            Monarchy
            <span className="subtitle">The Ultimate Strategy Game</span>
          </h1>
          
          <p className="hero-description">
            Build mighty kingdoms, forge powerful alliances, and conquer your enemies in this 
            epic browser-based strategy game. Choose your race, develop your territories, 
            and rise to become the ultimate ruler.
          </p>

          <div className="hero-actions">
            <button className="cta-button primary" onClick={onGetStarted}>
              <span className="button-glow"></span>
              Start Your Reign
            </button>
            <button className="cta-button secondary" onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Learn More
            </button>
            <button className="cta-button demo" onClick={() => {
              // Demo mode - skip authentication
              localStorage.setItem('demo-mode', 'true');
              onGetStarted();
            }}>
              🎮 Demo Mode
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-castle">
            <img src="/logo.png" alt="Monarchy Crown" className="castle-main" />
            <div className="floating-elements">
              <span className="float-1">⚔️</span>
              <span className="float-2">🛡️</span>
              <span className="float-3">🏹</span>
              <span className="float-4">✨</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <h2>Game Features</h2>
        
        <div className="features-showcase">
          <div className="feature-tabs">
            {features.map((feature, index) => (
              <button
                key={index}
                className={`feature-tab ${currentFeature === index ? 'active' : ''}`}
                onClick={() => setCurrentFeature(index)}
              >
                <span className="feature-icon">{feature.icon}</span>
                <span className="feature-name">{feature.title}</span>
              </button>
            ))}
          </div>

          <div className="feature-content">
            <div className="feature-display">
              <div className="feature-icon-large">
                {features[currentFeature].icon}
              </div>
              <h3>{features[currentFeature].title}</h3>
              <p>{features[currentFeature].description}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Race Selection Preview */}
      <section className="races-preview">
        <h2>Choose Your Destiny</h2>
        <p>Each race offers unique advantages and playstyles</p>
        
        <div className="race-selector">
          <div className="race-tabs">
            {raceKeys.map((raceKey) => (
              <button
                key={raceKey}
                className={`race-tab ${selectedRace === raceKey ? 'active' : ''}`}
                onClick={() => setSelectedRace(raceKey)}
              >
                {raceKey}
              </button>
            ))}
          </div>

          <div className="race-showcase">
            <div className="race-image">
              <img 
                src={getRaceImage(selectedRace)} 
                alt={`${selectedRace} kingdom`}
                className="race-artwork"
              />
              <div className="image-overlay"></div>
            </div>
            
            <div className="race-details">
              <div className="race-info">
                <h3>{currentRace.name}</h3>
                <p className="race-description">{currentRace.description}</p>
                
                <div className="race-stats">
                  <h4>Racial Bonuses (All 10 Stats)</h4>
                  <div className="stats-grid">
                    <div className="stat">
                      <span className="stat-label">War Offense:</span>
                      <div className="stat-bar">
                        <div className="stat-fill offense" style={{ width: `${(currentRace.stats.warOffense / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.warOffense}/5</span>
                    </div>
                    
                    <div className="stat">
                      <span className="stat-label">War Defense:</span>
                      <div className="stat-bar">
                        <div className="stat-fill defense" style={{ width: `${(currentRace.stats.warDefense / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.warDefense}/5</span>
                    </div>
                    
                    <div className="stat">
                      <span className="stat-label">Sorcery:</span>
                      <div className="stat-bar">
                        <div className="stat-fill sorcery" style={{ width: `${(currentRace.stats.sorcery / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.sorcery}/5</span>
                    </div>

                    <div className="stat">
                      <span className="stat-label">Scum:</span>
                      <div className="stat-bar">
                        <div className="stat-fill scum" style={{ width: `${(currentRace.stats.scum / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.scum}/5</span>
                    </div>

                    <div className="stat">
                      <span className="stat-label">Forts:</span>
                      <div className="stat-bar">
                        <div className="stat-fill forts" style={{ width: `${(currentRace.stats.forts / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.forts}/5</span>
                    </div>

                    <div className="stat">
                      <span className="stat-label">Tithe:</span>
                      <div className="stat-bar">
                        <div className="stat-fill tithe" style={{ width: `${(currentRace.stats.tithe / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.tithe}/5</span>
                    </div>

                    <div className="stat">
                      <span className="stat-label">Training:</span>
                      <div className="stat-bar">
                        <div className="stat-fill training" style={{ width: `${(currentRace.stats.training / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.training}/5</span>
                    </div>

                    <div className="stat">
                      <span className="stat-label">Siege:</span>
                      <div className="stat-bar">
                        <div className="stat-fill siege" style={{ width: `${(currentRace.stats.siege / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.siege}/5</span>
                    </div>
                    
                    <div className="stat">
                      <span className="stat-label">Economy:</span>
                      <div className="stat-bar">
                        <div className="stat-fill economy" style={{ width: `${(currentRace.stats.economy / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.economy}/5</span>
                    </div>

                    <div className="stat">
                      <span className="stat-label">Building:</span>
                      <div className="stat-bar">
                        <div className="stat-fill building" style={{ width: `${(currentRace.stats.building / 5) * 100}%` }} />
                      </div>
                      <span className="stat-value">{currentRace.stats.building}/5</span>
                    </div>
                  </div>
                </div>

                <div className="special-ability">
                  <h4>Special Ability</h4>
                  <p>{currentRace.specialAbility.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="final-cta">
        <div className="cta-content">
          <h2>Ready to Build Your Empire?</h2>
          <p>Join thousands of players in epic strategic warfare</p>
          
          <div className="game-stats">
            <div className="stat-item">
              <span className="stat-number">10</span>
              <span className="stat-label">Unique Races</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">∞</span>
              <span className="stat-label">Strategic Possibilities</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">24/7</span>
              <span className="stat-label">Real-Time Action</span>
            </div>
          </div>

          <button className="cta-button primary large" onClick={onGetStarted}>
            <span className="button-icon">👑</span>
            Start Playing Now - It's Free!
          </button>
          
          <p className="cta-note">No download required • Play in your browser • Join in seconds</p>
        </div>
      </section>
    </div>
  );
};

export default WelcomePage;
