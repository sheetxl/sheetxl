import { themes as prismThemes } from 'prism-react-renderer';

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

// Each channel's docsite is its own host, served at the root: docs.sheetxl.com for stable and
// docs.beta.sheetxl.com for beta. Defaults are the stable values.
const siteUrl = process.env.DOCS_URL || 'https://docs.sheetxl.com';
const siteBaseUrl = process.env.DOCS_BASE_URL || '/';
// Beta duplicates the production docs and documents an unreleased API, so every page carries
// `<meta name="robots" content="noindex, nofollow">`. The deploy pairs this with an
// X-Robots-Tag header for the assets that have no HTML head.
const siteNoIndex = process.env.DOCS_NO_INDEX === 'true';
// Sibling SheetXL sites are per-channel too. Beta docs linking to api.sheetxl.com would send a
// tester to the reference for the stable API they are not running. `my` has no beta host, so it
// is left hardcoded.
const siteChannel = process.env.DOCS_CHANNEL || 'stable';
const siteHost = (name) => siteChannel === 'beta'
  ? `https://${name}.beta.sheetxl.com`
  : `https://${name}.sheetxl.com`;
// The release these docs describe. Package versions in the tree are placeholders; the release
// tag is the only place the real version lives, so CI passes it in.
const siteVersion = (process.env.DOCS_VERSION || '').replace(/^v/, '');

// Cross-site links written in markdown carry the production host. Rewriting them here rather
// than in the content keeps one copy of each page across channels. Only `link` nodes are
// visited, so a URL shown inside a code sample stays literal.
//
// A link to the docsite itself is written as `https://www.sheetxl.com/docs/...`, the address
// that redirects to the stable docs. It resolves to wherever this build is served.
const siteDocsRoot = `${siteUrl}${siteBaseUrl}`.replace(/\/$/, '');
function remarkChannelLinks() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'link' && typeof node.url === 'string') {
        node.url = /^https:\/\/www\.sheetxl\.com\/docs(?=$|[/#?])/.test(node.url)
          ? node.url.replace('https://www.sheetxl.com/docs', siteDocsRoot)
          : node.url.replace(
            /^https:\/\/(www|api|demo|demo-cdn|storybook)\.sheetxl\.com/,
            (_match, name) => siteHost(name)
          );
      }
      (node.children || []).forEach(visit);
    };
    visit(tree);
  };
}

// Install and scaffold commands resolve a dist-tag at run time, so an untagged command in the
// beta docs quietly installs stable. Rewritten per channel rather than in the content, and only
// on lines that are actually package-manager invocations - an `import ... from '@sheetxl/sdk'`
// inside a sample must survive untouched.
function rewritePackageSpecs(text) {
  if (siteChannel !== 'beta') return text;
  const TAG = '@beta';
  return text.split('\n').map((line) => {
    // CDN URLs pin with @latest; jsdelivr resolves dist-tags the same way.
    let out = line.replace(/(@sheetxl\/[a-z0-9-]+)@latest/g, `$1${TAG}`);
    if (/^\s*(npm|pnpm|yarn|bun|npx)\b/.test(out)) {
      out = out.replace(/\b(create\s+sheetxl)(?![@\w-])/g, `$1${TAG}`);
      out = out.replace(/\b(create-sheetxl)(?![@\w-])/g, `$1${TAG}`);
      out = out.replace(/\bnpx(\s+)sheetxl(?![@\w/-])/g, `npx$1sheetxl${TAG}`);
      // Only a real install command may put a tag onto a package name; an import in a sample
      // must not be touched.
      if (/^\s*(npm|pnpm|yarn|bun)\s+(add|install|i)\b/.test(out)) {
        out = out.replace(/(@sheetxl\/[a-z0-9-]+)(?![@\w/-])/g, `$1${TAG}`);
      }
    }
    return out;
  }).join('\n');
}

function remarkChannelPackages() {
  return (tree) => {
    const visit = (node) => {
      if ((node.type === 'code' || node.type === 'inlineCode') && typeof node.value === 'string') {
        node.value = rewritePackageSpecs(node.value);
      }
      (node.children || []).forEach(visit);
    };
    visit(tree);
  };
}

