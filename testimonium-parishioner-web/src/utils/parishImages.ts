import cabagtasanImg from '../assets/parishes/cabagtasan.png';
import canlaonImg from '../assets/parishes/canlaon.png';
import dsbImg from '../assets/parishes/dsb.png';
import masulogImg from '../assets/parishes/masulog.png';
import prosperidadImg from '../assets/parishes/prosperidad.png';
import quezonImg from '../assets/parishes/quezon.png';
import tagbinoImg from '../assets/parishes/tagbino.png';

export interface ParishImageLookup {
  id?: string;
  name?: string;
  address?: string;
  city?: string;
}

/**
 * Resolves a parish cover image asset based on the parish ID, name, address, or city.
 * Returns the resolved local PNG asset or a fallback path if no match is found.
 */
export function getParishImage(parish: ParishImageLookup | string | null | undefined): string {
  if (!parish) {
    return '/assets/church_placeholder.png';
  }

  let id = '';
  let name = '';
  let address = '';
  let city = '';

  if (typeof parish === 'string') {
    name = parish;
    address = parish;
    city = parish;
  } else {
    id = parish.id || '';
    name = parish.name || '';
    address = parish.address || '';
    city = parish.city || '';
  }

  const searchStr = `${id} ${name} ${address} ${city}`.toLowerCase();

  // 1. Mountains / Cabagtasan
  if (searchStr.includes('cabagtasan') || searchStr.includes('mountain')) {
    return cabagtasanImg;
  }

  // 2. Canlaon City / San Isidro / St. Joseph
  if (
    searchStr.includes('canlaon') ||
    searchStr.includes('isidro') ||
    searchStr.includes('labrador') ||
    searchStr.includes('joseph') ||
    searchStr.includes('p1') ||
    searchStr.includes('p2')
  ) {
    return canlaonImg;
  }

  // 3. Don Salvador Benedicto / DSB / Miraculous Medal
  if (
    searchStr.includes('don salvador') ||
    searchStr.includes('benedicto') ||
    searchStr.includes('dsb') ||
    searchStr.includes('miraculous')
  ) {
    return dsbImg;
  }

  // 4. Masulog / Mount Carmel / Las Flores
  if (
    searchStr.includes('masulog') ||
    searchStr.includes('carmel') ||
    searchStr.includes('flores') ||
    searchStr.includes('p3')
  ) {
    return masulogImg;
  }

  // 5. Prosperidad / Peace and Good Voyage
  if (
    searchStr.includes('prosperidad') ||
    searchStr.includes('peace and good voyage') ||
    searchStr.includes('voyage')
  ) {
    return prosperidadImg;
  }

  // 6. Quezon / Holy Child
  if (
    searchStr.includes('quezon') ||
    searchStr.includes('holy child') ||
    searchStr.includes('child') ||
    searchStr.includes('niño') ||
    searchStr.includes('nino')
  ) {
    return quezonImg;
  }

  // 7. Tagbino / Guadalupe / Vallehermoso
  if (
    searchStr.includes('tagbino') ||
    searchStr.includes('guadalupe') ||
    searchStr.includes('vallehermoso') ||
    searchStr.includes('p4')
  ) {
    return tagbinoImg;
  }

  return '/assets/church_placeholder.png';
}

/**
 * Resolves gallery images for a parish.
 * Exposes a reusable array of images starting with the cover image.
 */
export function getParishGallery(parish: ParishImageLookup | string | null | undefined): string[] {
  const cover = getParishImage(parish);
  return [cover];
}
