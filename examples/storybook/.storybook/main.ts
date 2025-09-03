import type { StorybookConfig } from '@storybook/react-vite';

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