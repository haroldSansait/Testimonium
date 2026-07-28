import type { IParishProvider } from "../types";
import type { Parish } from "../../types";
import { client } from "../../api/client";
import { getParishImage, getParishGallery } from "../../utils/parishImages";

const mapParish = (p: any): Parish => {
  if (!p) return p;
  const lat = p.latitude !== undefined && p.latitude !== null ? Number(p.latitude) : null;
  const lng = p.longitude !== undefined && p.longitude !== null ? Number(p.longitude) : null;
  
  const lookupData = {
    id: String(p.id),
    name: p.name || p.parishName || "",
    address: p.address || "",
    city: p.city || p.municipalityCity || "",
  };

  return {
    id: String(p.id),
    name: lookupData.name,
    address: lookupData.address,
    city: lookupData.city,
    province: p.province || "",
    coordinates: (lat !== null && lng !== null) ? { lat, lng } : { lat: 10.3941, lng: 123.2163 },
    coverImage: getParishImage(lookupData),
    gallery: getParishGallery(lookupData),
    phone: p.phone || p.contactNumber || "",
    email: p.email || "",
    facebookPage: p.facebookPage || "",
    officeHours: p.officeHours || "8:00 AM - 5:00 PM",
    patronSaint: p.patronSaint || "",
    feastDay: p.feastDay || "",
    description: p.description || `${lookupData.name || "Parish"} of Canlaon Vicariate.`,
    assignedPriest: p.priest || "Unassigned",
    assignedSecretary: p.secretary || "Unassigned",
    massSchedules: p.massSchedules || ["Sunday: 6:00 AM, 8:00 AM, 5:00 PM"],
    upcomingEvents: p.upcomingEvents || [],
    services: p.services || ["Baptism", "Confirmation", "Marriage", "Mass Intention"],
  };
};

export class ApiParishProvider implements IParishProvider {
  async getParishes(): Promise<Parish[]> {
    const response = await client.get<any>("/parishes");
    const list = Array.isArray(response)
      ? response
      : response?.items || response?.data || [];
    return list.map(mapParish);
  }

  async getParishById(id: string): Promise<Parish | null> {
    const response = await client.get<any>(`/parishes/${id}`);
    const data = response?.data !== undefined ? response.data : response;
    return mapParish(data);
  }
}
