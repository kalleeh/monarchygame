import React from 'react';

// Define theme type inline to avoid import issues
interface AmplifyTheme {
  name: string;
  tokens: {
    colors?: Record<string, unknown>;
    components?: Record<string, unknown>;
    space?: Record<string, string>;
    radii?: Record<string, string>;
  };
}

/**
 * Custom Amplify UI theme for Monarchy Game
 * Matches the game's dark aesthetic with teal accents
 */
export const monarchyAuthTheme: AmplifyTheme = {
  name: 'Monarchy Dark Theme',
  tokens: {
    colors: {
      // Background colors matching game's dark theme
      background: {
        primary: 'rgba(0, 0, 0, 0.85)',
        secondary: 'rgba(0, 0, 0, 0.7)',
        tertiary: 'rgba(0, 0, 0, 0.3)',
      },
      // Brand colors using game's teal theme
      brand: {
        primary: {
          10: '#4ecdc4',
          20: '#44b3a8',
          40: '#6dd5cc',
          60: '#4ecdc4',
          80: '#44b3a8',
          90: '#6dd5cc',
          100: '#4ecdc4',
        },
      },
      // Text colors
      font: {
        primary: '#ffffff',
        secondary: '#cccccc',
        tertiary: '#999999',
        interactive: '#4ecdc4',
      },
      // Border colors
      border: {
        primary: 'rgba(255, 255, 255, 0.1)',
        secondary: 'rgba(78, 205, 196, 0.3)',
        tertiary: 'rgba(255, 255, 255, 0.05)',
      },
      // Overlay colors
      overlay: {
        10: 'rgba(0, 0, 0, 0.1)',
        20: 'rgba(0, 0, 0, 0.2)',
        30: 'rgba(0, 0, 0, 0.3)',
        40: 'rgba(0, 0, 0, 0.4)',
        50: 'rgba(0, 0, 0, 0.5)',
        60: 'rgba(0, 0, 0, 0.6)',
        70: 'rgba(0, 0, 0, 0.7)',
        80: 'rgba(0, 0, 0, 0.8)',
        90: 'rgba(0, 0, 0, 0.9)',
      },
    },
    components: {
      authenticator: {
        router: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: '12px',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(20px)',
        },
        form: {
          padding: '2rem',
          backgroundColor: 'transparent',
        },
      },
      button: {
        primary: {
          backgroundColor: '#4ecdc4',
          color: '#000000',
          borderRadius: '8px',
          fontWeight: '600',
          _hover: {
            backgroundColor: '#6dd5cc',
            transform: 'translateY(-1px)',
            boxShadow: '0 8px 25px rgba(78, 205, 196, 0.4)',
          },
          _active: {
            backgroundColor: '#44b3a8',
            transform: 'translateY(0)',
          },
          _focus: {
            boxShadow: '0 0 0 2px rgba(78, 205, 196, 0.5)',
          },
        },
        link: {
          color: '#4ecdc4',
          _hover: {
            color: '#6dd5cc',
          },
        },
      },
      fieldcontrol: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        color: '#ffffff',
        _focus: {
          borderColor: '#4ecdc4',
          boxShadow: '0 0 0 2px rgba(78, 205, 196, 0.5)',
        },
        _error: {
          borderColor: '#e17055',
          boxShadow: '0 0 0 2px rgba(225, 112, 85, 0.3)',
        },
      },
      tabs: {
        item: {
          color: '#cccccc',
          borderColor: 'transparent',
          _active: {
            color: '#4ecdc4',
            borderColor: '#4ecdc4',
          },
          _hover: {
            color: '#6dd5cc',
          },
        },
      },
      text: {
        primary: {
          color: '#ffffff',
        },
        secondary: {
          color: '#cccccc',
        },
      },
      heading: {
        color: '#ffffff',
        fontWeight: '600',
      },
    },
    space: {
      xs: '0.25rem',
      small: '0.5rem',
      medium: '1rem',
      large: '1.5rem',
      xl: '2rem',
      xxl: '3rem',
    },
    radii: {
      small: '6px',
      medium: '8px',
      large: '12px',
    },
  },
};

/**
 * Custom form field configuration for better UX
 */
export const monarchyFormFields = {
  signIn: {
    username: {
      placeholder: 'Enter your email',
      label: 'Email',
      isRequired: true,
    },
    password: {
      placeholder: 'Enter your password',
      label: 'Password',
      isRequired: true,
    },
  },
  signUp: {
    email: {
      placeholder: 'Enter your email',
      label: 'Email',
      isRequired: true,
      order: 1,
    },
    preferred_username: {
      placeholder: 'Choose your kingdom name',
      label: 'Kingdom Name',
      isRequired: true,
      order: 2,
    },
    password: {
      placeholder: 'Create a strong password',
      label: 'Password',
      isRequired: true,
      order: 3,
    },
    confirm_password: {
      placeholder: 'Confirm your password',
      label: 'Confirm Password',
      isRequired: true,
      order: 4,
    },
  },
  forgotPassword: {
    username: {
      placeholder: 'Enter your email',
      label: 'Email',
    },
  },
  confirmResetPassword: {
    confirmation_code: {
      placeholder: 'Enter verification code',
      label: 'Verification Code',
    },
    confirm_password: {
      placeholder: 'Enter your new password',
      label: 'New Password',
    },
  },
};

/**
 * Custom components for enhanced branding
 */
export const monarchyAuthComponents = {
  Header() {
    return React.createElement('div', {
      style: { 
        textAlign: 'center' as const, 
        padding: '2rem 0 1rem 0',
        background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(78, 205, 196, 0.05))',
        borderRadius: '12px 12px 0 0',
        marginBottom: '1rem'
      }
    }, [
      React.createElement('h1', {
        key: 'title',
        style: { 
          color: '#4ecdc4', 
          fontSize: '2rem', 
          fontWeight: '700' as const,
          margin: '0',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
        }
      }, '⚔️ Monarchy Game'),
      React.createElement('p', {
        key: 'subtitle',
        style: { 
          color: '#cccccc', 
          fontSize: '1rem', 
          margin: '0.5rem 0 0 0',
          opacity: 0.8
        }
      }, 'Enter your kingdom')
    ]);
  },
  
  Footer() {
    return React.createElement('div', {
      style: { 
        textAlign: 'center' as const, 
        padding: '1rem 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        marginTop: '1rem'
      }
    }, 
      React.createElement('p', {
        style: { 
          color: '#999999', 
          fontSize: '0.875rem', 
          margin: '0'
        }
      }, '© 2025 Monarchy Game - Strategic Kingdom Management')
    );
  },
};
