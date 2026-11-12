import { type Preview } from '@storybook/react-vite'

import { addResourceRoot } from '@sheetxl/utils';

// Only English is bundled. Other languages (German today) ship as JSON files in each
// @sheetxl package's resources/ folder, which this monorepo's Vite ResourcesPlugin copies to
// /resources at build time. Registering that URL lets the language menu find those packs and
// fetch one when it is picked. Remove this line and the app runs in English with no requests.
addResourceRoot('/resources');

const preview: Preview = {
  parameters: {
    options: {
      // Pin these three top-level groups to the front; '*' keeps everything else in its default order.
      storySort: {
        order: ['Studio', 'Workbook', 'Sheet', '*'],
      },
    },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    },

    docs: {
      // Use the static source extractor instead of Storybook's jsxDecorator, which
      // serializes the live element tree via react-element-to-jsx-string and reads
      // `element.ref` on every node — triggering React 19's "Accessing element.ref
      // was removed" warning. 'code' skips that serialization, but jsxDecorator still calls the
      // story function a second time — see `asStory` for why templates with hooks need it.
      source: { type: 'code' }
    }
  },
};

export default preview;