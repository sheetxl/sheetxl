import { memo, useRef } from 'react';

import {
  Paper, Box, Typography, FormControlLabel, Checkbox, Tab, Tabs
} from '@mui/material';
import { type Theme } from '@mui/material';

import { messageKey } from '@sheetxl/utils';

import {
  ICondition, IConditionalFormat, type ICellStyle
} from '@sheetxl/sdk';

import { useTranslator } from '@sheetxl/utils-react';
import {
  useModelSync, defaultColorScale, defaultDataBar, defaultIconSet
} from '@sheetxl/react';

import { AnchoredRangeField } from '../anchorItems';
import { ConditionEditor, SxConditionEditorFrame } from '../conditions';
import { FormulaFrameContext } from '../conditions/useFormulaOption';

import styles from '../itemsPanel/Items.module.css';

import { ConditionalFormatStylePicker } from './ConditionalFormatStylePicker';
import { ColorScaleRulePanel } from './ColorScaleRulePanel';
import { DataBarRulePanel } from './DataBarRulePanel';
import { IconSetRulePanel } from './IconSetRulePanel';
import { RulePreview } from './RulePreview';
import { conditionalFormatTitle } from './ConditionalFormatTitle';

/** The Classic tab plus one tab per {@link IConditionalFormat.ScaleType}. */
type RuleTab = 'classic' | IConditionalFormat.ScaleType;

const TAB_MESSAGE_KEYS: Record<RuleTab, string> = {
  classic: messageKey('conditionalFormat.tab.classic'),
  [IConditionalFormat.ScaleType.ColorScale]: messageKey('conditionalFormat.tab.colorScale'),
  [IConditionalFormat.ScaleType.DataBar]: messageKey('conditionalFormat.tab.dataBars'),
  [IConditionalFormat.ScaleType.IconSet]: messageKey('conditionalFormat.tab.iconSets')
};

/** What each tab last held, so switching away and back does not cost the user their work. */
interface TabMemory {
  condition?: ICondition.JSON | null;
  style?: ICellStyle.Properties | null;
  scales: Partial<Record<IConditionalFormat.ScaleType, IConditionalFormat.Scale>>;
}

export interface ConditionalFormatEditorPanelProps {
  /**
   * The conditional format to edit — the detached draft the items panel minted, edited in place.
   */
  conditionalFormat: IConditionalFormat;
}

/**
 * Editor panel for one conditional-format rule: a live preview chip and the "Apply to" range
 * field, a
 * four-tab strip selecting the rule *kind* (Excel's six new-rule categories land inside the
 * Classic tab as operators), and the per-kind editor.
 *
 * @remarks
 * A rule carries either a `condition` + `style` or a `scale`, never both; switching tabs replaces
 * one shape with the other on the draft, and the draft is temporary, so nothing is committed
 * until Save.
 */
