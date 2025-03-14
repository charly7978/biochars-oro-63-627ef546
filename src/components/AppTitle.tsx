
import React from "react";

const AppTitle: React.FC = () => {
  return (
    <div className="absolute left-1/2 transform -translate-x-1/2" style={{ top: "calc(50% + 3mm)" }}>
      <h1 className="text-3xl font-bold">
        <span className="text-white">Chars</span>
        <span className="text-red-500">Healt</span>
      </h1>
    </div>
  );
};

export default AppTitle;
