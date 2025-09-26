/**
 * Simple panel to trigger various error scenarios for testing error boundaries and logging.
 */

export const ErrorTestPanel = () => {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 10,
      background: '#f0f0f0',
      padding: '10px',
      border: '1px solid #ccc',
      borderRadius: '4px',
      zIndex: 9999
    }}>
      <h4>Error Tests</h4>
      <button onClick={() => Promise.reject(new Error('Test async error'))}>
        Test Async Error
      </button>
      <br />
      <button onClick={() => setTimeout(() => { throw new Error('Test global error'); }, 100)}>
        Test Global Error
      </button>
      <br />
      <button onClick={() => { throw new Error('Test immediate error'); }}>
        Test React Error
      </button>
    </div>
  );
};
