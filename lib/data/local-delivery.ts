import {
  createServerSupabaseAuthClient,
  createServerSupabasePublicClient,
} from "@/lib/supabase/server";
import {
  getLocalDeliveryPricingBandsError,
  getStorefrontLocalDeliveryConfig,
  isMissingLocalDeliverySchemaMessage,
  normalizeLocalDeliveryPricingBands,
  parseLocalDeliveryPricingBands,
  quoteLocalDelivery,
} from "@/lib/local-delivery/core";
import type {
  BusinessLocalDeliverySettings,
  LocalDeliveryAdminCatalogSnapshot,
  LocalDeliveryCatalogImportDocument,
  LocalDeliveryNeighborhood,
  LocalDeliveryNeighborhoodOption,
  LocalDeliveryQuote,
  StorefrontLocalDeliveryConfig,
} from "@/types/local-delivery";

interface LocalDeliveryBusinessSettingsRow {
  id: string;
  local_delivery_enabled?: boolean | null;
  local_delivery_origin_neighborhood_id?: string | null;
  local_delivery_max_distance_km?: number | string | null;
  local_delivery_pricing_bands?: unknown;
}

interface LocalDeliveryNeighborhoodRow {
  id: string;
  city_key: string;
  city_name: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  is_active: boolean;
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

function createMissingSchemaBusinessLocalDeliverySettings(): BusinessLocalDeliverySettings {
  return {
    schemaStatus: "missing_db_contract",
    isEnabled: false,
    originNeighborhoodId: null,
    maxDistanceKm: null,
    pricingBands: [],
  };
}

function mapBusinessLocalDeliverySettingsRow(
  row: LocalDeliveryBusinessSettingsRow,
): BusinessLocalDeliverySettings {
  const pricingBands = normalizeLocalDeliveryPricingBands(
    parseLocalDeliveryPricingBands(row.local_delivery_pricing_bands),
  );
  const pricingBandsError = getLocalDeliveryPricingBandsError(pricingBands);
  const maxDistanceKm = readFiniteNumber(row.local_delivery_max_distance_km);

  return {
    schemaStatus: "ready",
    isEnabled: row.local_delivery_enabled === true,
    originNeighborhoodId:
      typeof row.local_delivery_origin_neighborhood_id === "string"
        ? row.local_delivery_origin_neighborhood_id
        : null,
    maxDistanceKm,
    pricingBands: pricingBandsError ? [] : pricingBands,
  };
}

function mapNeighborhoodRow(row: LocalDeliveryNeighborhoodRow): LocalDeliveryNeighborhood {
  const latitude = readFiniteNumber(row.latitude);
  const longitude = readFiniteNumber(row.longitude);

  if (latitude === null || longitude === null) {
    throw new Error(`El barrio ${row.id} tiene coordenadas invalidas.`);
  }

  return {
    neighborhoodId: row.id,
    cityKey: row.city_key,
    cityName: row.city_name,
    name: row.name,
    latitude,
    longitude,
    isActive: row.is_active,
  };
}

function toNeighborhoodOption(
  neighborhood: LocalDeliveryNeighborhood,
): LocalDeliveryNeighborhoodOption {
  return {
    neighborhoodId: neighborhood.neighborhoodId,
    cityKey: neighborhood.cityKey,
    cityName: neighborhood.cityName,
    name: neighborhood.name,
  };
}

function createMissingSchemaCatalogSnapshot(
  message: string,
): LocalDeliveryAdminCatalogSnapshot {
  return {
    schemaStatus: "missing_db_contract",
    totalNeighborhoods: 0,
    activeNeighborhoods: 0,
    cities: [],
    message,
  };
}

async function getBusinessLocalDeliverySettingsByBusinessIds(
  businessIds: string[],
) {
  if (businessIds.length === 0) {
    return new Map<string, BusinessLocalDeliverySettings>();
  }

  const supabase = await createServerSupabaseAuthClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, local_delivery_enabled, local_delivery_origin_neighborhood_id, local_delivery_max_distance_km, local_delivery_pricing_bands",
    )
    .in("id", businessIds);

  if (error) {
    if (isMissingLocalDeliverySchemaMessage(error.message)) {
      return new Map(
        businessIds.map((businessId) => [
          businessId,
          createMissingSchemaBusinessLocalDeliverySettings(),
        ]),
      );
    }

    throw new Error(
      `No fue posible leer la configuracion de domicilio local desde businesses. ${error.message}`,
    );
  }

  const settingsByBusinessId = new Map<string, BusinessLocalDeliverySettings>();

  for (const row of (data ?? []) as LocalDeliveryBusinessSettingsRow[]) {
    settingsByBusinessId.set(row.id, mapBusinessLocalDeliverySettingsRow(row));
  }

  for (const businessId of businessIds) {
    if (!settingsByBusinessId.has(businessId)) {
      settingsByBusinessId.set(
        businessId,
        createMissingSchemaBusinessLocalDeliverySettings(),
      );
    }
  }

