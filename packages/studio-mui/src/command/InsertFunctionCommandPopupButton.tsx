import React, { useState, useEffect, memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { IFunction } from '@sheetxl/sdk';

import {
  ICommand, ICommands, useCommands, ICommandHook, KeyCodes
} from '@sheetxl/utils-react';

import { CommandContext } from '@sheetxl/react';

import {
  CommandPopupButtonProps, defaultCreatePopupPanel, ExhibitPopupPanelProps,
  ExhibitMenuItem, CommandPopupButton
} from '@sheetxl/utils-mui';

export interface InsertFunctionCommandButtonProps extends CommandPopupButtonProps {

  category: string;

  icon?: React.ReactNode | ((command: ICommand) => React.ReactNode);

  label?: React.ReactNode | ((command: ICommand) => React.ReactNode);
  /**
   * Allow for listeners against a specific buttons execute rather than the command.
   *
   * @remarks
   * Useful when knowing the specific button that executed a command is required.
   * (For example when closing menus or restoring focus)
   */
  commandHook?: ICommandHook<any, any>;

}

interface CategoryDesc {
  key: string;
  label: string;
  categories?: string[];
  icon: string | React.ReactElement;
}
const Categories: CategoryDesc[] = [
  {
    key: 'financial',
    label: 'Financial',
    icon: 'FormulaFinancial'
  },
  {
    key: 'logical',
    label: 'Logical',
    icon: 'FormulaLogical'
  },
  {
    key: 'text',
    label: 'Text',
    icon: 'FormulaText'
  },
  {
    key: 'dateTime',
    label: 'Date & Time',
    icon: 'FormulaDateTime'
  },
  {
    key: 'lookupReference',
    label: 'Lookup & Reference',
    icon: 'FormulaLookupReference'
  },
  {
    key: 'mathTrig',
    label: 'Math & Trig',
    icon: 'FormulaMathTrig'
  },
  {
    key: 'statDist',
    label: 'Statistical',
    icon: 'FormulaStatistical'
  },
  {
    key: 'engineering',
    label: 'Engineering',
    icon: 'FormulaEngineering'
  },
  {
    key: 'information',
    label: 'Information',
    icon: 'FormulaInformation'
  },
  {
    key: 'cube',
    label: 'Cube',
    icon: 'FormulaCube'
  },
  {
    key: 'database',
    label: 'Database',
    icon: 'FormulaDatabase'
  },
  {
    key: 'web',
    label: 'Web',
    icon: 'FormulaWeb'
  },
  {
    key: 'custom',
    label: 'Custom',
    icon: 'FormulaCustom'
  },
  // more functions? (another grouping? Why)
];

const mapCategories:Map<string, CategoryDesc> = new Map(Categories.map(category => [category.key, category]));

const InsertFunctionCommandButton = memo((props: any) => { // TODO - type
  const {
    command,
    formulaFunction: propFunction,
    commandHook: propCommandHook,
    disabled: propDisabled = false,
    parentFloat,
    handleInsert,
    icon: propIcon,
    label: propLabel,
    sx: propSx,
    ...rest
  } = props;

  const promiseLabel = new Promise(resolve => {
    const fn:IFunction = propFunction;
    fn.getDescriptor().then((desc: IFunction.IDescriptor) => {
      resolve(desc.getSummary());
    });
  });
  return (
    <ExhibitMenuItem
      sx={{
        maxWidth: '360px', // TODO - make this the width of text for long date plus a bit
        display: 'flex',
        '*': {
          lineHeight: '1.2'
        },
        ...propSx
      }}
      // icon={null}
      disabled={propDisabled}

      tooltipProps={{ // causes flicker at the moment
        label: promiseLabel,
        maxWidth: 1000
      }}
      // icon={selected ? <Selected' : undefined}
      onMouseDown={(e: React.MouseEvent) => { if (e.button !== 0) return; e.preventDefault()}}
      onMouseUp={(e) => { if (e.button !== 0) return; handleInsert(propFunction) }}
      onKeyDown={(e: React.KeyboardEvent) => {
        // button prevents space so we don't check it
        // if (e.isDefaultPrevented()) return;
        if (e.keyCode === KeyCodes.Enter || e.keyCode === KeyCodes.Space) {
          // handleSetFormat(format.numberFormat);
        }
      }}
      {...rest}
    >
      <Box
        sx={{
        // bold and larger
          display: 'flex',
          flex: '1 1 100%',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Typography
          component="div"
        >
          {propFunction.getName()}
        </Typography>
      </Box>
    </ExhibitMenuItem>
  )
});

export const InsertFunctionCommandPopupButton = memo(
  forwardRef<HTMLElement, InsertFunctionCommandButtonProps>((props, refForwarded) => {
  const {
    category,
    commands: propCommands,
    commandHook: propCommandHook,
    scope,
    sx: propSx,
    disabled: propDisabled = false,
    parentFloat,
    ...rest
  } = props;

  const commandsResolved = useCommands(propCommands, ['insertFunction']);
  const command = commandsResolved[0]

  const createPopupPanel = useCallback((props: ExhibitPopupPanelProps, commands: ICommands.IGroup) => {
    const categoryDesc = mapCategories.get(category);
    if (!categoryDesc) {
      console.warn('invalidate category', category);
      return null;
    }

    const propCommands = {
      commandHook: propCommandHook,
      ...props
    }
    const panel = (<InsertFormulaPopupPanel category={categoryDesc.label} {...propCommands} commands={commands} />);
    return defaultCreatePopupPanel({...props, children: panel});
  }, [category, command, propCommandHook, scope]);

  const categoryDesc = mapCategories.get(category);
  return (
    <CommandPopupButton
      ref={refForwarded}
      // quickCommand={activeCommandKey}
      commands={propCommands}
      commandHook={propCommandHook}
      createPopupPanel={createPopupPanel}
      label={categoryDesc.label}
      tooltip={`Insert Function`} // ${categoryDesc.label}
      icon={mapCategories.get(category)?.icon ?? 'FormulaGroup'}
      {...rest}
    />
  )
}));

InsertFunctionCommandPopupButton.displayName = "InsertFunctionCommandPopupButton";


interface InsertFormulaPopupPanelProps extends ExhibitPopupPanelProps, CommandPopupButtonProps {
  category: string;
}
const InsertFormulaPopupPanel = memo(forwardRef<any, InsertFormulaPopupPanelProps>((props: InsertFormulaPopupPanelProps, refForwarded) => {
  const {
    // floatReference,
    commands: propCommands,
    category,
    commandHook: propCommandHook,
    ...rest
  } = props;

  const resolvedCommands = useCommands(propCommands, ['insertFunction']);
  const [functions, setFunctions] = useState<IFunction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const checkScripts = async () => {
      setIsLoading(true);
      const context: CommandContext.FormulaFunction = resolvedCommands[0]?.context() as any;
      const functionsResolved = await context.searchByCategory(category);
      setFunctions(functionsResolved);
      setIsLoading(false);
    }
    checkScripts();
  }, []);

  const functionsLength = functions.length;
  const functionsElements = new Array(functionsLength);
  const command = propCommands.getCommand('insertFunction') as ICommand<any>
  const handleInsert = (newValue: IFunction) => {
    // TODO - - these should really be command buttons since they handle ripple and avoid duplicate code
    propCommandHook?.beforeExecute?.(command, command?.state());
    command.execute(newValue);
    propCommandHook?.onExecute?.(command, command?.state());
  }
  for (let i=0; i<functionsLength; i++) {
    const formulaFunction = functions[i];
    functionsElements[i] = (
      <InsertFunctionCommandButton
        key={`formula-${formulaFunction.getName()}-${i}`}
        command={command}
        formulaFunction={formulaFunction}
        handleInsert={handleInsert}
        // commandHook={propCommandHook}
      />
    );
  }

  const children = (
    <Box
      ref={refForwarded}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 100%',
        overflow: 'hidden'
      }}
    >
      {functionsLength > 0 ? (<>
        <Box
          sx={{
            overflow: 'auto',
            flex: "1 1 100%"
          }}>
          {functionsElements}
        </Box>
      </>): null }
    </Box>
  );

  return defaultCreatePopupPanel({...rest, children});

}));