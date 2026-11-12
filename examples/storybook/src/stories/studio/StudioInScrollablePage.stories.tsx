import React, { useEffect, useRef, useState } from 'react';

import { Studio } from '@sheetxl/studio-mui';

import { asStory } from '../../components';

/**
 * Hosts the Studio inside a normal, document-scrolled web page (the shape of a Next.js / marketing
 * page): content above and below, the window is the scroller, and the Studio is a fixed-height block
 * partway down.
 *
 * Storybook's preview pins `body` and `#storybook-root` to `position: absolute; height: 100%`, which
 * is not what a real page looks like, so this story un-pins them while mounted.
 *
 * To reproduce: scroll down until the Studio is in view, then type `=a` into a cell (autocomplete),
 * click into the formula bar, or hover a column divider. The badge in the corner shows the live
 * `window.scrollY` and the last unexpected jump.
 */
const usePageScrollHost = (): void => {
  useEffect(() => {
    const root = document.getElementById('storybook-root');
    const saved = {
      htmlHeight: document.documentElement.style.height,
      bodyPosition: document.body.style.position,
      bodyHeight: document.body.style.height,
      rootPosition: root?.style.position,
      rootHeight: root?.style.height
    };
    document.documentElement.style.height = 'auto';
    document.body.style.position = 'static';
    document.body.style.height = 'auto';
    if (root) {
      root.style.position = 'static';
      root.style.height = 'auto';
    }
    return () => {
      document.documentElement.style.height = saved.htmlHeight;
      document.body.style.position = saved.bodyPosition;
      document.body.style.height = saved.bodyHeight;
      if (root) {
        root.style.position = saved.rootPosition ?? '';
        root.style.height = saved.rootHeight ?? '';
      }
    };
  }, []);
};

/**
 * Tracks `window.scrollY` and records any jump that wasn't driven by the wheel, a key, or a
 * scrollbar drag. Also logs a stack for the jump to the console, with the focused element.
 */
const ScrollMonitor: React.FC = () => {
  const [scrollY, setScrollY] = useState(0);
  const [lastJump, setLastJump] = useState<string>('none');
  const refUserScroll = useRef(0);

  useEffect(() => {
    let last = window.scrollY;
    const markUser = (): void => { refUserScroll.current = performance.now(); };
    // Only page-level keys scroll the window; typing into the grid or an editor must not count.
    const onKeyDown = (): void => {
      if (document.activeElement === document.body) markUser();
    };
    const onScroll = (): void => {
      const next = window.scrollY;
      const userDriven = performance.now() - refUserScroll.current < 250;
      if (!userDriven && Math.abs(next - last) > 50) {
        const active = document.activeElement as HTMLElement | null;
        const desc = active
          ? `${active.tagName.toLowerCase()}${active.className ? '.' + String(active.className).split(' ').join('.') : ''}`
          : 'none';
        const msg = `${Math.round(last)} → ${Math.round(next)} (focus: ${desc})`;
        setLastJump(msg);
        console.warn('[scroll-jump]', msg, active);
      }
      last = next;
      setScrollY(next);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', markUser, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    // A drag on the document scrollbar lands on <html>.
    const onPointerDown = (e: PointerEvent): void => {
      if (e.target === document.documentElement) markUser();
    };
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', markUser);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed', right: 12, top: 12, zIndex: 2000,
        padding: '6px 10px', borderRadius: 6, font: '12px monospace',
        background: 'rgba(0,0,0,0.75)', color: '#fff', pointerEvents: 'none'
      }}
    >
      <div>scrollY: {Math.round(scrollY)}</div>
      <div>last jump: {lastJump}</div>
    </div>
  );
};

const Filler: React.FC<{ label: string; height: number }> = ({ label, height }) => (
  <section
    style={{
      height, padding: 24, boxSizing: 'border-box',
      background: 'repeating-linear-gradient(0deg, #f4f6f8, #f4f6f8 40px, #e9edf1 40px, #e9edf1 80px)',
      font: '14px sans-serif', color: '#445'
    }}
  >
    {label}
  </section>
);

const Template: React.FC = (props) => {
  const { studioHeight, spaceAbove, spaceBelow, ...rest } = props as any;
  usePageScrollHost();
  return (
    <div>
      <ScrollMonitor />
      <Filler label="Page content above the Studio. Scroll down." height={spaceAbove} />
      <div style={{ display: 'flex', height: studioHeight, margin: '0 24px', border: 'solid 1px #99a' }}>
        <Studio
          {...rest}
          title="Studio in a scrollable page"
          sx={{ flex: 1 }}
        />
      </div>
      <Filler label="Page content below the Studio." height={spaceBelow} />
    </div>
  );
};

export const StudioInScrollablePage = asStory(Template);
StudioInScrollablePage.args = {
  studioHeight: 600,
  spaceAbove: 1200,
  spaceBelow: 1200
};
StudioInScrollablePage.storyName = 'In Scrollable Page';

const Story = {
  title: 'Studio/In Scrollable Page',
  component: StudioInScrollablePage,
};
export default Story;