  return settingsByBusinessId;
}

async function getPublicBusinessLocalDeliverySettingsByBusinessId(
  businessId: string,
) {
  const supabase = createServerSupabasePublicClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, local_delivery_enabled, local_delivery_origin_neighborhood_id, local_delivery_max_distance_km, local_delivery_pricing_bands",
    )
    .eq("id", businessId)
    .maybeSingle<LocalDeliveryBusinessSettingsRow>();

  if (error) {
    if (isMissingLocalDeliverySchemaMessage(error.message)) {
      return createMissingSchemaBusinessLocalDeliverySettings();
    }

    throw new Error(
      `No fue posible leer la configuracion publica de domicilio local. ${error.message}`,
    );
  }

  return data
    ? mapBusinessLocalDeliverySettingsRow(data)
    : createMissingSchemaBusinessLocalDeliverySettings();
}

async function getNeighborhoodsFromCatalog(options?: {
  cityKey?: string;
  activeOnly?: boolean;
  mode?: "auth" | "public";
}) {
  const supabase =
    options?.mode === "auth"
      ? await createServerSupabaseAuthClient()
      : createServerSupabasePublicClient();
  let query = supabase
    .from("local_delivery_neighborhoods")
    .select("id, city_key, city_name, name, latitude, longitude, is_active")
    .order("city_name", { ascending: true })
    .order("name", { ascending: true });

  if (options?.cityKey) {
    query = query.eq("city_key", options.cityKey);
  }

  if (options?.activeOnly !== false) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingLocalDeliverySchemaMessage(error.message)) {
      return {
        schemaStatus: "missing_db_contract" as const,
        neighborhoods: [] as LocalDeliveryNeighborhood[],
        message:
          "El catalogo geografico todavia depende de migraciones manuales pendientes.",
      };
    }

    throw new Error(
      `No fue posible leer el catalogo geografico de domicilio local. ${error.message}`,
    );
  }

  return {
    schemaStatus: "ready" as const,
    neighborhoods: ((data ?? []) as LocalDeliveryNeighborhoodRow[]).map(
      mapNeighborhoodRow,
    ),
    message: null,
  };
}

export async function getOwnedBusinessesLocalDeliverySettings(
  businessIds: string[],
) {
  return getBusinessLocalDeliverySettingsByBusinessIds(businessIds);
}

export async function getOwnerLocalDeliveryCatalogOptions() {
  const catalogResult = await getNeighborhoodsFromCatalog({ mode: "auth", activeOnly: true });

  return {
    schemaStatus: catalogResult.schemaStatus,
    neighborhoods: catalogResult.neighborhoods.map(toNeighborhoodOption),
    message: catalogResult.message,
  };
}

export async function getStorefrontLocalDeliveryConfigByBusinessId(
  businessId: string,
): Promise<StorefrontLocalDeliveryConfig> {
  const settings = await getPublicBusinessLocalDeliverySettingsByBusinessId(businessId);

  if (settings.schemaStatus !== "ready") {
    return getStorefrontLocalDeliveryConfig(settings, []);
  }

  const catalogResult = await getNeighborhoodsFromCatalog({ mode: "public", activeOnly: true });

  if (
    settings.originNeighborhoodId &&
    catalogResult.schemaStatus === "ready"
  ) {
    const originNeighborhood = catalogResult.neighborhoods.find(
      (neighborhood) => neighborhood.neighborhoodId === settings.originNeighborhoodId,
    );
    const destinationNeighborhoods = originNeighborhood
      ? catalogResult.neighborhoods
          .filter((neighborhood) => neighborhood.cityKey === originNeighborhood.cityKey)
          .map(toNeighborhoodOption)
      : [];

    return getStorefrontLocalDeliveryConfig(settings, destinationNeighborhoods, {
      hasCatalogError: false,
    });
  }

  return getStorefrontLocalDeliveryConfig(settings, [], {
    hasCatalogError: catalogResult.schemaStatus !== "ready",
  });
}

export async function quoteStorefrontLocalDeliveryByBusinessId(options: {
  businessId: string;
  neighborhoodId: string;
  deliveryType: "domicilio" | "recogida en tienda";
}): Promise<LocalDeliveryQuote> {
  const settings = await getPublicBusinessLocalDeliverySettingsByBusinessId(options.businessId);

  if (settings.schemaStatus !== "ready") {
    return quoteLocalDelivery({
      settings,
      originNeighborhood: null,
      destinationNeighborhood: null,
      deliveryType: options.deliveryType,
      catalogAvailable: false,
    });
  }

  const catalogResult = await getNeighborhoodsFromCatalog({
    mode: "public",
    activeOnly: false,
  });

  const originNeighborhood =
    catalogResult.schemaStatus === "ready"
      ? catalogResult.neighborhoods.find(
          (neighborhood) => neighborhood.neighborhoodId === settings.originNeighborhoodId,
        ) ?? null
      : null;
  const destinationNeighborhood =
    catalogResult.schemaStatus === "ready"
      ? catalogResult.neighborhoods.find(
          (neighborhood) => neighborhood.neighborhoodId === options.neighborhoodId,
        ) ?? null
      : null;

  return quoteLocalDelivery({
    settings,
    originNeighborhood,
    destinationNeighborhood,
    deliveryType: options.deliveryType,
    catalogAvailable: catalogResult.schemaStatus === "ready",
  });
}

