import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';

import { PROMPTS, USE_CASES } from './prompts';
import styles from './styles.module.css';

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Falls through: an insecure origin or a denied permission.
    }
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  return ok;
}

const CopyIcon = () => (
  <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = () => (
  <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PASTE_HINT = 'Now paste it into Claude Code, Codex, Cursor, or any agent with a terminal.';

/** The copy and show/hide state behind one prompt. */
function usePrompt({ id, expanded }) {
  const prompt = PROMPTS[id];
  if (prompt === undefined) throw new Error(`AgentCard: unknown prompt "${id}".`);

  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(expanded);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    if (!(await copyText(prompt))) {
      // Nothing was copied; show the text so it can be selected by hand.
      setOpen(true);
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 4000);
  }, [prompt]);

  const toggle = useCallback(() => setOpen((value) => !value), []);
  return { prompt, copied, open, copy, toggle };
}

const CopyButton = ({ copied, onClick }) => (
  <button type="button" className={`button button--primary ${styles.copy}`} onClick={onClick}>
    {copied ? <CheckIcon /> : <CopyIcon />}
    {copied ? 'Copied' : 'Copy to agent'}
  </button>
);

/**
 * A prompt as an ordinary code block, with the code block's own copy button. For places where
 * the prompt sits beside shell commands, such as a tab next to the package-manager tabs.
 *
 * @param id A key of `PROMPTS`.
 */
export function AgentPromptCode({ id }) {
  const prompt = PROMPTS[id];
  if (prompt === undefined) throw new Error(`AgentPromptCode: unknown prompt "${id}".`);
  return <CodeBlock language="text">{prompt}</CodeBlock>;
}

/**
 * A card around one prompt: a title and a sentence or two beside the copy button, with the
 * prompt in an accordion underneath.
 *
 * @param id A key of `PROMPTS`.
 * @param title The card's heading.
 * @param expanded Start with the prompt showing.
 */
export function AgentCard({ id, title, expanded = false, children }) {
  const { prompt, copied, open, copy, toggle } = usePrompt({ id, expanded });
  return (
    <div className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardBody}>
          <div className={styles.cardTitle}>{title}</div>
          <div className={styles.cardText}>{children}</div>
        </div>
        <CopyButton copied={copied} onClick={copy} />
      </div>
      <div className={styles.hint} role="status">{copied ? PASTE_HINT : ''}</div>
      <button type="button" className={styles.accordion} onClick={toggle} aria-expanded={open}>
        <ChevronIcon open={open} />
        {open ? 'Hide prompt' : 'Show prompt'}
      </button>
      {open && <pre className={styles.cardPrompt}>{prompt}</pre>}
    </div>
  );
}

/** The use-case cards: what people come to build, each with its own prompt. */
export function AgentUseCases() {
  return (
    <div className={styles.cards}>
      {USE_CASES.map(({ id, title, description, href }) => (
        <AgentCard key={id} id={id} title={title}>
          {description} <Link to={href}>By hand</Link>
        </AgentCard>
      ))}
    </div>
  );
}
