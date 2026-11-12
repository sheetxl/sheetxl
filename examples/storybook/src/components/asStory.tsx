import React from 'react';

import { type ReactRenderer } from '@storybook/react-vite';
import { type AnnotatedStoryFn } from 'storybook/internal/types';

/**
 * The story function `asStory` returns. A named, non-conditional alias, so exported stories have a
 * type that declaration emit can reference.
 */
export type Story<P extends object = object> = AnnotatedStoryFn<ReactRenderer, P>;

/**
 * A story function that renders `Component` as an element, for `export const X = asStory(Template)`.
 *
 * Use this instead of `Template.bind({})` whenever the template calls hooks. Storybook's React
 * `jsxDecorator` calls the story function a second time, inline, for source extraction; a template
 * called that way runs its hooks inside the decorator's own fiber. That copy's `useMemo` builds a
 * second workbook that is never rendered, and its effects run after the visible copy's, so a bind or
 * a subscription made there wins. A story function that only creates an element has no hooks to
 * duplicate. Each call returns a new function, so `X.args` / `X.storyName` stay per story.
 */
export const asStory = <P extends object>(Component: React.ComponentType<P>): Story<P> =>
  (args: P) => <Component {...args} />;
