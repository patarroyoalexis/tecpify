/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const {
  getStorefrontLocalDeliveryConfig,
  quoteLocalDelivery,
  validateLocalDeliveryCatalogImportDocument,
} = loadTsModule("lib/local-delivery/core.ts");

function createReadySettings(overrides = {}) {
  return {
    schemaStatus: "ready",
    isEnabled: true,
    originNeighborhoodId: "origin-neighborhood",
    maxDistanceKm: 5,
    pricingBands: [
      { upToKm: 2, fee: 5000 },
      { upToKm: 5, fee: 8000 },
    ],
    ...overrides,
  };
}

function createNeighborhood(overrides = {}) {
  return {
    neighborhoodId: "origin-neighborhood",
    cityKey: "bogota-centro",
    cityName: "Bogota",
    name: "La Soledad",
    latitude: 4.637,
    longitude: -74.078,
    isActive: true,
    ...overrides,
  };
}

test("local delivery core: storefront config declara pendiente por migraciones cuando el esquema no existe", () => {
  const config = getStorefrontLocalDeliveryConfig(
    {
      schemaStatus: "missing_db_contract",
      isEnabled: false,
      originNeighborhoodId: null,
      maxDistanceKm: null,
      pricingBands: [],
    },
    [],
  );

  assert.equal(config.status, "missing_db_contract");
  assert.match(config.message, /migraciones manuales pendientes/i);
});

test("local delivery core: cotiza el valor final usando barrio origen, barrio destino y bandas del negocio", () => {
  const originNeighborhood = createNeighborhood();
  const destinationNeighborhood = createNeighborhood({
    neighborhoodId: "destination-neighborhood",
    name: "Teusaquillo",
    latitude: 4.641,
    longitude: -74.083,
  });

  const quote = quoteLocalDelivery({
    settings: createReadySettings(),
    originNeighborhood,
    destinationNeighborhood,
    deliveryType: "domicilio",
    catalogAvailable: true,
  });

  assert.equal(quote.status, "available");
  assert.equal(quote.deliveryFee, 5000);
  assert.equal(quote.context.destinationNeighborhoodName, "Teusaquillo");
});

test("local delivery core: marca fuera de cobertura cuando no existe una tarifa valida para el barrio", () => {
  const originNeighborhood = createNeighborhood();
  const destinationNeighborhood = createNeighborhood({
    neighborhoodId: "destination-neighborhood",
    name: "Suba",
    latitude: 4.75,
    longitude: -74.09,
  });

  const quote = quoteLocalDelivery({
    settings: createReadySettings({ maxDistanceKm: 3 }),
    originNeighborhood,
    destinationNeighborhood,
    deliveryType: "domicilio",
    catalogAvailable: true,
  });

  assert.equal(quote.status, "out_of_coverage");
  assert.equal(quote.deliveryFee, null);
});

test("local delivery core: el import JSON exige formato estricto y no acepta campos inventados", () => {
  const validation = validateLocalDeliveryCatalogImportDocument({
    cities: [
      {
        cityKey: "bogota-centro",
        cityName: "Bogota",
        extra: true,
        neighborhoods: [
          {
            name: "La Soledad",
            latitude: 4.637,
            longitude: -74.078,
            isActive: true,
          },
        ],
      },
    ],
  });

  assert.equal(validation.ok, false);
  assert.match(validation.issues.join("\n"), /campos no permitidos/i);
});

test("local delivery core: el import JSON normaliza una ciudad y sus barrios validos para preview", () => {
  const validation = validateLocalDeliveryCatalogImportDocument({
    cities: [
      {
        cityKey: "Bogotá Centro",
        cityName: "Bogota",
        neighborhoods: [
          {
            name: " La Soledad ",
            latitude: "4.637",
            longitude: "-74.078",
            isActive: true,
          },
        ],
      },
    ],
  });

  assert.equal(validation.ok, true);
  assert.deepEqual(validation.cities, [
    {
      cityKey: "bogota-centro",
      cityName: "Bogota",
      neighborhoodsCount: 1,
    },
  ]);
  assert.equal(validation.neighborhoods[0].name, "La Soledad");
});
