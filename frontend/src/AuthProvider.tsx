// Lazy-loaded auth UI chunk: @aws-amplify/ui-react + its styles.
// Only loaded when the user clicks "Sign In" (showAuth === true).
import type { ReactNode } from 'react';
import '@aws-amplify/ui-react/styles.css';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import type { AuthUser } from 'aws-amplify/auth';
import { monarchyAuthTheme, monarchyFormFields, monarchyAuthComponents } from './themes/authenticatorTheme';

interface AuthProviderProps {
  children: (props: { signOut?: () => void; user: AuthUser | undefined }) => ReactNode;
}

export default function AuthProviderUI({ children }: AuthProviderProps) {
  return (
    <ThemeProvider theme={monarchyAuthTheme}>
      <Authenticator
        formFields={monarchyFormFields}
        components={monarchyAuthComponents}
        signUpAttributes={['email', 'preferred_username']}
        loginMechanisms={['email']}
      >
        {({ signOut, user }) => children({ signOut, user })}
      </Authenticator>
    </ThemeProvider>
  );
}
