import { TaskPaneProps } from '@sheetxl/react';

// Define your task pane component
export const AITaskPane = (props: TaskPaneProps, ref: React.Ref<HTMLDivElement>) => {
  const {
    model,
    commands,
    entryKey,
    frame,
    ...rest
  } = props;
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%', // or a fixed height if needed
        width: '100%',  // or a fixed width if needed
      }}
    >
      AI Chat Bot will go here
    </div>
  );
};