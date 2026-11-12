import React from 'react';

import { Typography } from '@mui/material';
import { Container } from '@mui/material';
import { Box } from '@mui/material';
import { Button } from '@mui/material';
import { Divider } from '@mui/material';
import { Tooltip } from '@mui/material';
import { Card } from '@mui/material';
import { CardActions } from '@mui/material';
import { CardContent } from '@mui/material';
import { CardHeader } from '@mui/material';
import { Grid } from '@mui/material';
// import { StarBorder as StarIcon } from '@mui/icons-material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { RadioButtonUnchecked as RadioButtonUncheckedIcon } from '@mui/icons-material';
import { Pending as PendingIcon } from '@mui/icons-material';

// import Heading from '@theme/Heading';
import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';

const completed = [
  {
    title: 'Developer Features',
    // description: 'A description here',
    // descriptionTooltip: 'Tooltip for the description here.',
    bullets: [
      `Typescript`,
      `Headless spreadsheet library can be used in either browser or Node`,
      `Simple integration`,
      `Free open-sourced Material-UI Application. MIT Licensed`,
      `Customizable Rendering and Editing`,
      `Themeable using CSS, or CSS-in-JS`,
    ],
    // buttonText: 'Do something',
    // buttonVariant: 'contained',
  },
  {
    title: 'User Features',
    // description: 'A description here',
    // descriptionTooltip: 'Tooltip for the description here',
    bullets: [
      `17.1+ billion cells (The same as Excel)`,
      `545+ builtin functions — 120,000+ test fixtures`,
      `475+ shortcut keys`,
      `Full fidelity Excel import/export (Data, Formulas, Styles, Tables, etc)`,
      `Live Scripting (Office Scripts like with UDF support)`,
      `Fast. Autofill 1,048,576 rows with formulas in 0.7s (10M+ formulas/second)`,
      `Custom formula and macro functions`,
      `Multiple Sheets`,
      `Tables (Filtering, Formatting, etc)`,
      `Charts`,
      `Sparklines`,
      `Pivots Tables`,
      `Conditional Formatting`,
      `Data Validation`,
      `Slicers`,
      `Advanced Copy/Paste (Formats, Formulas, Internal Clipboard)`,
      `Row/Column Interaction - Resizable, Auto-fit, Hidden, Frozen, Reorder`,
      `Grouping Rows/Headers`,
      `Full Mobile Support (Multi touch handle/Small screen accommodation)`,
      `Undo/Redo`,
      `Theming Support (Color Picker, Theme Selector)`,
      `Cell Styles (Excel Parity + custom via CSS or Javascript)`,
      `Preset Cell Style Selector`,
      `Multi-language, Internationalization`,
      `Number Formatting`,
      `Text Overflow, Wordwrap, Rotation`,
      `Autofill`,
      `Find/Replace`,
      `Images`,
      `Merged Cells`,
      `Drawings`,
      `Shapes`,
      `Borders`,
      `Multi-range selection`,
      `Protected/Encrypted Workbooks, Sheets and Ranges`,
      `Sort`,
      `Filter`,
      `Zoom`,
      `Hyperlinks`,
      `Custom Renderers/Editors`
    ]
  }
];

const roadmap = [
  {
    title: 'Roadmap Features',
    singleLine: true,
    description: `Excel feature parity is expected to be completed mid 2027.`,
    bullets: [
      [`Rich Text`, `In Progress`],
      // [`Timeline`, `2026`],
      [`Printing`, `In Progress`],
      [`Ribbon/Sequence Alt-Key Shortcuts (Key-coords)`, `2026`],
      [`Accessibility https://www.w3.org/TR/WCAG21/`, `2026`],
      [`Multithreaded Calc`, `2027`],
      [`Streaming Functions`, `2027`],
      [`Multi-user Collaboration`, `2027`],
      [`VBA & Macro Execution`, `2027`],
    ],
    // buttonText: 'Request',
    // buttonVariant: 'outlined',
  },
];

