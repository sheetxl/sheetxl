import type React from 'react';
import { useState, useEffect, memo, forwardRef, useCallback } from 'react';

import { Box } from '@mui/material';
import { Typography } from '@mui/material';

import { type IFunction } from '@sheetxl/sdk';

import {
  useCommands, KeyCodes, useTranslator
} from '@sheetxl/utils-react';

import { type CommandContext } from '@sheetxl/react';

import {
  ExhibitMenuItem, CommandPopupButton, defaultRenderPopupPanel,
  type ExhibitPopupPanelProps, type CommandPopupButtonProps
} from '@sheetxl/utils-mui';

export interface InsertFunctionCommandButtonProps extends CommandPopupButtonProps {

  category: string;

  icon?: React.ReactNode | ((command: any) => React.ReactNode);

  label?: React.ReactNode | ((command: any) => React.ReactNode);

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
    disabled: propDisabled,
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

      propsTooltip={{ // causes flicker at the moment
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
    disabled: propDisabled,
    groupKey,
    ...rest
  } = props;

  const commandsResolved = useCommands(['insertFunction']);
  const command = commandsResolved[0]
  const t = useTranslator();

  const renderPopupPanel = useCallback((props: ExhibitPopupPanelProps) => {
    const categoryDesc = mapCategories.get(category);
    if (!categoryDesc) {
      console.warn('invalidate category', category);
      return null;
    }

    const propCommands = {
      ...props
    }
    const panel = (<InsertFormulaPopupPanel category={categoryDesc.label} {...propCommands} />);
    return defaultRenderPopupPanel({...props, children: panel});
  }, [category, command, groupKey]);

  const categoryDesc = mapCategories.get(category);
  return (
    <CommandPopupButton
      ref={refForwarded}
      // quickCommand={activeCommandKey}
      disabled={propDisabled}
      renderPopupPanel={renderPopupPanel}
      // `label` is the function CATEGORY name (a `CategoryDesc`, not command chrome) — it localizes
      // with the Plane-3 function work, not here.
      label={categoryDesc?.label}
      tooltip={t('insertFunction.tooltip')}
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
    category,
    ...rest
  } = props;

  const resolvedCommands = useCommands(['insertFunction']);
  const command = resolvedCommands[0];
  const [functions, setFunctions] = useState<IFunction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const checkScripts = async () => {
      const context: CommandContext.FormulaFunction = command?.getContext() as any;
      // No resolved command / context (e.g. the command isn't contributed for this host) ⇒ empty list,
      // never a hard crash on `context.searchByCategory`.
      if (!context?.searchByCategory) {
        setFunctions([]);
        return;
      }
      setIsLoading(true);
      const functionsResolved = await context.searchByCategory(category);
      // Guard against a stale fetch (command/category changed mid-flight) clobbering a newer result.
      if (cancelled) return;
      setFunctions(functionsResolved);
      setIsLoading(false);
    }
    checkScripts();
    return () => { cancelled = true; };
  }, [command, category]);

  const functionsLength = functions.length;
  const functionsElements = new Array(functionsLength);

  const handleInsert = (newValue: IFunction) => {
    // TODO - - these should really be command buttons since they handle ripple and avoid duplicate code
    command?.execute(newValue);
  }
  for (let i=0; i<functionsLength; i++) {
    const formulaFunction = functions[i];
    functionsElements[i] = (
      <InsertFunctionCommandButton
        key={`formula-${formulaFunction.getName()}-${i}`}
        command={command}
        formulaFunction={formulaFunction}
        handleInsert={handleInsert}
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

  return defaultRenderPopupPanel({...rest, children});

}));