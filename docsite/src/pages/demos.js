import React from 'react';

import Layout from '@theme/Layout';
import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';
import HomepageHeader from '@site/src/components/HomepageHeader';

import DemoSection from '@site/src/components/DemoSection';

import { Typography } from '@mui/material';
import { Container } from '@mui/material';
import { Button } from '@mui/material';
import { Stack } from '@mui/material';
import { Box } from '@mui/material';

import { Email as EmailIcon } from '@mui/icons-material';

export function DemoPage() {
  return (
    <MUIThemeWrapper>
      <Container disableGutters maxWidth="sm" component="main" sx={{ pt: 2, mb: 2, mt: 2 }}>
      <Typography
        component="h1"
        variant="h4"
        align="center"
        color="text.primary"
        gutterBottom
      >
        Featured Demos
      </Typography>
      <Typography variant="h6" align="center" color="text.secondary" component="p">
        Select a demo below to see a feature in action.
      </Typography>
    </Container>
    <DemoSection/>
    <Typography variant="h6" align="center" color="text.secondary" component="p">
        Want to see something else or have an idea for another demo. Please let me know!
    </Typography>
    <Box
      sx={{
        // bgcolor: 'background.paper',
        pb: 6,
      }}
    >
      <Container maxWidth="sm">
        <Stack
          sx={{ pt: 2 }}
          direction="row"
          spacing={2}
          justifyContent="center"
        >
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            href={`mailto:support@sheetxl.com`}
            target="_blank"
          >
            Suggest Demo
          </Button>
        </Stack>
      </Container>
    </Box>
    </MUIThemeWrapper>
  );
}

export default function Page() {
  return (
    <Layout
      title={`Featured Demos`}
      description={`Demos that demonstrate the features and power of SheetXL`}>
      <HomepageHeader />
      <DemoPage/>
    </Layout>
  );
}