export async function getLocalDeliveryAdminCatalogSnapshot(): Promise<LocalDeliveryAdminCatalogSnapshot> {
  const catalogResult = await getNeighborhoodsFromCatalog({
    mode: "auth",
    activeOnly: false,
  });

  if (catalogResult.schemaStatus !== "ready") {
    return createMissingSchemaCatalogSnapshot(catalogResult.message ?? "Catalogo no disponible.");
  }

  const cityMap = new Map<
    string,
    { cityKey: string; cityName: string; activeNeighborhoodsCount: number; inactiveNeighborhoodsCount: number }
  >();

  for (const neighborhood of catalogResult.neighborhoods) {
    const citySummary = cityMap.get(neighborhood.cityKey) ?? {
      cityKey: neighborhood.cityKey,
      cityName: neighborhood.cityName,
      activeNeighborhoodsCount: 0,
      inactiveNeighborhoodsCount: 0,
    };

    if (neighborhood.isActive) {
      citySummary.activeNeighborhoodsCount += 1;
    } else {
      citySummary.inactiveNeighborhoodsCount += 1;
    }

    cityMap.set(neighborhood.cityKey, citySummary);
  }

  return {
    schemaStatus: "ready",
    totalNeighborhoods: catalogResult.neighborhoods.length,
    activeNeighborhoods: catalogResult.neighborhoods.filter((row) => row.isActive).length,
    cities: [...cityMap.values()].sort((left, right) =>
      left.cityName.localeCompare(right.cityName, "es-CO"),
    ),
    message: null,
  };
}

export async function importLocalDeliveryCatalogDocument(
  document: LocalDeliveryCatalogImportDocument,
) {
  const supabase = await createServerSupabaseAuthClient();
  const cityKeys = document.cities.map((city) => city.cityKey);
  const existingCatalogResult = await getNeighborhoodsFromCatalog({
    mode: "auth",
    activeOnly: false,
  });

  if (existingCatalogResult.schemaStatus !== "ready") {
    throw new Error(
      existingCatalogResult.message ??
        "El catalogo geografico todavia depende de migraciones manuales pendientes.",
    );
  }

  const existingByCompositeKey = new Map(
    existingCatalogResult.neighborhoods
      .filter((neighborhood) => cityKeys.includes(neighborhood.cityKey))
      .map((neighborhood) => [
        `${neighborhood.cityKey}::${neighborhood.name.trim().toLocaleLowerCase("es-CO")}`,
        neighborhood,
      ]),
  );

  let updatedCount = 0;
  let insertedCount = 0;

  for (const city of document.cities) {
    for (const neighborhood of city.neighborhoods) {
      const compositeKey = `${city.cityKey}::${neighborhood.name
        .trim()
        .toLocaleLowerCase("es-CO")}`;
      const existingNeighborhood = existingByCompositeKey.get(compositeKey);

      if (existingNeighborhood) {
        const { error } = await supabase
          .from("local_delivery_neighborhoods")
          .update({
            city_name: city.cityName,
            name: neighborhood.name,
            latitude: neighborhood.latitude,
            longitude: neighborhood.longitude,
            is_active: neighborhood.isActive,
          })
          .eq("id", existingNeighborhood.neighborhoodId);

        if (error) {
          if (isMissingLocalDeliverySchemaMessage(error.message)) {
            throw new Error(
              "El catalogo geografico todavia depende de migraciones manuales pendientes.",
            );
          }

          throw new Error(
            `No fue posible actualizar el barrio "${neighborhood.name}" de ${city.cityName}. ${error.message}`,
          );
        }

        updatedCount += 1;
        continue;
      }

      const { error } = await supabase.from("local_delivery_neighborhoods").insert({
        id: crypto.randomUUID(),
        city_key: city.cityKey,
        city_name: city.cityName,
        name: neighborhood.name,
        latitude: neighborhood.latitude,
        longitude: neighborhood.longitude,
        is_active: neighborhood.isActive,
      });

      if (error) {
        if (isMissingLocalDeliverySchemaMessage(error.message)) {
          throw new Error(
            "El catalogo geografico todavia depende de migraciones manuales pendientes.",
          );
        }

        throw new Error(
          `No fue posible insertar el barrio "${neighborhood.name}" de ${city.cityName}. ${error.message}`,
        );
      }

      insertedCount += 1;
    }
  }

  return {
    insertedCount,
    updatedCount,
  };
}
