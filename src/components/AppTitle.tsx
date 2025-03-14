
import React from "react";

const AppTitle: React.FC = () => {
  return (
    <h1 className="text-lg font-bold mt-4" style={{ marginLeft: "-4mm", marginTop: "8mm" }}>
      <span className="text-white">Chars</span>
      <span className="text-red-500">Healt</span>
    </h1>
  );
};

export default AppTitle;
