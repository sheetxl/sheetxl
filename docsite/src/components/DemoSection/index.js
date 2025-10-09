import React from 'react';

import Album from '@site/src/components/Album';
import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';

const examples = [
  {
    url: `https://demo.sheetxl.com?source=${encodeURI('https://www.sheetxl.com/docs/examples/feature-highlights.xlsx')}`,
    src: '/docs/examples/feature-highlights-thumb.png',
    gitSource: 'https://github.com/sheetxl/sheetxl/tree/main/examples/studio-mui',
    title: 'Feature Highlights',
    description: `Highlights current and planned features.`,
  },
  {
    url: 'https://storybook.sheetxl.com',
    src: '/docs/img/storybook.jpeg',
    gitSource: 'https://github.com/sheetxl/sheetxl/tree/main/examples/storybook',
    title: 'Storybook',
    description: `Examples using Storybook.`,
  },
  {
    url: `https://demo.sheetxl.com?source=${encodeURI('https://www.sheetxl.com/docs/examples/financial-calculators.xlsx')}`,
    src: '/docs/examples/financial-calculators-thumb.png',
    title: 'Financial Model',
    description: `A Financial Model.`
  },
  {
    url: `http://demo-cdn.sheetxl.com`,
    src: '/docs/examples/sheetxl-cdn.png',
    title: 'Loading from CDN',
    description: `Loading from a CDN.`
  },
  // TODO - add add an example of tldraw with an embedded spreadsheet
];

export default function Demos(props) {
  return (
    <MUIThemeWrapper>
      <Album
        cards={examples}
        {...props}
      />
    </MUIThemeWrapper>
  );
}