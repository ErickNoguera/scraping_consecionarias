import { Car } from "../config/schema";

export function normalize(raw: any, dealer: string): Car {
  return {
    marca: raw.brand || raw.marca || inferBrand(raw.model) || null,
    modelo: raw.model || raw.modelo || null,
    version: raw.version || null,
    precio_lista: normalizePrice(raw.price_cash || raw.precio_lista),
    bono_marca: normalizePrice(raw.bono_todo_medio_pago || raw.bonus),
    bono_financiamiento: normalizePrice(raw.bono_financiamiento || raw.bonus_financing),
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
    "Jeep", "Ram", "Fiat", "Mitsubishi", "SsangYong",
    "Chery", "Exeed", "JMC", "GAC", "BYD"
  ];
  const low = model.toLowerCase();
  for (const b of brands) {
    if (low.includes(b.toLowerCase())) return b;
  }
  return null;
}