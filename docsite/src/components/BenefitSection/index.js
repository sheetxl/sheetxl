import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import CodeBlock from '@theme/CodeBlock';
import styles from './styles.module.css';

// The CDN snippet resolves a dist-tag at load time, so it follows the channel like the
// install commands in the guides. Built here rather than at module scope because the
// channel only reaches components through the Docusaurus context.
const getBenefitsList = (cdnTag) => [
  {
    title: 'Unmatched Performance',
    image: 'img/benefits/performance.svg',
    note: (<>
      Autofill <strong>1,048,576</strong> rows <span className={styles.tag}>Excel's row limit</span> with formulas in <strong>0.7s</strong> — even on a 4-year-old phone.
    </>),
    description: 'Handles 250MB+ workbooks and 17B+ cells.',
    link: { to: '/guides/benchmarks/performance', label: 'See benchmark results' },
  },
  {
    title: 'Instant Integration',
    image: 'img/benefits/stop-watch.svg',
    note: (<>Bring spreadsheet features to your app — in 1 line of code.</>),
    description: (
      <div className={styles.snippet}>
        <CodeBlock language="javascript">
          {`import("https://cdn.jsdelivr.net/npm/@sheetxl/studio-vanilla${cdnTag}/cdn/index.js").then(({ SheetXL }) => SheetXL.attachStudio("#sheetxl"));`}
        </CodeBlock>
      </div>
    ),
    link: { to: '/guides/category/getting-started', label: 'Get started in 2 minutes' },
  },
  {
    title: 'Effortless Customization',
    image: 'img/benefits/easy.svg',
    note: (<>Add custom functions with live scripting directly inside your spreadsheet — no build step required.</>),
    description: 'Vectored and range-based API.',
    link: { to: '/guides/concepts/scripting', label: 'Explore scripting' },
  },
  {
    title: 'Familiar, Zero-Cost UI',
    image: 'img/benefits/mit-license.svg',
    note: 'Excel-grade interface, free forever under the MIT open source license.',
    description: 'Fork it. Embed it. Own it.',
    link: { href: 'https://www.github.com/sheetxl', label: 'View the source' },
  },
  {
    title: 'Secure, Serverless Architecture',
    image: 'img/benefits/secure.svg',
    note: (<>Runs securely in any <strong>browser</strong> or <strong>Node</strong> runtime — zero backend.</>),
    description: 'Reduce infrastructure cost and enhance data security.',
  },
];

function BenefitCard({ title, image, note, description, link }) {
  return (
    <div className={styles.card}>
      <div className={styles.badge}>
        <img src={useBaseUrl(image)} alt="" aria-hidden="true" />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.note}>{note}</p>
        <div className={styles.description}>{description}</div>
        {link ? (
          <Link className={styles.link} to={link.to} href={link.href}>
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function BenefitSection() {
  const {siteConfig} = useDocusaurusContext();
  const cdnTag = siteConfig.customFields?.channel === 'beta' ? '@beta' : '@latest';
  const benefits = getBenefitsList(cdnTag);

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.intro}>
          <span className={styles.eyebrow}>Benefits</span>
          <h2 className={styles.heading}>What makes SheetXL different</h2>
          <p className={styles.lead}>
            More than a spreadsheet or a grid: a complete engine built for speed, scripting
            and Excel compatibility.
          </p>
        </div>
        <div className={styles.grid}>
          {benefits.map((props, idx) => (
            <BenefitCard key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
