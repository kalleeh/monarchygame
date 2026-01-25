import { defineAuth } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource for Monarchy Game
 * Supports email login with username as preferred username attribute
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    preferredUsername: {
      required: false, // Changed to false to allow sign-up without it
      mutable: true,
    },
    email: {
      required: true,
      mutable: true,
    },
    givenName: {
      required: false,
      mutable: true,
    },
    familyName: {
      required: false,
      mutable: true,
    },
  },
  accountRecovery: 'EMAIL_ONLY',
});
