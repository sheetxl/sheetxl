import { SvgIcon, SvgIconProps } from '@mui/material';

export const BorderBottomIcon = (props: SvgIconProps) => {
  return (
    <SvgIcon {...props}>
      <path
        d="M 9,11 H 7 v 2 h 2 z m 4,4 h -2 v 2 h 2 z M 9,3 H 7 v 2 h 2 z m 4,8 h -2 v 2 h 2 z M 5,3 H 3 v 2 h 2 z m 8,4 h -2 v 2 h 2 z m 4,4 h -2 v 2 h 2 z M 13,3 h -2 v 2 h 2 z m 4,0 h -2 v 2 h 2 z m 2,10 h 2 v -2 h -2 z m 0,4 h 2 V 15 H 19 Z M 5,7 H 3 V 9 H 5 Z M 19,3 v 2 h 2 V 3 Z m 0,6 h 2 V 7 H 19 Z M 5,11 H 3 v 2 h 2 z m 0,4 H 3 v 2 h 2 z"
      />
      <path
        className="styled activeColor"
        d="M 3,21 H 21 V 19 H 3 Z"
      />
    </SvgIcon>
  );
}

export default BorderBottomIcon;