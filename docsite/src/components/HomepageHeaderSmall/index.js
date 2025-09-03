import React from 'react';
import clsx from 'clsx';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
// import {useColorMode} from '@docusaurus/theme-common';

import Heading from '@theme/Heading';
import styles from './styles.module.css';

import { Container } from '@mui/material';

export default function HomepageHeaderSmall() {
  const {siteConfig} = useDocusaurusContext();

  return (
    <header className={clsx('hero hero--primary', styles.heroBannerSmall)}>
      <div className={clsx('container', styles.container)}>
        <Container maxWidth="md" disableGutters >
          <Heading as="div" className={clsx("hero__title_small", styles.heroTitle)}>
            <img src="https://www.sheetxl.com/logo-text.svg" height="50" alt={`${siteConfig.title}`}/>
          </Heading>
        </Container>
      </div>
    </header>
  );
}
