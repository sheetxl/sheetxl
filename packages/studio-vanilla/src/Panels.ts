import { type PanelConfig } from './Types';

// A map to keep track of loading panels for cleanup
const panels = new Map<string | HTMLElement, HTMLElement>();

// Default spinner SVG for loading
export const LoadingIcon = `
      <svg width="24" height="24" viewBox="0 0 24 24" style="animation: sheetxl-spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="31.416" stroke-dashoffset="31.416">
          <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
          <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
        </circle>
      </svg>
    `;

// Default error icon SVG
export const ErrorIcon = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
      </svg>
    `;

/**
 * Creates and shows a panel in the target element
 */
export const showPanel = (selector: string | HTMLElement, config: PanelConfig = {}) => {
  const {
    message,
    icon,
    customElement,
    hide = false,
    className,
    cssVars = {}
  } = config;

  if (hide) return;

  const targetElement = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!targetElement) {
    console.warn(`Element with selector "${selector}" not found for panel.`);
    return;
  }

  // Remove existing panel if any
  hidePanel(selector);

  let panelElement: HTMLElement;

  if (customElement) {
    panelElement = customElement;
  } else {
    // Create default panel
    panelElement = document.createElement('div');
    if (className) {
      panelElement.className = `sheetxl-panel ${className}`;
    } else {
      panelElement.className = `sheetxl-panel`;
    }

    // Apply CSS variables with fallbacks
    const cssVarStyles = Object.entries(cssVars)
      .map(([key, value]) => `--sheetxl-panel-${key}: ${value};`)
      .join(' ');

    const styleText = `
        @keyframes sheetxl-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sheetxl-panel {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          border-radius: 4px;
          z-index: 9999;
          gap: 16px;

          /* CSS variables with fallbacks */
          color: var(--sheetxl-panel-color, #333);
        }

        .sheetxl-panel.dark {
          color: var(--sheetxl-panel-color, #e0e0e0);
        }

        .sheetxl-icon {
          width: 24px;
          height: 24px;
          color: var(--sheetxl-panel-icon-color, #1976d2);
        }

        .sheetxl-panel.loading {
          /* Loading panel defaults */
          color: var(--sheetxl-panel-color, #333);
        }

        .sheetxl-panel.loading.dark {
          color: var(--sheetxl-panel-color, #e0e0e0);
        }

        .sheetxl-panel.error {
          /* Error panel defaults */
          color: var(--sheetxl-panel-color, #d32f2f);
        }

        .sheetxl-panel.error.dark {
          color: var(--sheetxl-panel-color, #f44336);
        }

        .sheetxl-panel.error .sheetxl-icon {
          color: var(--sheetxl-panel-icon-color, #d32f2f);
        }

        .sheetxl-panel.error.dark .sheetxl-icon {
          color: var(--sheetxl-panel-icon-color, #f44336);
        }

        .sheetxl-message {
          font-size: 1.1em;
          font-weight: 500;
          letter-spacing: 0.1px;
          text-align: center;
          margin: 0;
        }
      `;

    // Add <style> block
    const style = document.createElement('style');
    style.textContent = styleText;
    panelElement.appendChild(style);

    // Icon
    if (icon) {
      const iconDiv = document.createElement('div');
      iconDiv.className = 'sheetxl-icon';
      if (typeof icon === 'string') {
        // If icon is a trusted SVG string, you can use innerHTML here
        iconDiv.innerHTML = icon;
      } else if (icon instanceof HTMLElement) {
        iconDiv.appendChild(icon);
      }
      panelElement.appendChild(iconDiv);
    }

    // Message
    if (message) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'sheetxl-message';
      messageDiv.textContent = message;
      panelElement.appendChild(messageDiv);
    }
    // Apply custom CSS variables as inline styles
    if (cssVarStyles) {
      panelElement.style.cssText += cssVarStyles;
    }

    // Detect dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      panelElement.classList.add('dark');
    }
  }

  // Ensure target element has relative positioning for absolute positioning of panel
  const targetStyle = window.getComputedStyle(targetElement);
  if (targetStyle.position === 'static') {
    (targetElement as HTMLElement).style.position = 'relative';
  }

  targetElement.appendChild(panelElement);
  panels.set(selector, panelElement);
};

/**
 * Hides and removes any panel from the target element
 */
export const hidePanel = (selector: string | HTMLElement) => {
  const panelElement = panels.get(selector);
  if (panelElement && panelElement.parentNode) {
    panelElement.parentNode.removeChild(panelElement);
    panels.delete(selector);
  }
};

/**
 * Shows a loading panel with loading-specific defaults
 */
export const showLoadingPanel = (selector: string | HTMLElement, config: PanelConfig = {}) => {
  showPanel(selector, {
    icon: LoadingIcon,
    className: 'loading',
    ...config
  });
};

/**
 * Shows an error panel with error-specific defaults
 */
export const showErrorPanel = (selector: string | HTMLElement, config: PanelConfig = {}) => {
  showPanel(selector, {
    message: 'Failed to load SheetXL',
    icon: ErrorIcon,
    className: 'error',
    ...config
  });
};