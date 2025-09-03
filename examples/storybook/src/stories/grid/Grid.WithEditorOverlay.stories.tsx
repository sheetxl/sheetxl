import React, { useCallback, useRef, useState, useMemo } from 'react';

import { CellCoords } from '@sheetxl/utils';

import {
  ScrollableGrid as Grid, IGridElement, useSelection,
  useKeyboardEditorOverlay, DefaultCellEditor, CellEditorProps,
  DefaultCellRenderer, CellRendererProps, getDefaultStringEditState,
  EditState
} from '@sheetxl/grid-react';

const cellIdentity = (rowIndex: number, colIndex: number): string => {
  return `${rowIndex}:${colIndex}`;
}

const Template: React.FC = (props) => {
  const {
    ...rest
  } = props as any;

  const gridRef = useRef<IGridElement>(null);

  // key set values by identity
  const [values, setValues] = useState({});

  // Very important to memoize the cell renderer
  const cellRenderer = useCallback((props: CellRendererProps) => {
    const range = props.range;
    const identity = cellIdentity(range.rowStart, range.colStart);
    let value = values[identity];
    if (value === undefined || value === null) {
      value = '';
    }
    const { key, ...rest } = props;
    return (
      <DefaultCellRenderer
        key={key}
        {...rest}
        value={value}
      />
    )
  }, [values]);

  const {
    selection,
    navigate, // provide to editor to allow tab/enter
    navigateSelection, // provide to editor to allow tab/enter
    // commands: commandsSelection,
    overlay: selectionOverlay,
    ...selectionProps // used for callbacks
  } = useSelection({
    gridRef,
  });

  const [editState, setEditState] = useState<EditState<string, string>>();

  const getCleanEditState = useCallback((coords: CellCoords) => {
    return getDefaultStringEditState(values[cellIdentity(coords.rowIndex, coords.colIndex)]);
  }, [values]);


  // Memo to avoid re-rendering
  const getCellEditor = useCallback((props: CellEditorProps<string, string>, _coords: CellCoords) => {
    console.log('render');
    return <DefaultCellEditor
      {...props}
      onChangeEdit={(editState) => {
        setEditState((prev) => {
          console.log('onChangeEdit: prev, editState', prev, editState);
          return {
            ...prev,
            ...editState
          }
        });
      }}
      editState={editState} //  ?? getCleanEditState(coords)
    />
  }, [editState]);

  const {
    overlay: editorOverlay,
    isEditing,
    startEdit: overlayStartEdit,
    submitEdit: overlaySubmitEdit,
    cancelEdit: overlayCancelEdit,
    onKeyboardEvent: overlayEditorOnKeyEvent,
    onPointerEvent: overlayEditorOnPointerEvent
  } = useKeyboardEditorOverlay({
    view: null, // TODO - use the EditorOverlay not the hook
    // gridRef,
    activeCoords: selection?.cell,
    getCellEditor,
    canEdit: (coords: CellCoords) => { // called when a user has request an edit
      if (coords.rowIndex === 1 && coords.colIndex === 1)
        return false;
      return true;
    },
    onBeforeStartEdit: (coords: CellCoords) => {
      console.warn('onBeforeStartEdit', coords);
      setEditState(getCleanEditState(coords));
    },
    onStartEdit: (coords: CellCoords) => {
      console.warn('startEdit', coords);
      // setEditState(getCleanEditState(coords));
    },
    onSubmitEdit: (coords: CellCoords) => {
      // Just set into a map
      console.warn('onSubmit', coords, editState);
      const identity = cellIdentity(coords.rowIndex, coords.colIndex);
      if (editState.dirty === undefined)
        return;
      setValues((prev) => {
        return {
          ...prev,
          [identity] : editState.dirty
        }
      });
    },
    onDoneEdit: (coords: CellCoords) => {
      console.warn('onDone', coords, editState);
      setEditState(null);
    },
    // onNavigate: navigate,
    // onNavigateSelection: navigateSelection
  });

  // We merge selection and editor overlays
  const overlays = useMemo(() => {
    return [
      selectionOverlay,
      editorOverlay
    ]
  }, [selectionOverlay, editorOverlay]);

  const buttons = useMemo(() => {
    return (
      <div
        style={{
          alignItems: 'start',
          display: 'flex',
          flexDirection: 'row',
          flex: '1 1 0%',
          padding: '0px 6px',
          paddingTop: '4px',
          gap: '4px'
        }}
      >
        <button
          onClick={() => overlayStartEdit() }
          disabled={isEditing}
        >
          Edit
        </button>
        <button
          onClick={() => overlaySubmitEdit() }
          disabled={!isEditing}
        >
          Submit
        </button>
        <button
          onClick={() => overlayCancelEdit() }
          disabled={!isEditing}
        >
          Cancel
        </button>
      </div>
    );
  }, [isEditing, overlayCancelEdit, overlayStartEdit, overlaySubmitEdit]);

  const aboveCellEditor = useMemo(() => {
    return (
      <DefaultCellEditor
        style={{
          border: '1px solid black',
          alignSelf: 'stretch'
        }}
        onFocus={() => {
          // We set the editMode
          const currentEditState = editState ?? getCleanEditState(selection?.cell);
          setEditState({
            ...currentEditState,
            editMode: true
          });
          overlayStartEdit({
            autoFocus: false
          });
        }}
        onChangeEdit={(editState) => {
          setEditState((prev) => {
            return {
              ...prev,
              ...editState
            }
          });
        }}
        onSubmitEdit={() => {
          overlaySubmitEdit();
        }}
        onCancelEdit={() => {
          overlayCancelEdit();
        }}
        // onNavigate={navigate}
        // onNavigateSelection={navigateSelection}
        editState={editState ?? getCleanEditState(selection?.cell)}
      />
    );
  }, [editState, getCleanEditState, overlayCancelEdit, overlayStartEdit, overlaySubmitEdit, selection?.cell]);

  return (
    <div className="storybook-container">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          rowGap: '6px'
        }}
      >
        {buttons}
        {aboveCellEditor}
        <Grid // Actually a scrollable grid.
          {...rest}
          style={{
            flex: '1 1 100%',
            border: '1px solid black',
          }}
          ref={gridRef}
          cellRenderer={cellRenderer}
          onKeyDown={(e: React.KeyboardEvent<any>) => {
            overlayEditorOnKeyEvent(e); // before selection props
            // commandsSelection.onKeyDown(e);
          }}
          onPointerDown={(e: React.PointerEvent<any>) => {
            overlayEditorOnPointerEvent(e);  // before selection props
            selectionProps.onPointerDown(e);
          }}
          onDoubleClick={(e: React.PointerEvent<any>) => {
            overlayEditorOnPointerEvent(e);  // before selection props
          }}
          overlays={overlays}
        />
      </div>
    </div>
  );
};

export const GridWithEditorOverlay = Template.bind({});
GridWithEditorOverlay.args = {
  columnCount: 200,
  rowCount: 200
};

GridWithEditorOverlay.storyName = "with Editor Overlay";

const Story = {
  title: 'Grid',
  component: GridWithEditorOverlay,
  parameters: { controls: { sort: 'requiredFirst' } }
};
export default Story;