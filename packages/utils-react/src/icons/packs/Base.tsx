import { type IconPackInput, type ReactIconProps } from '../Types';
import { WalkingIcon, type WalkingIconProps } from '../WalkingIcon';

import data from './Base.json';

/**
 * The glyphs that are code rather than data: a component, or SVG markup with attributes a path entry
 * does not carry. Everything else is in `Base.json`, whose path data the build optimizes.
 */
const codeIcons: IconPackInput['icons'] = {
  "copy.walking": { react: (p: ReactIconProps) => WalkingIcon({ ...p, iconKey: "copy" } as WalkingIconProps) },
  "fill.colored": {
    svg: (props: React.HTMLAttributes<SVGElement>) => {
      return (
        <svg
          {...props as any}
          // viewBox="0 0 24 24" // the default
        >
          <path className="activeColor" d="M10 5.21L5.21 10h9.58z" fillOpacity="1" filter="drop-shadow(0px 0px 1px var(--icon-shadow))"/>
          <path className="fill" d="M19 17c1.1 0 2-.9 2-2 0-1.33-2-3.5-2-3.5s-2 2.17-2 3.5c0 1.1.9 2 2 2zm-10.06-.44c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5zM10 5.21L14.79 10H5.21L10 5.21z" fillOpacity="1"/>
          <path className="activeColor" filter="drop-shadow(0px 0px 1px var(--icon-shadow))" d="M0 20h24v4H0z" stroke="currentColor" strokeOpacity="0.5"/>
        </svg>
      );
    }
  },
  "text.colored": {
    svg: (props: React.HTMLAttributes<SVGElement>) => {
      return (
        <svg
          {...props as any}
          // viewBox="0 0 24 24" // the default
        >
          <path className="fill" d="M 5.615,17.375 H 8.0566072 L 9.3379465,13.763035 H 15.038393 L 16.309643,17.375 H 18.75125 L 13.444285,3.25 h -2.52232 z m 4.459465,-5.66009 2.048125,-5.8416954 h 0.12107 l 2.048125,5.8416954 z" fillOpacity="1"/>
          <path className="activeColor" d="M0 20h24v4H0z" fillOpacity="1" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5"/>
        </svg>
      );
    }
  },
  "stroke.colored": {
    svg: (props: React.HTMLAttributes<SVGElement>) => {
      return (
        <svg
          {...props as any}
          // viewBox="0 0 24 24" // the default
        >
          <path className="fill" d="m 17.28,7.18 -3.75,-3.75 -10,10 v 3.75 h 3.75 z m 2.96,-2.96 c 0.39,-0.39 0.39,-1.02 0,-1.41 l -2.34,-2.34 c -0.39,-0.39 -1.02,-0.39 -1.41,0 l -1.96,1.96 3.75,3.75 z" fillOpacity="1"/>
          <path className="activeColor" d="M0 20h24v4H0z" fillOpacity="1" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.5"/>
        </svg>
      );
    }
  },
  "circle.colored": {
    svg: (props: React.HTMLAttributes<SVGElement>) => {
      return (
        <svg
          {...props as any}
        >
          <path className="activeColor" opacity="1" d="M12 20c4.41 0 8-3.59 8-8s-3.59-8-8-8-8 3.59-8 8 3.59 8 8 8z"/>
          <path className="fill grey" opacity=".3" d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"/>
          <path className="activeColor" opacity=".3" d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10zm0-18c4.41 0 8 3.59 8 8s-3.59 8-8 8-8-3.59-8-8 3.59-8 8-8z"/>
        </svg>
      );
    }
  }
};

const pack: IconPackInput = {
  ...(data as IconPackInput),
  icons: { ...(data as IconPackInput).icons, ...codeIcons }
};

export default pack;
