import type {
  BusinessLocalDeliverySettings,
  LocalDeliveryCatalogImportDocument,
  LocalDeliveryCatalogImportValidationResult,
  LocalDeliveryNeighborhood,
  LocalDeliveryNeighborhoodOption,
  LocalDeliveryPricingBand,
  LocalDeliveryQuote,
  LocalDeliveryQuoteContext,
  StorefrontLocalDeliveryConfig,
} from "@/types/local-delivery";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
}

function normalizeCityKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDisplayText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeNeighborhoodName(value: string) {
  return normalizeDisplayText(value).toLocaleLowerCase("es-CO");
}

export function isMissingLocalDeliverySchemaMessage(message: string) {
  return (
    /local_delivery/i.test(message) &&
    /(column|relation|table|schema cache|does not exist|could not find)/i.test(message)
  );
}

export function parseLocalDeliveryPricingBands(
  value: unknown,
): LocalDeliveryPricingBand[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const upToKm = readFiniteNumber(item.upToKm ?? item.up_to_km);
    const fee = readFiniteNumber(item.fee);

    if (upToKm === null || fee === null) {
      return [];
    }

    return [
      {
        upToKm,
        fee,
      },
    ];
  });
}

export function getLocalDeliveryPricingBandsError(
  pricingBands: LocalDeliveryPricingBand[],
) {
  if (pricingBands.length === 0) {
    return "Debes registrar al menos una banda de cobro.";
  }

  let previousUpToKm = 0;

  for (const [index, pricingBand] of pricingBands.entries()) {
    if (!Number.isFinite(pricingBand.upToKm) || pricingBand.upToKm <= 0) {
      return `La banda ${index + 1} debe tener un limite en km mayor que 0.`;
    }

    if (!Number.isFinite(pricingBand.fee) || pricingBand.fee < 0) {
      return `La banda ${index + 1} debe tener un cobro valido mayor o igual a 0.`;
    }

    if (pricingBand.upToKm <= previousUpToKm) {
      return "Las bandas deben crecer en distancia sin empates ni retrocesos.";
    }

    previousUpToKm = pricingBand.upToKm;
  }

  return null;
}

export function normalizeLocalDeliveryPricingBands(
  pricingBands: LocalDeliveryPricingBand[],
) {
  return [...pricingBands]
    .map((pricingBand) => ({
      upToKm: Number(pricingBand.upToKm.toFixed(2)),
      fee: Math.round(pricingBand.fee),
    }))
    .sort((left, right) => left.upToKm - right.upToKm);
}

