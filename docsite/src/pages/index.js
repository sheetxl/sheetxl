import React from 'react';

// import clsx from 'clsx'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
// import Link from '@docusaurus/Link';

import Layout from '@theme/Layout';
import MUIThemeWrapper from '@site/src/components/MUIThemeWrapper';

import HomepageHeader from '@site/src/components/HomepageHeader';
import BenefitSection from '@site/src/components/BenefitSection';

// import StudioDemo from '@site/src/components/StudioDemo';

// import FeatureSection from '@site/src/components/FeatureSection';
// import LogosAndBadges from '@site/src/components/LogosAndBadges';

// import DataGridTrapImg from '@site/src/components/DataGridTrapImg';

// import { Typography } from '@mui/material';
import { Container } from '@mui/material';

// import styles from './styles.module.css';

function Home() {
  return (
    <MUIThemeWrapper>
      <section
        className="section--even"
      >
        <Container
          maxWidth="sm"
          // sx={{
          //   paddingTop: '1rem',
          // }}
        >
          {/* <Typography
            component="h1"
            variant="h4"
            align="center"
            color="text.primary"
            gutterBottom
          >
            Benefits
          </Typography>
          <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
            The flexibility of a spreadsheet combined with the extensibility and control of a custom
            application. Seamlessly integrated into your business workflow.
          </Typography> */}
        </Container>
        <BenefitSection/>
      </section>
      {/* <section
        className="section--odd"
        style={{
          // marginTop: '1.5em',
          marginBottom: '2em',
          paddingBottom: '1em',
        }}
      >
        <Container
          maxWidth="xl"
          sx={{
            paddingTop: '2rem',
          }}
        >
          <Typography
            component="h1"
            variant="h4"
            align="center"
            color="text.primary"
            gutterBottom
          >
            Interactive Playground
            <div className={clsx('container', styles.container)}>
            <div className={clsx(styles.buttons, 'center')}>
              <Link
                className="button button--primary"
                to="/docs/demos">
                More Demos
              </Link>
            </div>
          </div>
          </Typography>
          <StudioDemo />
        </Container>
      </section> */}
      <section
        // className="section--odd"
      >
        {/* <LogosAndBadges/> */}
        {/* <Container
          maxWidth="md"
          sx={{
            paddingBottom: '2rem',
          }}
        >
          <Typography
            component="h1"
            variant="h4"
            align="center"
            color="text.primary"
            gutterBottom
          >
            Why I built SheetXL
          </Typography>
          <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
            For years, I kept ending up in the same frustrating role: <strong>full-time data-grid maintainer</strong>.
          </Typography>
          <Typography variant="subtitle1" align="center" color="text.secondary" paragraph>
            I was stuck in the <strong>Data Grid Trap</strong>
          </Typography>
          <div className={clsx(styles.mainWidget, styles.centeredContainer, 'container')}>
            <DataGridTrapImg style={{maxWidth: '50%', align: 'center'}}/>
          </div>
        </Container> */}
      </section>
    </MUIThemeWrapper>
  );
}

export default function Page() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      description={`${siteConfig.tagline}`}>
      <HomepageHeader />
      <Home />
    </Layout>
  );
}