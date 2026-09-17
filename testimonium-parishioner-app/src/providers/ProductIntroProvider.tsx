import React, { createContext, useContext, useEffect, useState } from "react";
import {
  hasCompletedProductIntro,
  markProductIntroCompleted,
  resetProductIntro,
} from "@/services/onboarding/productOnboardingStorage";

interface ProductIntroContextType {
  introCompleted: boolean | null;
  completeIntro: () => Promise<void>;
  resetIntro: () => Promise<void>;
}

const ProductIntroContext = createContext<ProductIntroContextType>({
  introCompleted: null,
  completeIntro: async () => {},
  resetIntro: async () => {},
});

export const ProductIntroProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [introCompleted, setIntroCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    hasCompletedProductIntro().then((completed) => {
      if (isMounted) {
        setIntroCompleted(completed);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const completeIntro = async () => {
    await markProductIntroCompleted();
    setIntroCompleted(true);
  };

  const resetIntro = async () => {
    await resetProductIntro();
    setIntroCompleted(false);
  };

  return (
    <ProductIntroContext.Provider
      value={{
        introCompleted,
        completeIntro,
        resetIntro,
      }}
    >
      {children}
    </ProductIntroContext.Provider>
  );
};

export const useProductIntro = () => useContext(ProductIntroContext);
