import React, {
  memo, forwardRef
} from 'react';

import clsx from 'clsx';

import { useImperativeElement } from '@sheetxl/utils-react';

import { IAutoFilter } from '@sheetxl/sdk';

export interface FiltersAttributes {
  isFilters: () => true;
}

export interface IFiltersElement extends HTMLDivElement, FiltersAttributes {};

export interface FiltersProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The filter to display.
   */
  filter: IAutoFilter.IColumn;
  /**
   * Disables the filter UI.
   */
  disabled?: boolean;
  /**
   * Ref for the Element.
   */
  ref?: React.Ref<IFiltersElement>;
}

/*
 * Placeholder for filters.
 */
export const Filters = memo(forwardRef<IFiltersElement, FiltersProps>(
  (props: FiltersProps, refForwarded) => {
  const {
    children: _propsChildren,
    className: propClassName,
    disabled: _propDisabled,
    style: propsStyle,
    filter,
    ...rest
  } = props;

  // invariant(!(children), "children is not supported");

  const refLocal = useImperativeElement<IFiltersElement, FiltersAttributes>(refForwarded, () => {
    return {
      isFilters: () => true
    }
  }, []);

  return (
    <div
      ref={refLocal}
      className={clsx("filters", propClassName)}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        ...propsStyle
      }}
      {...rest}
    >
      <div
        style={{
          flex: '1 1 100%',
          display: 'flex',
          minHeight: '100px',
          minWidth: '220px',
          alignItems: 'center',
          // justContent: 'center',
          border: 'grey solid 1px',
          padding: '4px 4px',
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          marginTop: '4px',
          marginBottom: '4px',
          marginLeft: '16px',
          // marginLeft: `${16 + 24 + 4 + 6}px`,
          marginRight: '16px'
        }}
      >
        <div>
          {filter.getName()}
        </div>
        <div>
          Filter Widget
        </div>
      </div>
    </div>
  );
}));

Filters.displayName = "Filters";