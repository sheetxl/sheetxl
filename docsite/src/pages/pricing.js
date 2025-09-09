import React from 'react';

import Layout from '@theme/Layout';

import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';

import HomepageHeaderSmall from '@site/src/components/HomepageHeaderSmall';
import PricingSection from '@site/src/components/PricingSection';

export function PricingPage() {

  return (
    <MUIThemeWrapper>
      <PricingSection
        showTitle={true}
        className='section--odd'
      />
    </MUIThemeWrapper>
  );
}

export default function Page() {
  // const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Pricing`}
      description="SheetXL Pricing"
      // bullets={`${siteConfig.tagline}`}
    >
      <HomepageHeaderSmall />
      <PricingPage />
    </Layout>
  );
}