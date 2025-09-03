// This object will hold the instances provided by the user.
export const userConfig: { react?: any; 'react-dom/client'?: any } = {};

/**
 * A user-facing function to configure dependencies at runtime.
 * @param deps An object containing the user's own instances of libraries.
 */
export function configureDependencies(deps: { react?: any; 'react-dom/client'?: any }): void {
  Object.assign(userConfig, deps);
}