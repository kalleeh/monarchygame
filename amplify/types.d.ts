// Ambient module declarations for Amplify environment imports
// Based on TypeScript documentation: ambient modules must be declared at top level

declare module "$amplify/env/building-constructor" {
  export const env: {
    readonly [key: string]: string | undefined;
  };
}

declare module "$amplify/env/resource-manager" {
  export const env: {
    readonly [key: string]: string | undefined;
  };
}

declare module "$amplify/env/spell-caster" {
  export const env: {
    readonly [key: string]: string | undefined;
  };
}

declare module "$amplify/env/territory-manager" {
  export const env: {
    readonly [key: string]: string | undefined;
  };
}

declare module "$amplify/env/unit-trainer" {
  export const env: {
    readonly [key: string]: string | undefined;
  };
}
