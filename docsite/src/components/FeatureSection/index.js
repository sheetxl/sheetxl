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
import { Grid2 as Grid } from '@mui/material'; // Grid version 2
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
      `Free open-sourced Material-UI Application. MIT License`,
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
      `17.1+ billion cells`,
      `400+ built-in functions`,
      `375+ shortcut key (All currently known)`,
      `Custom formula and macro functions`,
      `Import/Export from/to Excel`,
      `Multiple Sheets`,
      `Tables`,
      `Office Theme (Color Picker, Theme Selector)`,
      `Cell Styles (Themes and Formatting)`,
      `Advances Copy/Paste (Formats, Formulas, Internal Clipboard)`,
      `Row/Column Interaction - Resizable, Auto-fit, Hidden, Frozen, Reorder`,
      `Mobile (Touch/Small screen accommodation)`,
      `Autofill`,
      `Undo/Redo`,
      `Find/Replace`,
      `Images`,
      `Merged Cells`,
      `Preset Cell Style Selector`,
      `Number Formatting`,
      `Text Overflow, Wordwrap`,
      `Borders`,
      `Multi-range selection`,
      `Protected Workbooks, Sheets and Ranges`,
      `Sort`,
      `Zoom`,
      `Hyperlinks`
    ]
  }
];

const roadmap = [
  {
    title: 'Roadmap Features',
    singleLine: true,
    description: `Core features are expected to be completed in 2025.`,
    bullets: [
      [`Formula Editor/Dropdown`, `In progress`],
      [`Auto/Table Filters`, `In progress`],
      [`Formatting Export to Excel`, `Q4 2025`],
      [`Data Validation`, `Q4 2025`],
      [`Conditional Formatting`, `Q4 2025`],
      [`Charts`, `Early 2026`],
      [`Sequence Alt-Key Shortcuts (Key-coords)`, `Early 2026`],
      [`Accessibility https://www.w3.org/TR/WCAG21/`, `Early 2026`],
      [`Grouping Rows/Headers`, `Early 2026`],
      // [`Lambda Functions and Multithreaded Calc`, `Demand Driven`],
      [`Encrypted Workbooks`, `Early 2026`],
      [`Internationalization`, `Early 2026`],
      // [`Custom Renderers/Editors`, `Demand Driven`],
      [`Shapes / DrawingML`, `Demand Driven`],
      [`Printing`, `Demand Driven`],
      [`Pivot Tables`, `Demand Driven`],
      [`Slicer/Timeline`, `Demand Driven`],
      [`Sparklines`, `Demand Driven`],
      [`Multi-user Collaboration`, `2026`],
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
        <Container maxWidth="lg" component="section" sx={{ flexGrow: 1, mt: 4, mb: 4 }}>
          <Grid container spacing={5} columns={12}>
            {cards.map((card) => (
              <Grid
                key={card.title}
                size={{ xs: 12, sm: card.singleLine ? 12 : 6 }}
              >
                <Card
                  sx={{flex: '1 1 0%', display: 'flex', flexDirection: 'column', borderRadius: 'var(--ifm-button-border-radius)'}}
                  elevation={4}
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
                          ? theme.palette.grey[200]
                          : theme.palette.grey[700],
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
                            <Grid key={'line-' + index} container spacing={0} rowSpacing={2.5} columns={2}
                              sx={{
                                display: 'flex',
                                // flexDirection: 'row',
                                // justifyContent: 'stretch',
                                // border: 'red solid 1px'
                                 mb: 0.25,
                              }}
                            >
                              {line.map((segment, index) => {
                                let icon = null;
                                if (index === 0) {
                                  if (line[1].toLowerCase().includes('progress'))
                                    icon = <PendingIcon color="primary" sx={{transform: 'scale(0.8)', mr: 1}}/>
                                  else
                                    icon = <RadioButtonUncheckedIcon color="primary" sx={{transform: 'scale(0.8)', mr: 1}}/>
                                }
                                return (
                                  <Grid
                                  // item={true}
                                    key={'line-' + index}
                                    xs={index % 2 === 0 ? 8 : 4}
                                    container
                                    columns={2}
                                    sx={{
                                      display: 'flex',
                                      flex: '1 1 50%'
                                    }}
                                  >
                                    {icon}
                                    <Typography
                                      key={'segment-' + index}
                                      component="span"
                                      variant="subtitle1"
                                      align="left"
                                      color="text.secondary"
                                      sx={{
                                        paddingLeft: '4px',
                                        paddingRight: '0px',
                                      }}
                                    >
                                      {segment}
                                    </Typography>
                                  </Grid>
                                )
                              })}
                            </Grid>
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
