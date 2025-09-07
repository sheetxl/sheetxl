import path from 'path';

//import {themes as prismThemes} from 'prism-react-renderer';
import { github as lightCodeTheme } from 'prism-react-renderer';
import { dracula as darkCodeTheme } from 'prism-react-renderer';

async function myPlugin(_context, _opts) {
  return {
    name: 'sheetxl-webpackModifier-plugin',
    configureWebpack(config, isServer, _utils, _content) {
        config.externals = {
        ...(config.externals || {}),
        'esbuild': 'esbuild'
        // 'esbuild-wasm': 'esbuild-wasm'
        // react: 'React',
        // 'react-dom': 'ReactDOM',
        // add more externals as needed
      };
      // Initialize alias if it doesn't exist
      if (!config.resolve.alias) config.resolve.alias = {};

      // Fix emotion imports
      // config.resolve.alias['@emotion/styled'] = path.resolve(__dirname, 'node_modules/@emotion/styled/dist/emotion-styled.cjs.js');
      // config.resolve.alias['@emotion/react'] = path.resolve(__dirname, 'node_modules/@emotion/react/dist/emotion-react.cjs.js');
      // the packages are designed to use runtime detection for node/browser environments,
      const packagesDir = path.resolve(__dirname, '../packages');
      const selfContainedPackages = ['sdk', 'studio-mui', 'io', 'scripting'];
      selfContainedPackages.forEach(pkg => {
        const pkgBuildPath = path.resolve(packagesDir, pkg, 'build');
        if (isServer) {
          config.resolve.alias[`@sheetxl/${pkg}`] = false;
        } else {
          // Check if we're in development (local) or production (CI)
          const isDev = process.env.NODE_ENV === 'development' || !process.env.CI;

          if (isDev) {
            // Development: Use local build for immediate testing
            console.log(`Using local build for @sheetxl/${pkg} in development or local`);
            config.resolve.alias[`@sheetxl/${pkg}`] = path.resolve(pkgBuildPath, 'browser/esm/index.mjs');
          } else {
            // Production: Use published npm packages (no alias = use from node_modules)
            console.log(`Using npm package for @sheetxl/${pkg} in production`);
            // Don't set alias - let webpack resolve from node_modules
          }
        }
      });

      // TODO - why is this needed?
      const fallback = config.resolve.fallback ?? {};
      fallback['crypto'] = false;
      fallback['os'] = false;
      fallback['fs'] = false;
      fallback['fs/promises'] = false;
      if (!isServer) {
        // These may still be needed for client-side MUI dependencies
        fallback['path'] = require.resolve('path-browserify');
        config.resolve.fallback = fallback;
      }

      // Add webpack rules for better JS module handling
      const rules = config.module?.rules ?? [];
      const newRule = {
        oneOf: [
          {
            test: /\.(js|mjs)$/,
            type: "javascript/auto",
            resolve: {
              fullySpecified: false,
            }
          },
        ]
      };
      rules.unshift(newRule);
      // Suppress warnings from the built packages (they're already optimized)
      if (!config.ignoreWarnings) {
        config.ignoreWarnings = [];
      }
      config.ignoreWarnings.push({
        // module: /node_modules/,
        message: /Critical dependency: the request of a dependency is an expression/,
      });
    },
  };
}

// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

