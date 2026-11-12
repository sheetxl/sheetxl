import React, { useEffect, useState } from 'react';

// The loader is internal to the sdk (nothing outside the package calls into the binding
// directly), so this story reads it from source and runs under `storybook dev`. A story that
// exercises the binding through the public API (autofit) will replace this one.
import { SdkWasm } from '../../../../../packages/sdk/src/wasm/sdkWasm';

import { asStory } from '../../components';

interface Answers {
  charCount: number;
  loadMs: number;
}

/** Loads `@sheetxl/sdk`'s Rust code (WebAssembly) through its lazy loader and shows an answer. */
const Template: React.FC = () => {
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const start = performance.now();
    SdkWasm.load().then((wasm) => {
      setAnswers({
        charCount: wasm.char_count('😀'),
        loadMs: performance.now() - start
      });
    }, (e: unknown) => setError(String((e as Error)?.cause ?? e)));
  }, []);

  if (error) return <pre data-testid="sdk-wasm-error">{error}</pre>;
  if (!answers) return <div>Loading the sdk's WebAssembly…</div>;
  return (
    <dl data-testid="sdk-wasm-answers">
      <dt>char_count('😀'), scalar values ('😀'.length is {'😀'.length})</dt>
      <dd data-testid="char-count">{answers.charCount}</dd>
      <dt>load and instantiate</dt>
      <dd>{answers.loadMs.toFixed(1)} ms</dd>
    </dl>
  );
};

export const SdkWasmLoads = asStory(Template);
SdkWasmLoads.storyName = 'Sdk wasm';

const Story = {
  title: 'Wasm',
  component: SdkWasmLoads,
};
export default Story;
