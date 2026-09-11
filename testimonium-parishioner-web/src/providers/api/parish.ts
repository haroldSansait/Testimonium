import type { IParishProvider } from "../types";
import type { Parish } from "../../types";
import { client } from "../../api/client";
import { getParishImage, getParishGallery } from "../../utils/parishImages";
import { collectAllActiveParishes } from "./parishPagination";

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

  const mappedCover = p.coverImage || getParishImage(lookupData);
  const mappedGallery = p.coverImage ? [p.coverImage] : getParishGallery(lookupData);

  return {
    id: String(p.id),
    name: lookupData.name,
    address: lookupData.address,
    city: lookupData.city,
    province: p.province || "",
    coordinates: (lat !== null && lng !== null) ? { lat, lng } : { lat: 10.3941, lng: 123.2163 },
    coverImage: mappedCover,
    gallery: mappedGallery,
    phone: p.contactNumber || p.phone || "",
    email: p.email || "",
    facebookPage: p.facebookPage || "",
    officeHours: p.officeHours || null,
    patronSaint: p.patronSaint || "",
    feastDay: p.feastDay || "",
    description: p.directoryDescription || p.description || `${lookupData.name || "Parish"} of Canlaon Vicariate.`,
    assignedPriest: p.priest || "Unassigned",
    assignedSecretary: p.secretary || "Unassigned",
    massSchedules: p.massSchedules || [],
    upcomingEvents: p.upcomingEvents || [],
    services: p.services || [],
    logoImage: p.logoImage || "",
    pinColor: p.pinColor || "#7B1C2A",
    showLabel: p.showLabel ?? true,
    directoryDescription: p.directoryDescription || "",
    paymentQrImage: p.paymentQrImage || null,
    paymentQrEnabled: Boolean(p.paymentQrEnabled),
    availableDocuments: p.availableDocuments
      ? typeof p.availableDocuments === "string"
        ? JSON.parse(p.availableDocuments)
        : p.availableDocuments
      : null,
    venueCapacity: p.venueCapacity !== undefined && p.venueCapacity !== null ? Number(p.venueCapacity) : null,
    eventSettings: p.eventSettings
      ? typeof p.eventSettings === "string"
        ? (() => { try { return JSON.parse(p.eventSettings); } catch { return p.eventSettings; } })()
        : p.eventSettings
      : null,
    councils: p.councils !== undefined ? p.councils : null,
  };
};

export class ApiParishProvider implements IParishProvider {
  async getParishes(): Promise<Parish[]> {
    const list = await collectAllActiveParishes<any>((page, limit) =>
      client.get<any>("/parishes", { page, limit, status: "Active" })
    );
    return list.map(mapParish);
  }

  async getParishById(id: string): Promise<Parish | null> {
    const response = await client.get<any>(`/parishes/${id}`);
    const data = response?.data !== undefined ? response.data : response;
    return mapParish(data);
  }
}