export function getStorefrontLocalDeliveryConfig(
  settings: BusinessLocalDeliverySettings,
  destinationNeighborhoods: LocalDeliveryNeighborhoodOption[],
  options?: {
    hasCatalogError?: boolean;
  },
): StorefrontLocalDeliveryConfig {
  if (settings.schemaStatus !== "ready") {
    return {
      status: "missing_db_contract",
      isEnabled: false,
      destinationNeighborhoods: [],
      message:
        "El domicilio local todavia depende de migraciones manuales pendientes en Supabase.",
    };
  }

  if (!settings.isEnabled) {
    return {
      status: "disabled",
      isEnabled: false,
      destinationNeighborhoods: [],
      message: "Este negocio no tiene domicilio local habilitado en este momento.",
    };
  }

  if (
    !settings.originNeighborhoodId ||
    settings.maxDistanceKm === null ||
    settings.maxDistanceKm <= 0 ||
    settings.pricingBands.length === 0
  ) {
    return {
      status: "missing_business_configuration",
      isEnabled: true,
      destinationNeighborhoods: [],
      message:
        "El negocio aun no termina de configurar su domicilio local. Por ahora puedes pedir para recoger en tienda.",
    };
  }

  if (options?.hasCatalogError) {
    return {
      status: "catalog_unavailable",
      isEnabled: true,
      destinationNeighborhoods: [],
      message:
        "El catalogo geografico no esta disponible en este momento para cotizar el domicilio.",
    };
  }

  return {
    status: "available",
    isEnabled: true,
    destinationNeighborhoods,
    message: null,
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateApproximateDistanceKm(
  origin: Pick<LocalDeliveryNeighborhood, "latitude" | "longitude">,
  destination: Pick<LocalDeliveryNeighborhood, "latitude" | "longitude">,
) {
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const latitude1 = toRadians(origin.latitude);
  const latitude2 = toRadians(destination.latitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(2));
}

export function quoteLocalDelivery(options: {
  settings: BusinessLocalDeliverySettings;
  originNeighborhood: LocalDeliveryNeighborhood | null;
  destinationNeighborhood: LocalDeliveryNeighborhood | null;
  deliveryType: "domicilio" | "recogida en tienda";
  catalogAvailable: boolean;
}): LocalDeliveryQuote {
  if (options.deliveryType !== "domicilio") {
    return {
      status: "not_applicable",
      deliveryFee: 0,
      message: "No aplica costo de domicilio para recogida en tienda.",
      context: null,
    };
  }

  if (options.settings.schemaStatus !== "ready") {
    return {
      status: "schema_not_ready",
      deliveryFee: null,
      message:
        "El domicilio local todavia depende de migraciones manuales pendientes en Supabase.",
      context: null,
    };
  }

  if (!options.settings.isEnabled) {
    return {
      status: "business_disabled",
      deliveryFee: null,
      message: "Este negocio no tiene domicilio local habilitado.",
      context: null,
    };
  }

  if (
    !options.settings.originNeighborhoodId ||
    options.settings.maxDistanceKm === null ||
    options.settings.maxDistanceKm <= 0 ||
    options.settings.pricingBands.length === 0 ||
    !options.originNeighborhood
  ) {
    return {
      status: "missing_business_configuration",
      deliveryFee: null,
      message:
        "El negocio aun no completa la configuracion minima para calcular domicilio local.",
      context: null,
    };
  }

  if (!options.catalogAvailable) {
    return {
      status: "catalog_unavailable",
      deliveryFee: null,
      message: "El catalogo geografico no esta disponible para cotizar este domicilio.",
      context: null,
    };
  }

  if (!options.destinationNeighborhood || !options.destinationNeighborhood.isActive) {
    return {
      status: "neighborhood_not_available",
      deliveryFee: null,
      message: "El barrio seleccionado no esta disponible para domicilio local.",
      context: null,
    };
  }

  if (options.destinationNeighborhood.cityKey !== options.originNeighborhood.cityKey) {
    return {
      status: "out_of_coverage",
      deliveryFee: null,
      message:
        "El barrio seleccionado esta fuera de la cobertura configurada para este negocio.",
      context: null,
    };
  }

  const distanceKm = calculateApproximateDistanceKm(
    options.originNeighborhood,
    options.destinationNeighborhood,
  );

  if (distanceKm > options.settings.maxDistanceKm) {
    return {
      status: "out_of_coverage",
      deliveryFee: null,
      message:
        "El barrio seleccionado esta fuera de la cobertura configurada para este negocio.",
      context: null,
    };
  }

  const matchingPricingBand = normalizeLocalDeliveryPricingBands(
    options.settings.pricingBands,
  ).find((pricingBand) => distanceKm <= pricingBand.upToKm);

  if (!matchingPricingBand) {
    return {
      status: "out_of_coverage",
      deliveryFee: null,
      message:
        "No existe una banda valida para calcular este domicilio dentro de la cobertura configurada.",
      context: null,
    };
  }

  const context: LocalDeliveryQuoteContext = {
    originNeighborhoodId: options.originNeighborhood.neighborhoodId,
    originNeighborhoodName: options.originNeighborhood.name,
    destinationNeighborhoodId: options.destinationNeighborhood.neighborhoodId,
    destinationNeighborhoodName: options.destinationNeighborhood.name,
    cityKey: options.destinationNeighborhood.cityKey,
    cityName: options.destinationNeighborhood.cityName,
    distanceKm,
    pricingBand: matchingPricingBand,
  };

  return {
    status: "available",
    deliveryFee: matchingPricingBand.fee,
    message: `Domicilio calculado para ${options.destinationNeighborhood.name}.`,
    context,
  };
}

function buildImportIssuePrefix(cityIndex: number, neighborhoodIndex?: number) {
  if (neighborhoodIndex === undefined) {
    return `cities[${cityIndex}]`;
  }

  return `cities[${cityIndex}].neighborhoods[${neighborhoodIndex}]`;
}

export function validateLocalDeliveryCatalogImportDocument(
  value: unknown,
): LocalDeliveryCatalogImportValidationResult {
  const issues: string[] = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      issues: ["El documento debe ser un objeto JSON con la clave cities."],
      cities: [],
      neighborhoods: [],
    };
  }

  const allowedRootFields = ["cities"];
  const invalidRootFields = Object.keys(value).filter(
    (field) => !allowedRootFields.includes(field),
  );

  if (invalidRootFields.length > 0) {
    issues.push(
      `El documento solo admite la clave cities. Sobran: ${invalidRootFields.join(", ")}.`,
    );
  }

  if (!Array.isArray(value.cities) || value.cities.length === 0) {
    issues.push("El documento debe incluir al menos una ciudad dentro de cities.");

    return {
      ok: false,
      issues,
      cities: [],
      neighborhoods: [],
    };
  }

  const previewCities: LocalDeliveryCatalogImportValidationResult["cities"] = [];
  const previewNeighborhoods: LocalDeliveryCatalogImportValidationResult["neighborhoods"] = [];
  const repeatedCityKeys = new Set<string>();

  value.cities.forEach((city, cityIndex) => {
    if (!isPlainObject(city)) {
      issues.push(`${buildImportIssuePrefix(cityIndex)} debe ser un objeto.`);
      return;
    }

    const invalidCityFields = Object.keys(city).filter(
      (field) => !["cityKey", "cityName", "neighborhoods"].includes(field),
    );

    if (invalidCityFields.length > 0) {
      issues.push(
        `${buildImportIssuePrefix(cityIndex)} contiene campos no permitidos: ${invalidCityFields.join(", ")}.`,
      );
    }

    const cityKey =
      typeof city.cityKey === "string" ? normalizeCityKey(city.cityKey) : "";
    const cityName =
      typeof city.cityName === "string" ? normalizeDisplayText(city.cityName) : "";

    if (!cityKey) {
      issues.push(`${buildImportIssuePrefix(cityIndex)}.cityKey es obligatorio.`);
    }

    if (!cityName) {
      issues.push(`${buildImportIssuePrefix(cityIndex)}.cityName es obligatorio.`);
    }

    if (cityKey) {
      if (repeatedCityKeys.has(cityKey)) {
        issues.push(`cityKey "${cityKey}" esta repetido dentro del mismo JSON.`);
      }

      repeatedCityKeys.add(cityKey);
    }

    if (!Array.isArray(city.neighborhoods) || city.neighborhoods.length === 0) {
      issues.push(
        `${buildImportIssuePrefix(cityIndex)} debe incluir neighborhoods con al menos un barrio.`,
      );
      return;
    }

    const repeatedNeighborhoodNames = new Set<string>();

    city.neighborhoods.forEach((neighborhood, neighborhoodIndex) => {
      if (!isPlainObject(neighborhood)) {
        issues.push(`${buildImportIssuePrefix(cityIndex, neighborhoodIndex)} debe ser un objeto.`);
        return;
      }

      const invalidNeighborhoodFields = Object.keys(neighborhood).filter(
        (field) => !["name", "latitude", "longitude", "isActive"].includes(field),
      );

      if (invalidNeighborhoodFields.length > 0) {
        issues.push(
          `${buildImportIssuePrefix(cityIndex, neighborhoodIndex)} contiene campos no permitidos: ${invalidNeighborhoodFields.join(", ")}.`,
        );
      }

      const name =
        typeof neighborhood.name === "string"
          ? normalizeDisplayText(neighborhood.name)
          : "";
      const normalizedNeighborhoodName = name
        ? normalizeNeighborhoodName(name)
        : "";
      const latitude = readFiniteNumber(neighborhood.latitude);
      const longitude = readFiniteNumber(neighborhood.longitude);
      const isActive =
        typeof neighborhood.isActive === "boolean" ? neighborhood.isActive : null;

      if (!name) {
        issues.push(`${buildImportIssuePrefix(cityIndex, neighborhoodIndex)}.name es obligatorio.`);
      }

      if (latitude === null || latitude < -90 || latitude > 90) {
        issues.push(
          `${buildImportIssuePrefix(cityIndex, neighborhoodIndex)}.latitude debe ser numerica y valida.`,
        );
      }

      if (longitude === null || longitude < -180 || longitude > 180) {
        issues.push(
          `${buildImportIssuePrefix(cityIndex, neighborhoodIndex)}.longitude debe ser numerica y valida.`,
        );
      }

      if (isActive === null) {
        issues.push(
          `${buildImportIssuePrefix(cityIndex, neighborhoodIndex)}.isActive debe ser booleano.`,
        );
      }

      if (normalizedNeighborhoodName) {
        if (repeatedNeighborhoodNames.has(normalizedNeighborhoodName)) {
          issues.push(
            `El barrio "${name}" esta repetido dentro de cityKey "${cityKey || cityIndex}".`,
          );
        }

        repeatedNeighborhoodNames.add(normalizedNeighborhoodName);
      }

      if (
        cityKey &&
        cityName &&
        name &&
        latitude !== null &&
        longitude !== null &&
        isActive !== null
      ) {
        previewNeighborhoods.push({
          cityKey,
          cityName,
          name,
          latitude,
          longitude,
          isActive,
        });
      }
    });

    if (cityKey && cityName) {
      previewCities.push({
        cityKey,
        cityName,
        neighborhoodsCount: city.neighborhoods.length,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issues,
    cities: previewCities,
    neighborhoods: previewNeighborhoods,
  };
}

export function parseLocalDeliveryCatalogImportDocument(
  text: string,
): {
  document: LocalDeliveryCatalogImportDocument | null;
  validation: LocalDeliveryCatalogImportValidationResult;
} {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(text);
  } catch {
    return {
      document: null,
      validation: {
        ok: false,
        issues: ["El JSON no es valido."],
        cities: [],
        neighborhoods: [],
      },
    };
  }

  const validation = validateLocalDeliveryCatalogImportDocument(parsedValue);

  if (!validation.ok) {
    return {
      document: null,
      validation,
    };
  }

  return {
    document: parsedValue as LocalDeliveryCatalogImportDocument,
    validation,
  };
}
