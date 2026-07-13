import type { IMapProvider } from '../types';

export class DemoMapProvider implements IMapProvider {
  private parishCoords: Record<string, { lat: number; lng: number }> = {
    'p1': { lat: 10.3837, lng: 123.1972 }, // San Isidro Labrador Parish, Canlaon City
    'p2': { lat: 10.4200, lng: 123.2300 }, // St. Joseph the Worker Parish, Malaiba
    'p3': { lat: 10.3750, lng: 123.1850 }, // Our Lady of Mt. Carmel, Masulog
    'p4': { lat: 10.3328, lng: 123.3278 }, // St. Francis Xavier, Vallehermoso
    'p5': { lat: 10.1206, lng: 123.2725 }, // Our Lady of the Holy Rosary, Guihulngan City
    'p6': { lat: 10.0244, lng: 123.2306 }, // St. Vincent Ferrer, La Libertad
    'p7': { lat: 9.9880,  lng: 123.2010 }  // St. Augustine, Jimalalud
  };

  async getParishCoordinates(parishId: string): Promise<{ lat: number; lng: number } | null> {
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.parishCoords[parishId] || null;
  }
}