export default function FeatureSection(props) {
  const {
    showFeatures = true,
    showRoadmap = false,
    ...rest
  } = props;
  const cards = [
    ...(showFeatures ? completed : []),
    ...(showRoadmap ? roadmap : [])
  ];

  // responsive sizes - https://mui.com/material-ui/react-grid2/#typescript
  return (
    <MUIThemeWrapper>
      <Box
        {...rest}
      >
        <Container maxWidth="lg" component="section" sx={{ flexGrow: 1, mt: 4, mb: 4, px: { xs: 0, sm: 3 } }}>
          <Grid container spacing={5} columns={12}>
            {cards.map((card) => (
              <Grid
                key={card.title}
                size={{ xs: 12, sm: card.singleLine ? 12 : 6 }}
              >
                <Card
                  sx={{flex: '1 1 0%', display: 'flex', flexDirection: 'column', borderRadius: 'var(--ifm-card-border-radius)', border: '1px solid var(--sxl-line)'}}
                  elevation={0}
                >
                  {/* this isn't working. I wanted docusaurus to create a navigation on the right and allow links with hash to scroll to location */}
                  {/* <Heading style={{display:'none'}} as="h3" id={card.title.toLowerCase().replace(' ', '-')}>
                    <a href={`#${card.title.toLowerCase().replace(' ', '-')}`}>{card.title}</a>
                  </Heading> */}
                  <CardHeader
                    title={card.title}
                    slotProps={{ title: { align: 'center' } }}
                    description={card.description}
                    // titleTypographyProps={{ align: 'center' }}
                    // action={card.title === 'Pro' ? <StarIcon /> : null}
                    sx={{
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'light'
                          ? '#f5f8ff'
                          : '#1b2459',
                    }}
                  />

                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        flex: '1 1 100%',
                        alignItems: 'baseline',
                        mb: 2,
                      }}
                    >
                      {card.price}
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        flex: '1 1 100%',
                        alignItems: 'baseline',
                      }}
                    >
                      <Tooltip title={card.descriptionTooltip ? (<h6 style={{  }}>{card.descriptionTooltip}</h6>) : ''}>
                      <Typography variant="subtitle1" color="text.primary"
                        sx={{
                          position: 'relative'
                        }
                      }>
                        {card.descriptionTooltip ? <Box
                          sx={{
                            position: 'absolute',
                            top: '0px',
                            width: '100%',
                            height: 'calc(100% - 2px)',
                            borderBottom: '1px dashed grey'
                          }}
                        /> : null}
                        <span>
                          {card.description}
                        </span>
                      </Typography>
                      </Tooltip>
                    </Box>
                    { (card.bullets?.length > 0 && (card.details || card.description)) ? <Divider sx={{ mt: 2, mb: 2, width: '60%', marginLeft: 'auto', marginRight: 'auto' }} /> : null }
                    { card.details ? <Typography variant="subtitle1" color="text.secondary" sx={{ }}>{card.details}</Typography> : null }
                    <ul>
                      {card.bullets.map((line, index) => {
                        if (Array.isArray(line)) {
                          return (
                            <Box key={'line-' + index} sx={{display: 'flex', flexDirection: 'row', columnGap: 0.5, mb: 0.25}}>
                              {line.map((segment, index) => {
                                let icon = null;
                                if (index === 0) {
                                  if (line[1].toLowerCase().includes('progress'))
                                    icon = <PendingIcon color="primary" sx={{transform: 'scale(0.8)', mr: 1, flexShrink: 0}}/>
                                  else
                                    icon = <RadioButtonUncheckedIcon color="primary" sx={{transform: 'scale(0.8)', mr: 1, flexShrink: 0}}/>
                                }
                                return (
                                  <Box
                                    key={'line-' + index}
                                    sx={{
                                      display: 'flex',
                                      minWidth: 0,
                                      // Even columns when there is room; on small screens the date only takes what it needs.
                                      flex: {
                                        xs: index === 0 ? '1 1 0%' : '0 0 auto',
                                        sm: '1 1 50%'
                                      },
                                      ...(index === 0 ? null : {
                                        maxWidth: { xs: '5.5em', sm: 'none' },
                                        justifyContent: { xs: 'flex-end', sm: 'flex-start' },
                                      })
                                    }}
                                  >
                                    {icon}
                                    <Typography
                                      key={'segment-' + index}
                                      component="span"
                                      variant="subtitle1"
                                      color="text.secondary"
                                      sx={{
                                        paddingLeft: '4px',
                                        paddingRight: '0px',
                                        minWidth: 0,
                                        overflowWrap: 'anywhere',
                                        textAlign: index === 0 ? 'left' : { xs: 'right', sm: 'left' },
                                      }}
                                    >
                                      {segment}
                                    </Typography>
                                  </Box>
                                )
                              })}
                            </Box>
                          );
                        } else {
                          return (
                            <Box key={'line-' + index} sx={{display: 'flex', flexDirection: 'row', gap: 1, mb: 0.5}}>
                              <CheckCircleIcon color="primary" sx={{transform: 'scale(0.8)'}}/>
                              <Typography
                                component="span"
                                variant="subtitle1"
                                align="left"
                                color="text.secondary"
                              >
                                {line}
                              </Typography>
                            </Box>
                          )
                        }
                      })}
                    </ul>
                  </CardContent>
                  <div
                    style={{
                      flex: '1 1 100%',  // padding
                    }}
                  />
                  <CardActions
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      mb: 1
                    }}
                  >
                    <Button
                      variant={card.buttonVariant}
                      href={`mailto:sales@sheetxl.com`}
                      target="_blank"
                    >
                      {card.buttonText}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    </MUIThemeWrapper>
  );
}
