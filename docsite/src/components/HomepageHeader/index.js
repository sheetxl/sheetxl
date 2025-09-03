import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
// import {useColorMode} from '@docusaurus/theme-common';

// import Heading from '@theme/Heading';
import styles from './styles.module.css';

import { Container } from '@mui/material';

export default function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className={clsx('container', styles.container)}>
        <Container maxWidth="md" disableGutters >
          {/* <Heading as="h1" className={clsx("hero__title", styles.heroTitle)}>
            <img src="https://www.sheetxl.com/logo-text.svg" height="70" alt={`${siteConfig.title}`}/>
          </Heading> */}
          <p className={clsx('hero__subtitle', styles.heroSubTitle)}>{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              className="button button--secondary"
              to="/docs/guides/category/getting-started">
              Get Started
            </Link>
            <Link
              className="button"
              to="https://demo.sheetxl.com">
              Visit Studio Demo
            </Link>
          </div>
        </Container>
      </div>
    </header>
  );
}
