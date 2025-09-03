// import React from 'react';

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
//import Grid from '@mui/material';
import { Grid2 } from '@mui/material'; // Grid version 2
// import { StarBorder as StarIcon } from '@mui/icons-material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';

import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';

const tiers = [
  {
    title: 'Community',
    price: (<>
      <Typography variant="h5" color="primary.main">
        $0
      </Typography>
      <Typography variant="h5" color="text.primary">
        /dev/year
      </Typography>
    </>),
    description: 'For non-commercial use',
    descriptionTooltip: 'Non-commercial use is any activity where a for profit legal entity is not benefiting.',
    bullets: [
      'All Features',
      'All Product Updates',
      'Community Support',
      'Single Application',
      'Annual Renewal'
    ],
    link: 'https://my.sheetxl.com/subscribe/community',
    buttonText: 'Register for Free',
    buttonVariant: 'outlined',
  },
  {
    title: 'Commercial',
    price: (<>
      {/* <Typography
        variant="h5"
        color="error.light"
        sx={{
          textDecoration: 'line-through',
          mr: 1
        }}
      >
        $745
      </Typography> */}
      <Typography variant="h5" color="primary.main">
        $745
      </Typography>
      <Typography variant="h5" color="text.primary">
        /dev/year
      </Typography>
    </>),
    description: 'For commercial use',
    descriptionTooltip: 'Commercial use is defined as any activity that benefits a for profit legal entity. This includes running business or professional operations, licensing, leasing, bartering or selling and distributing deliverables.',
    bullets: [
      'All Features',
      'Premium Support',
      'Influence Roadmap',
      // 'Remove watermark'
    ],
    link: 'https://my.sheetxl.com/subscribe/commercial',
    buttonText: 'Buy Now',
    buttonVariant: 'contained',
  },
  {
    title: 'Custom',
    price: (<>
      <Typography variant="h5" color="text.primary">
        Let's Discuss
      </Typography>
    </>),
    description: 'Need a custom license?',
    details:  `Contact us for a tailor made solution.`,
    bullets: [
      'Pricing to fit your needs'
    ],
    buttonText: 'Contact Sales',
    buttonVariant: 'outlined',
  },
  {
    title: 'Application Bundle',
    price: (<>
      <Typography variant="h5" color="primary.main">
        $4,495
      </Typography>
      <Typography variant="h5" color="text.primary">
        /app/year
      </Typography>
    </>),
    singleLine: true,
    description: `License SheetXL for one commercial Application. Bundle includes both client and server deployment, plus 10 Developer Licenses.`,
    bullets: [
      'License to deploy SheetXL in one commercial Application (client + server)',
      'Includes 10 Developer Licenses'
    ],
    link: 'https://my.sheetxl.com/subscribe/deploy',
    buttonText: 'Buy Now',
    buttonVariant: 'contained'
  },
  {
    title: 'Start-ups and Small Businesses',
    price: (<>
      <Typography variant="h5" color="primary.main">
        Free
      </Typography>
    </>),
    singleLine: true,
    description: `Companies with less than 10 employees and USD 1M annual revenue. Let's grow 🚀 together.`,
    bullets: [
    ],
    buttonText: 'Request',
    buttonVariant: 'outlined',
  },
];

export default function PricingSection(props) {
  const {
    showTitle=false,
    ...rest
  } = props;
  return (
    <MUIThemeWrapper>
    <Box
      {...rest}
    >
      <Container maxWidth="md" component="section" sx={{ mt: 4, mb: 4 }}>
        {showTitle ? (
          <>
          <Typography
            component="h1"
            variant="h4"
            align="center"
            color="text.primary"

            gutterBottom
          >
            Founder Circle Pricing
            {/* Simple Transparent Pricing */}
          </Typography>

          </>
        ) : null }
        <Typography variant="h6" align="center" color="text.secondary" component="p"
          mb={4}
        >
          Exclusive early-adopter rates for our first 500 licenses.
          <br/>
          Locked in for life.
        </Typography>
        <Grid2 container spacing={5} alignItems="stretch"
        >
          {tiers.map((tier) => (
            // Enterprise card is full width at sm breakpoint
            <Grid2
              // item={true}
              key={tier.title}
              size={{
                xs: 12,
                md: tier.singleLine ? 12 : 4,
                //sm: tier.title === 'Enterprise' ? 12 : 6
              }}
              sx={{
                display: 'flex'
              }}
            >
              <Card
                sx={{flex: '1 1 100%', display: 'flex', flexDirection: 'column', borderRadius: 'var(--ifm-button-border-radius)'}}
                elevation={4}
              >
                <CardHeader
                  title={tier.title}
                  description={tier.description}
                  titleTypographyProps={{ align: 'center' }}
                  // action={tier.title === 'Pro' ? <StarIcon /> : null}
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
                    {tier.price}
                  </Box>
                  <CardActions
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      mb: 1
                    }}
                  >
                    <Button
                      variant={tier.buttonVariant}
                      href={tier.link ?? `mailto:sales@sheetxl.com`}
                      target="_blank"
                    >
                      {tier.buttonText}
                    </Button>
                  </CardActions>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      flex: '1 1 100%',
                      alignItems: 'baseline',
                    }}
                  >
                    <Tooltip title={tier.descriptionTooltip ? (<h6 style={{  }}>{tier.descriptionTooltip}</h6>) : ''}>
                    <Typography variant="subtitle1" color="text.primary"
                      sx={{
                        position: 'relative',
                        paddingLeft: '12px',
                        paddingRight: '12px'
                      }
                    }>
                      <span>
                        {tier.description}
                      </span>
                      {tier.descriptionTooltip ? <Box
                        sx={{
                          top: '0px',
                          width: '100%',
                          height: 'calc(100% - 2px)',
                          borderBottom: '1px dashed grey'
                        }}
                      /> : null}
                    </Typography>
                    </Tooltip>
                  </Box>
                  { (tier.bullets?.length > 0 || tier.details) ? <Divider sx={{ mt: 2, mb: 2, width: '60%', marginLeft: 'auto', marginRight: 'auto' }} /> : null }
                  <ul>
                    {tier.bullets.map((line, index) => {
                      if (Array.isArray(line)) {
                        return (<div>array</div>);
                      } else {
                        return (
                          <Box key={'line-' + index} sx={{display: 'flex', flexDirection: 'row', gap: 1, mb: 0.5}}>
                            <CheckCircleIcon color="primary" sx={{transform: 'scale(0.8)'}}/>
                            <Typography
                              component="span"
                              variant="subtitle1"
                              align="left"
                              color="text.secondary"
                              key={line}
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
              </Card>
            </Grid2>
          ))}
        </Grid2>
      </Container>
    </Box>
    </MUIThemeWrapper>
  );
}
