import React from 'react';
import ClientOnlyWorkbook from '../../components/ClientOnlyWorkbook';

// Add react-live imports you need here
const ReactLiveScope = {
  React,
  Studio: ClientOnlyWorkbook,
  ...React,
};

export default ReactLiveScope;
