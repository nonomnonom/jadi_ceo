import { getSetting } from '../db/settings.js';
import type { Db } from '../db/client.js';

export interface Province {
  id: string;
  name: string;
}

export interface City {
  id: string;
  provinceId: string;
  type: string;
  name: string;
}

export interface ShippingCost {
  courier: string;
  service: string;
  cost: number;
  etd: string;
  note: string;
}

export interface TrackingEvent {
  datetime: string;
  desc: string;
  location: string;
}

export interface TrackingResult {
  courier: string;
  waybill: string;
  status: string;
  events: TrackingEvent[];
}

export class RajaongkirService {
  private baseUrl = 'https://pro.rajaongkir.com/api';
  private db: Db;
  private tenantId: string;

  constructor({ db, tenantId }: { db: Db; tenantId: string }) {
    this.db = db;
    this.tenantId = tenantId;
  }

  private async getApiKey(): Promise<string> {
    const apiKey = await getSetting(this.db, this.tenantId, 'rajaongkirApiKey' as any);
    if (!apiKey) {
      throw new Error('Rajaongkir API key not configured');
    }
    return apiKey;
  }

  /**
   * Get list of provinces from Rajaongkir API with 24-hour cache
   */
  async getProvinces(): Promise<Province[]> {
    // Check cache first
    const cached = await this.getCached('provinces');
    if (cached) return cached;

    const apiKey = await this.getApiKey();
    const response = await fetch(`${this.baseUrl}/province`, {
      headers: { key: apiKey },
    });

    if (!response.ok) {
      throw new Error(`Rajaongkir API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      rajaongkir: { results: { province_id: string; province: string }[] };
    };

    const provinces: Province[] = data.rajaongkir.results.map((r) => ({
      id: r.province_id,
      name: r.province,
    }));

    // Cache for 24 hours
    await this.setCache('provinces', provinces, 24 * 60 * 60 * 1000);
    return provinces;
  }

  /**
   * Get list of cities from Rajaongkir API with 24-hour cache
   */
  async getCities(provinceId?: string): Promise<City[]> {
    const cacheKey = provinceId ? `cities_${provinceId}` : 'cities';
    const cached = await this.getCached(cacheKey);
    if (cached) return cached;

    const apiKey = await this.getApiKey();
    const url = provinceId
      ? `${this.baseUrl}/city?province=${provinceId}`
      : `${this.baseUrl}/city`;

    const response = await fetch(url, {
      headers: { key: apiKey },
    });

    if (!response.ok) {
      throw new Error(`Rajaongkir API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      rajaongkir: {
        results: { city_id: string; province_id: string; type: string; city_name: string }[];
      };
    };

    const cities: City[] = data.rajaongkir.results.map((r) => ({
      id: r.city_id,
      provinceId: r.province_id,
      type: r.type,
      name: r.city_name,
    }));

    // Cache for 24 hours
    await this.setCache(cacheKey, cities, 24 * 60 * 60 * 1000);
    return cities;
  }

  /**
   * Calculate shipping costs
   */
  async calculateShipping(params: {
    origin: string;
    destination: string;
    weight: number;
    courier: string;
  }): Promise<ShippingCost[]> {
    const apiKey = await this.getApiKey();
    const response = await fetch(`${this.baseUrl}/cost`, {
      method: 'POST',
      headers: {
        key: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        origin: params.origin,
        destination: params.destination,
        weight: String(params.weight),
        courier: params.courier,
      }),
    });

    if (!response.ok) {
      throw new Error(`Rajaongkir API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      rajaongkir: {
        results: {
          courier: string;
          costs: {
            service: string;
            cost: { value: number; etd: string; note: string }[];
          }[];
        }[];
      };
    };

    const costs: ShippingCost[] = [];
    for (const result of data.rajaongkir.results) {
      for (const serviceCost of result.costs) {
        for (const costDetail of serviceCost.cost) {
          costs.push({
            courier: result.courier,
            service: serviceCost.service,
            cost: costDetail.value,
            etd: costDetail.etd,
            note: costDetail.note,
          });
        }
      }
    }

    return costs;
  }

  /**
   * Track a shipment by waybill number and courier code
   */
  async trackShipment(waybill: string, courier: string): Promise<TrackingResult> {
    const apiKey = await this.getApiKey();
    const response = await fetch(`${this.baseUrl}/waybill`, {
      method: 'POST',
      headers: {
        key: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        waybill: waybill,
        courier: courier,
      }),
    });

    if (!response.ok) {
      throw new Error(`Rajaongkir tracking API error: ${response.status}`);
    }

    const data = await response.json() as {
      rajaongkir: {
        result: {
          courier_code: string;
          waybill_number: string;
          status: string;
          delivery_status: {
            pod_date: string;
            pod_time: string;
            desc: string;
            location: string;
          };
          manifest: Array<{
            manifest_date: string;
            manifest_time: string;
            manifest_description: string;
            city_name: string;
          }>;
        };
      };
    };

    const result = data.rajaongkir.result;
    const events: TrackingEvent[] = [];

    // Add delivery status as first event if exists
    if (result.delivery_status?.desc) {
      events.push({
        datetime: `${result.delivery_status.pod_date} ${result.delivery_status.pod_time}`,
        desc: result.delivery_status.desc,
        location: result.delivery_status.location,
      });
    }

    // Add manifest history
    for (const m of result.manifest || []) {
      events.push({
        datetime: `${m.manifest_date} ${m.manifest_time}`,
        desc: m.manifest_description,
        location: m.city_name,
      });
    }

    return {
      courier: result.courier_code,
      waybill: result.waybill_number,
      status: result.status,
      events,
    };
  }

  private async getCached(key: string): Promise<unknown | null> {
    try {
      const result = await this.db.execute({
        sql: "SELECT value FROM settings WHERE tenant_id = ? AND key = ?",
        args: [this.tenantId, `rajaongkir_cache_${key}`],
      });
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      if (!row || !row.value) return null;
      const cached = JSON.parse(String(row.value)) as { data: unknown; expiresAt: number };
      if (Date.now() > cached.expiresAt) {
        // Expired, delete
        await this.db.execute({
          sql: "DELETE FROM settings WHERE tenant_id = ? AND key = ?",
          args: [this.tenantId, `rajaongkir_cache_${key}`],
        });
        return null;
      }
      return cached.data;
    } catch {
      return null;
    }
  }

  private async setCache(key: string, data: unknown, ttlMs: number): Promise<void> {
    const value = JSON.stringify({ data, expiresAt: Date.now() + ttlMs });
    await this.db.execute({
      sql: `INSERT INTO settings (tenant_id, key, value, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT (tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [this.tenantId, `rajaongkir_cache_${key}`, value, Date.now()],
    });
  }
}
