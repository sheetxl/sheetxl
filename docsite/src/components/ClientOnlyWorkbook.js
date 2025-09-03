import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

// SSR-safe wrapper for Studio
// Only renders the workbook on the client side to avoid SSR issues
export default function ClientOnlyWorkbook({ children, fallback, ...props }) {
  return (
    <BrowserOnly fallback={fallback || <div>Loading...</div>}>
      {() => {
        const [Component, setComponent] = React.useState(null);

        React.useEffect(() => {
          import('@sheetxl/studio-mui').then(({ Studio }) => {
            setComponent(() => Studio);
          });
        }, []);

        if (!Component) {
          return <div>Loading workbook...</div>;
        }

        return <Component {...props}>{children}</Component>;
      }}
    </BrowserOnly>
  );
}
