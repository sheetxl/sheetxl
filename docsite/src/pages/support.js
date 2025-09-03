import React from 'react';
import Layout from '@theme/Layout';
import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';
import HomepageHeaderSmall from '@site/src/components/HomepageHeaderSmall';

// Import the markdown content directly
import SupportContent from '../../docs/60-resources-community/10-support.mdx';

import { Container } from '@mui/material';

export function SupportPage() {
  return (
    <MUIThemeWrapper>
      <Container maxWidth="md" component="main" sx={{ pt: 2, mt: 3, mb: 2, pl: 3, pr: 3 }}>
        <SupportContent />
      </Container>
    </MUIThemeWrapper>
  );
}

export default function Page() {
  return (
    <Layout
      title="Support"
      description="Get help and support for SheetXL"
    >
      <HomepageHeaderSmall />
      <SupportPage />
    </Layout>
  );
}