import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { FeedbackModal, FeedbackType } from "@/components/ui/FeedbackModal";

export interface FeedbackOptions {
  title: string;
  message?: string;
  referenceNumber?: string | null;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export type FeedbackInput =
  | string
  | {
      title: string;
      message?: string;
      referenceNumber?: string | null;
      confirmText?: string;
      cancelText?: string;
      isDestructive?: boolean;
      onConfirm?: () => void | Promise<void>;
      onCancel?: () => void;
    };

export interface FeedbackContextValue {
  showSuccess: (
    titleOrOptions: FeedbackInput,
    message?: string,
    options?: Partial<FeedbackOptions>
  ) => void;
  showError: (
    titleOrOptions: FeedbackInput,
    message?: string,
    options?: Partial<FeedbackOptions>
  ) => void;
  showWarning: (
    titleOrOptions: FeedbackInput,
    message?: string,
    options?: Partial<FeedbackOptions>
  ) => void;
  showInfo: (
    titleOrOptions: FeedbackInput,
    message?: string,
    options?: Partial<FeedbackOptions>
  ) => void;
  showConfirm: (
    titleOrOptions: FeedbackInput,
    messageOrConfirm?: string | (() => void | Promise<void>),
    onConfirmOrOptions?: (() => void | Promise<void>) | Partial<FeedbackOptions>,
    options?: Partial<FeedbackOptions>
  ) => void;
  hideFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

interface ModalState extends FeedbackOptions {
  visible: boolean;
  type: FeedbackType;
}

const INITIAL_STATE: ModalState = {
  visible: false,
  type: "info",
  title: "",
  message: undefined,
  referenceNumber: null,
  confirmText: "OK",
  cancelText: undefined,
  isDestructive: false,
  onConfirm: undefined,
  onCancel: undefined,
};

const normalizeOptions = (
  titleOrOptions: FeedbackInput,
  message?: string,
  extraOptions?: Partial<FeedbackOptions>
): FeedbackOptions => {
  if (typeof titleOrOptions === "object" && titleOrOptions !== null) {
    return {
      title: titleOrOptions.title,
      message: titleOrOptions.message,
      referenceNumber: titleOrOptions.referenceNumber ?? null,
      confirmText: titleOrOptions.confirmText,
      cancelText: titleOrOptions.cancelText,
      isDestructive: titleOrOptions.isDestructive ?? false,
      onConfirm: titleOrOptions.onConfirm,
      onCancel: titleOrOptions.onCancel,
      ...extraOptions,
    };
  }

  return {
    title: String(titleOrOptions || ""),
    message,
    referenceNumber: extraOptions?.referenceNumber ?? null,
    confirmText: extraOptions?.confirmText,
    cancelText: extraOptions?.cancelText,
    isDestructive: extraOptions?.isDestructive ?? false,
    onConfirm: extraOptions?.onConfirm,
    onCancel: extraOptions?.onCancel,
  };
};

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ModalState>(INITIAL_STATE);
  const isExecutingRef = useRef(false);
  const hasFiredConfirmRef = useRef(false);

  const hideFeedback = useCallback(() => {
    isExecutingRef.current = false;
    setModalState(INITIAL_STATE);
  }, []);

  const showModal = useCallback((type: FeedbackType, options: FeedbackOptions) => {
    isExecutingRef.current = false;
    hasFiredConfirmRef.current = false;
    setModalState({
      visible: true,
      type,
      title: options.title,
      message: options.message,
      referenceNumber: options.referenceNumber ?? null, // Ensure previous ref does not leak
      confirmText: options.confirmText ?? (type === "confirm" ? "Confirm" : "OK"),
      cancelText: options.cancelText,
      isDestructive: options.isDestructive ?? false,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel,
    });
  }, []);

  const showSuccess = useCallback(
    (
      titleOrOptions: FeedbackInput,
      message?: string,
      options?: Partial<FeedbackOptions>
    ) => {
      showModal("success", normalizeOptions(titleOrOptions, message, options));
    },
    [showModal]
  );

  const showError = useCallback(
    (
      titleOrOptions: FeedbackInput,
      message?: string,
      options?: Partial<FeedbackOptions>
    ) => {
      showModal("error", normalizeOptions(titleOrOptions, message, options));
    },
    [showModal]
  );

  const showWarning = useCallback(
    (
      titleOrOptions: FeedbackInput,
      message?: string,
      options?: Partial<FeedbackOptions>
    ) => {
      showModal("warning", normalizeOptions(titleOrOptions, message, options));
    },
    [showModal]
  );

  const showInfo = useCallback(
    (
      titleOrOptions: FeedbackInput,
      message?: string,
      options?: Partial<FeedbackOptions>
    ) => {
      showModal("info", normalizeOptions(titleOrOptions, message, options));
    },
    [showModal]
  );

  const showConfirm = useCallback(
    (
      titleOrOptions: FeedbackInput,
      messageOrConfirm?: string | (() => void | Promise<void>),
      onConfirmOrOptions?: (() => void | Promise<void>) | Partial<FeedbackOptions>,
      options?: Partial<FeedbackOptions>
    ) => {
      if (typeof titleOrOptions === "object") {
        showModal("confirm", normalizeOptions(titleOrOptions));
        return;
      }

      const title = String(titleOrOptions);
      const message = typeof messageOrConfirm === "string" ? messageOrConfirm : undefined;
      const onConfirm =
        typeof messageOrConfirm === "function"
          ? messageOrConfirm
          : typeof onConfirmOrOptions === "function"
          ? onConfirmOrOptions
          : undefined;
      const extra =
        typeof onConfirmOrOptions === "object"
          ? onConfirmOrOptions
          : options || {};

      showModal("confirm", {
        title,
        message,
        confirmText: extra.confirmText || "Confirm",
        cancelText: extra.cancelText || "Cancel",
        isDestructive: extra.isDestructive ?? false,
        onConfirm,
        onCancel: extra.onCancel,
      });
    },
    [showModal]
  );

  const handleConfirm = useCallback(async () => {
    if (hasFiredConfirmRef.current || isExecutingRef.current) return;
    hasFiredConfirmRef.current = true;
    isExecutingRef.current = true;

    const currentConfirm = modalState.onConfirm;
    // Hide modal and clear state before executing navigation or callback
    hideFeedback();

    if (currentConfirm) {
      try {
        await currentConfirm();
      } catch (err) {
        if (__DEV__) console.error("Feedback confirm error:", err);
      }
    }
  }, [modalState.onConfirm, hideFeedback]);

  const handleCancel = useCallback(() => {
    if (isExecutingRef.current) return;
    const currentCancel = modalState.onCancel;
    hideFeedback();
    if (currentCancel) {
      currentCancel();
    }
  }, [modalState.onCancel, hideFeedback]);

  return (
    <FeedbackContext.Provider
      value={{
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
        hideFeedback,
      }}
    >
      {children}
      <FeedbackModal
        visible={modalState.visible}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        referenceNumber={modalState.referenceNumber}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isDestructive={modalState.isDestructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onClose={handleCancel}
      />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = (): FeedbackContextValue => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within a FeedbackProvider");
  }
  return context;
};
