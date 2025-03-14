
import React from "react";

const AppTitle: React.FC = () => {
  return (
    <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: "calc(60px + 5mm)" }}>
      <h1 className="text-3xl font-bold">
        <span className="text-white">Chars</span>
        <span className="bg-gradient-to-r from-green-300 to-purple-200 bg-clip-text text-transparent">Healt</span>
      </h1>
    </div>
  );
};

export default AppTitle;
