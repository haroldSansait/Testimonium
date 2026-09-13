import React from "react";
import { Redirect } from "expo-router";

export default function CaloyRoute() {
  return <Redirect href={"/(app)/(tabs)/(caloy)" as any} />;
}