// const lightCodeTheme = require('prism-react-renderer/themes/github');
// const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  // og:title is using this too
  title: 'SheetXL - Spreadsheet power in your app—in minutes.',
  tagline: `Spreadsheet Power, Excel Compatibility.`,
  favicon: 'favicon.ico',
  // staticDirectories: ['public'], // default is ['static']
  // Set the production url of your site here
  url: 'https://www.sheetxl.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/docs/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'sheetxl', // Usually your GitHub org/user name.
  projectName: 'sheetxl', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  headTags: [
    // Declare a <link> preconnect tag
    // {
    //   tagName: 'link',
    //   attributes: {
    //     rel: 'preconnect',
    //     href: 'https://example.com',
    //   },
    // },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: '/docs/img/logo_x32.png',
        sizes: '32x32'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: '/docs/img/logo_x48.png',
        sizes: '48x48'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: '/docs/img/logo_x96.png',
        sizes: '96x96'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: '/docs/img/logo_x192.png',
        sizes: '192x192'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: '/docs/img/logo_x512.png',
        sizes: '512x512'
      },
    },
    // Declare some json-ld structured data
    {
      tagName: 'script',
      attributes: {
        type: 'application/ld+json',
      },
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org/',
        // '@graph': [{
        '@type': 'WebSite',
        'name': 'SheetXL',
        'alternateName': [ 'SheetXL' ],
        'url': 'https://www.sheetxl.com/',
        'logo': 'https://www.sheetxl.com/img/logo_x192.png'
        // }]
      }),
    },
  ],
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        debug: true,
        gtag: {
          trackingID: ['G-1JGL700TV6']
          // anonymizeIP: true, is this a GDPR thing?
        },
        docs: {
          routeBasePath: '/guides',
          sidebarPath: require.resolve('./sidebars.js'),
          remarkPlugins: [
            [require('@docusaurus/remark-plugin-npm2yarn'), {sync: true}]
          ],
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl:
          //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        pages: {
          remarkPlugins: [require('@docusaurus/remark-plugin-npm2yarn')]
        },
        blog: {
          showReadingTime: true,
          remarkPlugins: [
            [
              require('@docusaurus/remark-plugin-npm2yarn'),
              {converters: ['pnpm']},
            ]
          ]
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl:
          //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
          ignorePatterns: ['/tags/**'],
          filename: 'sitemap.xml',
        }
      }),
    ],
  ],
  themes: ['live-codeblock'],
  plugins: [
    myPlugin,
    require.resolve('docusaurus-lunr-search')
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // social card
      image: 'img/social.png',
      navbar: {
        title: 'SheetXL',
        logo: {
          alt: 'SheetXL',
          src: 'img/sheetxl-logo.svg',
          href: 'https://www.sheetxl.com',
          target: '_self',
        },
        items: [
          {to: '/docs/demos', label: 'Demos', position: 'left'},
          {to: '/docs/pricing', label: 'Pricing', position: 'left'},
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'right',
            label: 'Guides',
          },
          // {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/sheetxl/sheetxl',
            label: 'GitHub',
            position: 'right',
          },
          { to: '/guides/resources-community/support', label: 'Support', position: 'right' },
          {
            href: 'https://my.sheetxl.com',
            label: 'Sign-in',
            position: 'right',
          }
        ]
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Guides',
                to: '/guides',
              },
              {
                label: 'API Reference',
                to: 'https://api.sheetxl.com',
              }
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/NTKdwUgK9p',
              },
            ],
          }, {
            title: 'Legal',
            items: [
              {
                label: 'Privacy Policy',
                to: '/privacy',
              },
              {
                label: 'End User License Agreement',
                href: '/eula',
              },
              {
                label: 'Terms and Conditions',
                href: '/terms',
              }
            ],
          },
          {
            title: 'More',
            items: [
              // {
              //   label: 'Blog',
              //   to: '/blog',
              // },
              {
                label: 'GitHub',
                href: 'https://github.com/sheetxl/sheetxl',
              },
              {
                label: 'Support',
                to: '/guides/resources-community/support',
              },
              {
                label: 'Sign-in',
                href: 'https://my.sheetxl.com',
              }
            ],
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} SheetXL Inc. Built for developers.`,
      },
      liveCodeBlock: {
        /**
         * The position of the live playground, above or under the editor
         * Possible values: "top" | "bottom"
         */
        playgroundPosition: 'bottom',
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      metadata: [
        {name: 'keywords', content: 'spreadsheet, sdk, ai, react, excel, open-source, datagrid'},
        {name: 'og:locale', content: 'en_us'},
        {name: 'og:type', content: 'website'},

        {name: 'og:url', content: 'https://www.sheetxl.com'},
        {name: 'og:site_name', content: 'SheetXL'},
        // {name: 'og:description', content: `SheetXL is a spreadsheet and a data-grid. Fast⚡, beautiful, and compatible with Excel. Built using React, Typescript, and MUI.`},
        // // this is being overwritten by title from docusaurus
        // // {name: 'og:title', content: 'A React spreadsheet and a datagrid | SheetXL'},
        // // {name: 'og:image', content: 'https://www.sheetxl.com/img/social.png'}, // defined in image tag
        // {name: 'og:image:width', content: '1200'},
        // {name: 'og:image:height', content: '630'},
        // {name: 'og:image:alt', content: 'A React Spreadsheet and a datagrid,'},
        // {name: 'twitter:card', content: 'SheetXL is a React Spreadsheet and a datagrid.'},
        // {name: 'twitter:card', content: 'summary_large_image'},
        // {name: 'twitter:site', content: '@sheetxl'},
      ]
    }),
};

module.exports = config;
