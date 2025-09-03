/**
 * UDF for Script
 */
(() => {
  const scriptTag = document.currentScript as HTMLScriptElement;
  const init = (): void => {
    if (!scriptTag) {
      console.error('script tag is not available. Ensure the module tag is not used.');
      return;
    }
    const targetSelector = scriptTag.dataset.target ?? '#sheetxl';

    const props = {
      ...scriptTag.dataset,
    };
    const licenseKey = props.licenseKey;
    delete props.target; // Remove target from props as it's not needed in the module
    delete props.licenseKey; // Remove licenseKey from props as it's handled separately

    const loaderUrl = scriptTag.src;
    const moduleUrl = new URL('./index.js', loaderUrl).href;
    import(/* @vite-ignore */moduleUrl).then(module => {
      const targetElement = document.querySelector(targetSelector);
      if (!targetElement) {
        console.error(`SheetXL: Target element "${targetSelector}" not found.`);
        return;
      }
      (module as any).SheetXL.attachStudio({
        selector: targetElement,
        licenseKey
      }, props);
    }).catch((err : any) => {
      console.error(`SheetXL: Failed to load the main application from ${moduleUrl}`, err);
    });
  }
    // This is the defensive check
  if (document.readyState === 'loading') {
    // The DOM is not ready yet, so wait for the event.
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // The DOM is already ready, so we can run the init function immediately.
    init();
  }
})();