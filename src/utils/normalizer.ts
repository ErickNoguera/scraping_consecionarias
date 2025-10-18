import { Car } from "../config/schema";

export function normalize(raw: any, dealer: string): Car {
  return {
    marca: raw.brand || raw.marca || inferBrand(raw.model) || null,
    modelo: raw.model || raw.modelo || raw.name || null,
    version: raw.version || null,
    precio_lista: normalizePrice(raw.precio_lista || raw.price || raw.contado),
    bono_marca: normalizePrice(raw.bono_marca || raw.bonus_brand),
    bono_financiamiento: normalizePrice(raw.bono_financiamiento || raw.bonus_financing),
    url: raw.url || null,
    dealer: dealer || null, 
  };
}

function normalizePrice(p: any): string | null {
  if (!p) return null;
  if (typeof p === "number") return p.toString();
  return p.toString().replace(/[^0-9]/g, "");
}

function inferBrand(model: string | undefined): string | null {
  if (!model) return null;
  const brands = [
    "Toyota", "Hyundai", "Kia", "Citroen", "Chevrolet", 
    "Ford", "Nissan", "Mazda", "Renault", "Honda",
    "Peugeot", "Volkswagen", "Suzuki", "Mitsubishi", "Subaru"
  ];
  const low = model.toLowerCase();
  for (const b of brands) {
    if (low.includes(b.toLowerCase())) return b;
  }
  return null;
}