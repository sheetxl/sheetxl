import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import styles from './styles.module.css';

export default function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  const isBeta = siteConfig.customFields?.channel === 'beta';

  return (
    <header className={styles.hero}>
      <div className={styles.glow} aria-hidden="true" />
      <img
        src={useBaseUrl('img/hero-shape-1.svg')}
        alt=""
        aria-hidden="true"
        className={clsx(styles.shape, styles.shapeLeft)}
      />
      <img
        src={useBaseUrl('img/hero-shape-2.svg')}
        alt=""
        aria-hidden="true"
        className={clsx(styles.shape, styles.shapeRight)}
      />
      <div className={clsx('container', styles.container)}>
        <span className={styles.eyebrow}>Developer Guides</span>
        <h1 className={styles.title}>
          Spreadsheet Power,<br />Excel Compatibility.
        </h1>
        <p className={styles.lead}>
          Everything you need to put a spreadsheet engine in your app, on your server,
          or next to your agent.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/guides/category/getting-started">
            Get Started
          </Link>
          <Link
            className="button button--outline button--lg"
            to={isBeta ? 'https://demo.beta.sheetxl.com' : 'https://demo.sheetxl.com'}>
            Studio Demo
          </Link>
        </div>
      </div>
    </header>
  );
}
