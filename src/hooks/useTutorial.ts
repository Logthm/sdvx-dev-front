import { useState, useEffect } from "react";

const TUTORIAL_STORAGE_KEY = "sdvx-tutorial-completed";

export function useTutorial(storageKey = TUTORIAL_STORAGE_KEY, enabled = true) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!enabled) { setIsOpen(false); return; }
    setCurrentStep(0);
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsOpen(false);
    }
  }, [storageKey, enabled]);

  const nextStep = () => setCurrentStep((prev) => prev + 1);
  const prevStep = () => setCurrentStep((prev) => Math.max(0, prev - 1));

  const closeTutorial = () => {
    setIsOpen(false);
    localStorage.setItem(storageKey, "true");
  };

  const skipTutorial = () => {
    closeTutorial();
  };

  const resetTutorial = () => {
    localStorage.removeItem(storageKey);
    setCurrentStep(0);
    setIsOpen(true);
  };

  return {
    isOpen,
    currentStep,
    nextStep,
    prevStep,
    closeTutorial,
    skipTutorial,
    resetTutorial,
  };
}
