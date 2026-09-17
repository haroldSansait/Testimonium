import React from "react";
import { Pressable, type PressableProps } from "react-native";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export interface MotionPressableProps extends PressableProps {
  scalePressed?: number;
  opacityPressed?: number;
}

export const MotionPressable: React.FC<MotionPressableProps> = ({
  children,
  style,
  scalePressed = 0.98,
  opacityPressed = 0.88,
  disabled,
  ...props
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <Pressable
      disabled={disabled}
      style={(state) => {
        const isPressed = state.pressed && !disabled;
        const resolvedStyle = typeof style === "function" ? style(state) : style;

        if (reduceMotion) {
          return [
            resolvedStyle,
            isPressed && { opacity: opacityPressed },
          ];
        }

        return [
          resolvedStyle,
          isPressed && {
            opacity: opacityPressed,
            transform: [{ scale: scalePressed }],
          },
        ];
      }}
      {...props}
    >
      {children}
    </Pressable>
  );
};
