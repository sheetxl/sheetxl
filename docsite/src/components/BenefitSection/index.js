import clsx from 'clsx';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import styles from './styles.module.css';

import { Typography, Divider } from '@mui/material';

const BenefitsList = [
  {
    title: 'Unmatched Performance',
    Svg: require('@site/static/img/undraw_fast_loading.svg').default,
    description: (<>
      Autofill <strong>1,048,576</strong> rows <span style={{fontSize: '0.85em', backgroundColor: 'var(--ifm-color-emphasis-200)', padding: '2px 2px', borderRadius: '4px', color: 'var(--ifm-color-emphasis-700)'}}>Excel's row limit</span> with formulas in <strong>0.7s</strong><br/> — even on a 4-year-old phone.
    </>),
    descriptionSubHeader: (<><a href="/docs/guides/performance-benchmarks" target="_blank" rel="noopener noreferrer">See benchmark results</a></>),
    description2: 'Handles 250MB+ workbooks and 17B+ cells.'
  },
  {
    title: 'Instant Integration',
    Svg: require('@site/static/img/undraw_in_no_time.svg').default,
    description: (<>Bring spreadsheet features to your app<br/> — in 1 line of code.</>),
    descriptionSubHeader: (<><a href="/docs/guides/category/getting-started" target="_blank" rel="noopener noreferrer">Get Started in 2 minutes</a></>),
    description2: (
      <div className="tight-code-block" style={{maxWidth: '640px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <CodeBlock language="javascript" style={{ marginBottom: '0px' }} showLineNumbers={true}>
        {`import("https://cdn.jsdelivr.net/npm/@sheetxl/studio-vanilla@latest/cdn/index.js").then(({ SheetXL }) => SheetXL.attachStudio("#sheetxl"));`}
      </CodeBlock>
      </div>
    )
  },
  {
    title: 'Effortless Customization',
    Svg: require('@site/static/img/undraw_proud_coder.svg').default,
    description: (<>Add custom functions with live scripting directly inside your spreadsheet<br/> — no build step required.</>),
    descriptionSubHeader: (<><a href="/docs/guides/concepts/scripting" target="_blank" rel="noopener noreferrer">Explore Scripting</a></>),
    description2: `Vectored and Range-Based API.`
  },
  {
    title: (<>Familiar, Zero-Cost UI</>),
    Svg: require('@site/static/img/undraw_spreadsheet_2.svg').default,
    description: `Excel-grade interface, free forever under the MIT open source license.`,
    descriptionSubHeader: (<><a href="https://www.github.com/sheetxl" target="_blank" rel="noopener noreferrer">View the Source</a></>),
    description2: `Fork it. Embed it. —  Own it.`
  },
  {
    title: 'Secure, Serverless Architecture',
    Svg: require('@site/static/img/undraw_secure-login.svg').default,
    description: (<>Runs securely in any <strong>browser</strong> or <strong>Node</strong> runtime<br/> - zero backend.</>),
    description2: `Reduce infrastructure cost and enhance data security.`
  },
];

function Benefit({
  Svg, title, description, description2, descriptionSubHeader=null, isReversed = false, index = 0
}) {
  const imageContent = (
    <div className={styles.imageContainer}>
      {Svg ? <Svg className={styles.svg} role="img" /> : undefined}
    </div>
  );

  let descSubHeader = descriptionSubHeader;
  if (typeof descSubHeader === 'string') {
    descSubHeader = <Typography
      variant="caption"
      align="center"
      color="text.secondary"
      sx={{
        display: 'block',
        fontStyle: 'italic',
        mt: -0.5,
        mb: 1
      }}
    >
      {descSubHeader}
    </Typography>
  }
  const textContent = (
    <div className="text--center padding-horiz--md"
      // style={{border: 'red solid 2px'}}
    >
      <Heading as="h3">{title}</Heading>
      <div>
        <Typography
          component='div'
          variant="subtitle1"
          align="center"
          sx={{ mb: 0.5 }}
        >
          {description}
        </Typography>
      </div>
      <Typography
        component='div'
        variant="subtitle1"
        align="center"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {description2}
      </Typography>
      {descSubHeader}
    </div>
  );  return (
    <div className={clsx("row margin-bottom--sm", styles.benefitRow, {
      [styles.reversed]: isReversed,
      [styles.odd]: index % 2 === 0,  // 0-indexed, so first item (index 0) is "odd" visually
      [styles.even]: index % 2 === 1  // Second item (index 1) is "even" visually
    })}>
      {/* Text Column - Always first in DOM */}
      <div className="col col--6">
        {textContent}
      </div>

      {/* Image Column - Always second in DOM */}
      <div className="col col--6">
        {imageContent}
      </div>
    </div>
  );
}

export default function BenefitSection({style, list=BenefitsList}) {
  return (
    <section
      className={clsx(styles.section)}
      style={style}
    >      <div className="container">
        {list?.map((props, idx) => (
          <div key={idx}>
            <Benefit {...props} isReversed={idx % 2 === 1} index={idx} />
            {idx < list.length - 1 && (
              <Divider
                sx={{
                  my: 4,
                  maxWidth: '200px',
                  mx: 'auto',
                  opacity: 0.3
                }}
              />
            )}
          </div>
        ))}
      </div>

    </section>
  );
}
