import React from 'react';

export default function GridPipelineCanvas() {
  return (
    <div style={{ padding: '24px', border: '2px dashed #3b82f6', borderRadius: '8px', background: '#0f172a', color: '#f8fafc' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>AesirGrid Core Pipeline Canvas</h3>
      <p style={{ color: '#94a3b8', fontSize: '14px' }}>Telemetry pipeline initialized. Active websocket stream binding on port 8765.</p>
    </div>
  );
}
