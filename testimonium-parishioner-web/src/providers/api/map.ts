import type { IMapProvider } from "../types";

export class ApiMapProvider implements IMapProvider {
  async getParishCoordinates(_parishId: string): Promise<{ lat: number; lng: number } | null> {
    return { lat: 10.3157, lng: 123.8854 };
  }
}
