import { Car } from "../config/schema";

export function normalize(raw: any, dealer: string): Car {
  return {
    marca: normalizeText(raw.brand || raw.marca || inferBrand(raw.model)) || null,
    modelo: normalizeText(raw.model || raw.modelo) || null,
    version: normalizeText(raw.version) || null,
    precio_lista: normalizePrice(raw.precio_lista || raw.price_cash),
    bono_marca: normalizePrice(raw.bono_todo_medio_pago || raw.bonus),
    bono_financiamiento: normalizePrice(raw.bono_financiamiento || raw.bonus_financing),
    precio_todo_medio_pago: normalizePrice(raw.precio_todo_medio_pago),
    precio_con_financiamiento: normalizePrice(raw.precio_con_financiamiento),
    url: raw.url || null,
    dealer: dealer || null,
  };
}

function normalizePrice(p: any): string | null {
  if (!p) return null;
  if (typeof p === "number") return p.toString();
  // Remover todo excepto números
  const cleaned = p.toString().replace(/[^0-9]/g, "");
  return cleaned || null;
}

function normalizeText(text: any): string | null {
  if (!text) return null;
  return text
    .toString()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[\n\r]/g, ' ')
    .trim();
}

function inferBrand(model: string | undefined): string | null {
  if (!model) return null;
  const brands = [
    "JEEP", "RAM", "FIAT", "MITSUBISHI", "SSANGYONG",
    "CHERY", "EXEED", "JMC", "GAC", "BYD", "PEUGEOT"
  ];
  const modelUpper = model.toUpperCase();
  for (const brand of brands) {
    if (modelUpper.includes(brand)) return brand;
  }
  return null;
}