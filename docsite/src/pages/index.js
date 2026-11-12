import React from 'react';

import { Redirect } from '@docusaurus/router';
import useBaseUrl from '@docusaurus/useBaseUrl';

// The marketing landing lives on www; the docsite root goes straight to the guides.
export default function Page() {
  return <Redirect to={useBaseUrl('/guides/')} />;
}
