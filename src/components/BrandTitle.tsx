
import React from 'react';

const BrandTitle = () => {
  return (
    <div className="absolute left-0 right-0 text-center" style={{ top: 'calc(50% + 15mm)' }}>
      <h1 className="text-3xl font-bold">
        <span className="text-white">Chars</span>
        <span className="text-red-500">Healt</span>
      </h1>
    </div>
  );
};

export default BrandTitle;
