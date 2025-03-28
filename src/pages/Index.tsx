
import React from "react";
import { VitalSignsProvider } from "@/context/VitalSignsContext";
import VitalSignsMonitor from "@/components/VitalSignsMonitor";

const Index = () => {
  return (
    <VitalSignsProvider>
      <VitalSignsMonitor />
    </VitalSignsProvider>
  );
};

export default Index;
