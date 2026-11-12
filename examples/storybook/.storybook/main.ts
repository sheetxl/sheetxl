import { type StorybookConfig } from '@storybook/react-vite';

// NOTE: `ResourcesPlugin` (which serves each `@sheetxl/*` package's `locales/`) is wired in the
// auto-loaded `../vite.config.ts`, NOT here. Importing the build-time plugin's `.ts` chain into this
// file makes Storybook's config bundler warn about the extensionless imports throughout our internal
// build tooling; Vite's own config loader handles that chain cleanly, so the wiring lives there.

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest"
  ],
  framework: {
    "name": "@storybook/react-vite",
    "options": {}
  },
  typescript: {
    // this will turn off doc gen
    reactDocgen: false,
    // reactDocgen: "react-docgen-typescript",
    // reactDocgenTypescriptOptions: {
    //   shouldExtractLiteralValuesFromEnum: true,
    //   propFilter: (prop) =>
    //     prop.parent
    //       ? !/node_modules/.test(prop.parent.fileName) // Exclude node_modules
    //       : true,
    // }
  }
};
export default config;