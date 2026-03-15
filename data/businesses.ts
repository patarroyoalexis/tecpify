import type { BusinessConfig } from "@/types/storefront";

export const mockBusinesses: BusinessConfig[] = [
  {
    id: "panaderia-estacion",
    name: "Panaderia La Estacion",
    tagline: "Pedidos rapidos para clientes frecuentes y ventas por WhatsApp.",
    accent: "from-amber-300 via-orange-200 to-rose-100",
    availablePaymentMethods: [
      "Transferencia",
      "Tarjeta",
      "Nequi",
      "Contra entrega",
    ],
    availableDeliveryTypes: ["domicilio", "recogida en tienda"],
    products: [
      {
        id: "brownies",
        name: "Caja de brownies",
        description: "Caja surtida de brownies artesanales.",
        price: 18500,
      },
      {
        id: "cafe-500",
        name: "Cafe molido 500 g",
        description: "Tueste medio para casa u oficina.",
        price: 31500,
      },
      {
        id: "croissant-pack",
        name: "Pack de croissants",
        description: "Seis croissants de mantequilla recien horneados.",
        price: 22000,
      },
    ],
  },
  {
    id: "cafe-aura",
    name: "Cafe Aura",
    tagline: "Accesorios y consumibles listos para recoger o enviar.",
    accent: "from-sky-200 via-cyan-100 to-white",
    availablePaymentMethods: ["Transferencia", "Tarjeta", "Nequi", "Efectivo"],
    availableDeliveryTypes: ["domicilio", "recogida en tienda"],
    products: [
      {
        id: "vasos-12oz",
        name: "Vasos biodegradables 12 oz",
        description: "Pack de 50 unidades para bebidas frias o calientes.",
        price: 9600,
      },
      {
        id: "pitillos-bambu",
        name: "Pitillos de bambu",
        description: "Juego reutilizable con cepillo limpiador.",
        price: 14500,
      },
      {
        id: "servilletas",
        name: "Servilletas premium",
        description: "Paquete absorbente para barra o takeaway.",
        price: 12800,
      },
    ],
  },
];

export function getBusinessById(businessId: string) {
  return mockBusinesses.find((business) => business.id === businessId) ?? null;
}
