import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_TENANT_ID } from '@juragan/shared';
import { getDb } from '../../src/db/client.js';
import { initSchema } from '../../src/db/schema.js';
import { setSetting } from '../../src/db/settings.js';

describe('RajaongkirService', () => {
  beforeEach(async () => {
    const db = getDb();
    await initSchema(db);
    // Clear all rajaongkir cache entries
    await db.execute({
      sql: "DELETE FROM settings WHERE tenant_id = ? AND key LIKE 'rajaongkir_cache_%'",
      args: [DEFAULT_TENANT_ID],
    });
    await setSetting(db, DEFAULT_TENANT_ID, 'rajaongkirApiKey' as any, 'test-api-key');
    // Reset global fetch mock to avoid test pollution
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('getProvinces', () => {
    it('throws when API key is not configured', async () => {
      const { RajaongkirService } = await import('../../src/services/rajaongkir.js');
      const db = getDb();
      // Clear the cache to ensure no cached data interferes
      await db.execute({
        sql: "DELETE FROM settings WHERE tenant_id = ? AND key LIKE 'rajaongkir_cache_%'",
        args: [DEFAULT_TENANT_ID],
      });
      await setSetting(db, DEFAULT_TENANT_ID, 'rajaongkirApiKey' as any, null);
      const service = new RajaongkirService({ db, tenantId: DEFAULT_TENANT_ID });

      await expect(service.getProvinces()).rejects.toThrow('Rajaongkir API key not configured');
    });

    it('returns list of provinces', async () => {
      const { RajaongkirService } = await import('../../src/services/rajaongkir.js');
      const db = getDb();
      const service = new RajaongkirService({ db, tenantId: DEFAULT_TENANT_ID });

      vi.stubGlobal('fetch', async () => ({
        ok: true,
        json: async () => ({
          rajaongkir: {
            results: [
              { province_id: '1', province: 'Bali' },
              { province_id: '2', province: 'Jawa Barat' },
            ],
          },
        }),
      }));

      const provinces = await service.getProvinces();
      expect(provinces).toHaveLength(2);
      expect(provinces[0]).toEqual({ id: '1', name: 'Bali' });
      expect(provinces[1]).toEqual({ id: '2', name: 'Jawa Barat' });
    });
  });

  describe('getCities', () => {
    it('returns cities for a province', async () => {
      const { RajaongkirService } = await import('../../src/services/rajaongkir.js');
      const db = getDb();
      const service = new RajaongkirService({ db, tenantId: DEFAULT_TENANT_ID });

      vi.stubGlobal('fetch', async () => ({
        ok: true,
        json: async () => ({
          rajaongkir: {
            results: [
              { city_id: '1', province_id: '1', type: 'Kota', city_name: 'Denpasar' },
              { city_id: '2', province_id: '1', type: 'Kabupaten', city_name: 'Badung' },
            ],
          },
        }),
      }));

      const cities = await service.getCities('1');
      expect(cities).toHaveLength(2);
      expect(cities[0]).toEqual({ id: '1', provinceId: '1', type: 'Kota', name: 'Denpasar' });
    });
  });

  describe('calculateShipping', () => {
    it('returns shipping costs', async () => {
      const { RajaongkirService } = await import('../../src/services/rajaongkir.js');
      const db = getDb();
      const service = new RajaongkirService({ db, tenantId: DEFAULT_TENANT_ID });

      vi.stubGlobal('fetch', async () => ({
        ok: true,
        json: async () => ({
          rajaongkir: {
            results: [
              {
                courier: 'JNE',
                costs: [
                  {
                    service: 'REG',
                    cost: [{ value: 15000, etd: '2-3', note: '' }],
                  },
                  {
                    service: 'OKE',
                    cost: [{ value: 10000, etd: '3-5', note: '' }],
                  },
                ],
              },
            ],
          },
        }),
      }));

      const costs = await service.calculateShipping({
        origin: '1',
        destination: '5',
        weight: 1000,
        courier: 'jne',
      });

      expect(costs).toHaveLength(2);
      expect(costs[0].courier).toBe('JNE');
      expect(costs[0].service).toBe('REG');
      expect(costs[0].cost).toBe(15000);
      expect(costs[0].etd).toBe('2-3');
    });
  });
});