/** @type {import('@docusaurus/types').Config} */
const config = {
  // og:title is using this too
  title: 'SheetXL - Spreadsheet power in your app—in minutes.',
  tagline: `Spreadsheet Power, Excel Compatibility.`,
  favicon: 'favicon.ico',
  // staticDirectories: ['public'], // default is ['static']
  // Set the production url of your site here
  url: siteUrl,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: siteBaseUrl,
  noIndex: siteNoIndex,
  // Read by components that link to sibling sites; see siteHost above.
  customFields: { channel: siteChannel },

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'sheetxl', // Usually your GitHub org/user name.
  projectName: 'sheetxl', // Usually your repo name.

  // onBrokenLinks: 'throw',
  // onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  headTags: [
    // Inter, the landing site's typeface. Loaded from Google Fonts rather than bundled so the
    // docs build stays free of font assets; the CSS falls back to the system stack until it
    // arrives.
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: `${siteBaseUrl}img/logo_x32.png`,
        sizes: '32x32'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: `${siteBaseUrl}img/logo_x48.png`,
        sizes: '48x48'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: `${siteBaseUrl}img/logo_x96.png`,
        sizes: '96x96'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: `${siteBaseUrl}img/logo_x192.png`,
        sizes: '192x192'
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        type: 'image/png',
        href: `${siteBaseUrl}img/logo_x512.png`,
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
            [require('@docusaurus/remark-plugin-npm2yarn'), {sync: true}],
            remarkChannelLinks,
            remarkChannelPackages
          ],
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          // editUrl:
          //   'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        pages: {
          remarkPlugins: [require('@docusaurus/remark-plugin-npm2yarn'), remarkChannelLinks, remarkChannelPackages]
        },
        blog: {
          showReadingTime: true,
          remarkPlugins: [
            [
              require('@docusaurus/remark-plugin-npm2yarn'),
              {converters: ['pnpm']},
            ],
            remarkChannelLinks,
            remarkChannelPackages
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
      // Beta docs are reachable by direct link and describe an unreleased API, so every page
      // says which build it documents and how to install it.
      ...(siteChannel === 'beta' ? {
        announcementBar: {
          id: `beta-${siteVersion}`,
          content: (siteVersion ? `Beta documentation for <b>${siteVersion}</b>. ` : 'Beta documentation. ')
            + 'Install with the <code>beta</code> tag, e.g. <code>pnpm add @sheetxl/studio-mui@beta</code>.',
          backgroundColor: '#5b21b6',
          textColor: '#ffffff',
          isCloseable: true,
        },
      } : {}),
      // The landing follows the OS setting until a visitor picks a mode; do the same here so the
      // two agree before any choice has been stored.
      colorMode: {
        respectPrefersColorScheme: true,
      },
      navbar: {
        logo: {
          alt: 'SheetXL',
          src: 'img/logo-wordmark.svg',
          srcDark: 'img/logo-wordmark-white.svg',
          // The landing page, which is not this site's own host on beta.
          href: siteHost('www'),
          target: '_self',
        },
        items: [
          {href: `${siteHost('www')}/demos`, label: 'Demos', position: 'left'},
          {href: `${siteHost('www')}/pricing`, label: 'Pricing', position: 'left'},
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
          { href: `${siteHost('www')}/support`, label: 'Support', position: 'right' },
          {
            href: 'https://my.sheetxl.com',
            label: 'Sign-in',
            position: 'right',
          }
        ]
      },
      footer: {
        style: 'light',
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
                to: siteHost('api'),
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
                href: `${siteHost('www')}/privacy`,
              },
              {
                label: 'End User License Agreement',
                href: `${siteHost('www')}/eula`,
              },
              {
                label: 'Terms and Conditions',
                href: `${siteHost('www')}/terms`,
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
                href: `${siteHost('www')}/support`,
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
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
      metadata: [
        {name: 'keywords', content: 'spreadsheet, sdk, ai, react, excel, open-source, datagrid'},
        {name: 'og:locale', content: 'en_us'},
        {name: 'og:type', content: 'website'},

        {name: 'og:url', content: siteUrl},
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