export const ConditionalFormatEditorPanel = memo<ConditionalFormatEditorPanelProps>((props) => {
  const { conditionalFormat } = props;
  const t = useTranslator();

  useModelSync<IConditionalFormat.IListeners>(conditionalFormat, 'onAnyChange');

  const scale = conditionalFormat.getScale();
  const condition = conditionalFormat.getCondition();
  const ruleStyle = conditionalFormat.getStyle();
  const readOnly = conditionalFormat.isProtected();
  const activeTab: RuleTab = scale?.type ?? 'classic';

  const memory = useRef<TabMemory>({ scales: {} });

  const handleTabChange = (nextTab: RuleTab): void => {
    if (nextTab === activeTab) return;
    // Park the outgoing tab's payload…
    if (activeTab === 'classic') {
      memory.current.condition = condition?.toJSON() ?? null;
      memory.current.style = ruleStyle;
    } else if (scale) {
      memory.current.scales[scale.type] = scale;
    }
    // …and swap the rule's shape. Explicit nulls: `update` only touches keys the caller names.
    if (nextTab === 'classic') {
      conditionalFormat.update({
        condition: memory.current.condition ?? {
          operator: ICondition.BuiltInOperatorNames.Between,
          param: null
        },
        style: memory.current.style ?? null,
        scale: null
      });
    } else {
      const nextScale = memory.current.scales[nextTab]
        ?? (nextTab === IConditionalFormat.ScaleType.ColorScale ? defaultColorScale()
          : nextTab === IConditionalFormat.ScaleType.DataBar ? defaultDataBar()
          : defaultIconSet());
      conditionalFormat.update({
        scale: nextScale,
        condition: null,
        style: null
      });
    }
  };

  const handleScaleChange = (nextScale: IConditionalFormat.Scale): void => {
    conditionalFormat.update({ scale: nextScale });
  };

  const panel = (
    <Paper
      tabIndex={0}
      className={styles['editor-panel']}
      sx={{
        gap: (theme: Theme) => theme.spacing(1),
        paddingTop: (theme: Theme) => theme.spacing(1.25),
        paddingBottom: (theme: Theme) => theme.spacing(2),
        paddingLeft: (theme: Theme) => theme.spacing(1.5),
        paddingRight: (theme: Theme) => theme.spacing(1.5),
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: (theme: Theme) => theme.spacing(1.25),
        overflow: 'auto'
      }}
    >
      {/* The same header the card shows — preview beside what the rule IS, its ranges beneath —
          so moving from the list into the editor does not rearrange what the user was reading.
          The chip is larger here; the editor can afford it. */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          // The field's floating label rides above its box, so it needs more clearance from the
          // row over it than a plain input would.
          gap: (theme: Theme) => theme.spacing(1.75),
          margin: (theme: Theme) => theme.spacing(1.25),
          marginBottom: 0
        }}
      >
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: (theme: Theme) => theme.spacing(1.5)
        }}>
          <RulePreview conditionalFormat={conditionalFormat} size={48} />
          <Typography variant="body2" sx={{ minWidth: 0, wordBreak: 'break-word' }}>
            {conditionalFormatTitle(conditionalFormat, t)}
          </Typography>
        </Box>
        <AnchoredRangeField item={conditionalFormat} label={t('conditionalFormat.applyTo')} />
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, next) => { if (!readOnly) handleTabChange(next as RuleTab); }}
        variant="fullWidth"
        sx={{
          minHeight: '36px',
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: '36px', textTransform: 'none', pt: 0.5, pb: 0.5, px: 0.5, minWidth: 0 }
        }}
      >
        {(Object.keys(TAB_MESSAGE_KEYS) as RuleTab[]).map((tab) => (
          <Tab key={tab} value={tab} label={t(TAB_MESSAGE_KEYS[tab])} />
        ))}
      </Tabs>

      {/* Every tab reads the same way: what the rule PAINTS first, what it MATCHES under it. */}
      {activeTab === 'classic' && (<>
        <ConditionalFormatStylePicker
          format={ruleStyle}
          readOnly={readOnly}
          onFormatChange={(nextStyle) => conditionalFormat.update({ style: nextStyle })}
        />
        <ConditionEditor
          sx={{ ...SxConditionEditorFrame, p: 2, pb: 1 }}
          selectorTitle={t('conditionalFormat.highlight')}
          condition={condition}
          ranges={conditionalFormat.getRanges()}
          readOnly={readOnly}
          onConditionChange={(newCondition) => conditionalFormat.setCondition(newCondition)}
        />
      </>)}
      {scale?.type === IConditionalFormat.ScaleType.ColorScale && (
        <ColorScaleRulePanel scale={scale} onScaleChange={handleScaleChange} readOnly={readOnly} />
      )}
      {scale?.type === IConditionalFormat.ScaleType.DataBar && (
        <DataBarRulePanel scale={scale} onScaleChange={handleScaleChange} readOnly={readOnly} />
      )}
      {scale?.type === IConditionalFormat.ScaleType.IconSet && (
        <IconSetRulePanel scale={scale} onScaleChange={handleScaleChange} readOnly={readOnly} />
      )}

      {/* Stop-if-true is a predicate-rule concept. The attribute is schema-legal on any `cfRule`,
          but a scale always applies and so ends nothing — Excel greys the checkbox out for all
          three scale kinds, and evaluation qualifies the flag the same way. */}
      {activeTab === 'classic' && (
        <Box sx={{
          pl: 2,
          pr: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={conditionalFormat.isStopIfTrue()}
                disabled={readOnly}
                onChange={(e) => conditionalFormat.setStopIfTrue(e.target.checked)}
              />
            }
            label={t('conditionalFormat.stopIfTrue')}
          />
        </Box>
      )}
    </Paper>
  );

  // Formulas in this editor are typed and read at the active cell, stored at the rule's anchor.
  return (
    <FormulaFrameContext.Provider value={conditionalFormat}>
      {panel}
    </FormulaFrameContext.Provider>
  );
});

ConditionalFormatEditorPanel.displayName = 'ConditionalFormatEditorPanel';
