import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { RajaongkirService } from '../../../services/rajaongkir.js';

export type ShippingToolDeps = { db: Db; tenantId: string };

export function createShippingTools({ db, tenantId }: ShippingToolDeps) {
  const trackShipping = createTool({
    id: 'track-shipping',
    description:
      'Lacak pengiriman berdasarkan nomor resi dan kurir. Gunakan saat customer mau cek status pengiriman.',
    inputSchema: z.object({
      waybill: z.string().min(5).describe('Nomor resi pengiriman'),
      courier: z
        .enum(['jne', 'pos', 'tiki', 'sicepat', 'jnt', 'anteraja', 'ninja'])
        .describe('Kode kurir'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      courier: z.string(),
      waybill: z.string(),
      status: z.string(),
      events: z.array(
        z.object({
          datetime: z.string(),
          desc: z.string(),
          location: z.string(),
        }),
      ),
      message: z.string(),
    }),
    execute: async ({ waybill, courier }) => {
      try {
        const rajaongkir = new RajaongkirService({ db, tenantId });
        const result = await rajaongkir.trackShipment(waybill, courier);

        return {
          success: true,
          courier: result.courier,
          waybill: result.waybill,
          status: result.status,
          events: result.events,
          message: `Tracking ditemukan untuk resi ${waybill}`,
        };
      } catch (err) {
        return {
          success: false,
          courier,
          waybill,
          status: 'unknown',
          events: [],
          message: err instanceof Error ? err.message : 'Gagal melacak pengiriman',
        };
      }
    },
  });

  const requestShipping = createTool({
    id: 'request-shipping',
    description:
      'Minta info pengiriman. Untuk lacak pengiriman, butuh nomor resi dan kurir. Untuk cek ongkir, butuh kota asal, tujuan, dan berat.',
    inputSchema: z.object({
      action: z.enum(['track', 'cost']).describe('track = lacak pengiriman, cost = cek ongkir'),
      waybill: z.string().optional().describe('Nomor resi (untuk track)'),
      courier: z
        .enum(['jne', 'pos', 'tiki', 'sicepat', 'jnt', 'anteraja', 'ninja'])
        .optional()
        .describe('Kode kurir (untuk track atau cost)'),
      originCityId: z.string().optional().describe('ID kota asal (untuk cost)'),
      destinationCityId: z.string().optional().describe('ID kota tujuan (untuk cost)'),
      weight: z.number().int().positive().optional().describe('Berat dalam gram (untuk cost)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
      tracking: z
        .object({
          courier: z.string(),
          waybill: z.string(),
          status: z.string(),
          events: z.array(
            z.object({
              datetime: z.string(),
              desc: z.string(),
              location: z.string(),
            }),
          ),
        })
        .nullable(),
      costs: z
        .array(
          z.object({
            courier: z.string(),
            service: z.string(),
            cost: z.number().int(),
            costFormatted: z.string(),
            etd: z.string(),
          }),
        )
        .nullable(),
    }),
    execute: async ({ action, waybill, courier, originCityId, destinationCityId, weight }) => {
      const rajaongkir = new RajaongkirService({ db, tenantId });

      if (action === 'track') {
        if (!waybill || !courier) {
          return {
            success: false,
            message: 'Nomor resi dan kurir diperlukan untuk melacak pengiriman',
            tracking: null,
            costs: null,
          };
        }

        try {
          const result = await rajaongkir.trackShipment(waybill, courier);
          return {
            success: true,
            message: `Tracking ditemukan untuk resi ${waybill}`,
            tracking: {
              courier: result.courier,
              waybill: result.waybill,
              status: result.status,
              events: result.events,
            },
            costs: null,
          };
        } catch (err) {
          return {
            success: false,
            message: err instanceof Error ? err.message : 'Gagal melacak pengiriman',
            tracking: null,
            costs: null,
          };
        }
      }

      if (action === 'cost') {
        if (!originCityId || !destinationCityId || !weight) {
          return {
            success: false,
            message: 'Kota asal, kota tujuan, dan berat diperlukan untuk menghitung ongkir',
            tracking: null,
            costs: null,
          };
        }

        const couriers = courier ? [courier] : ['jne', 'pos', 'tiki'];
        const allCosts: Array<{
          courier: string;
          service: string;
          cost: number;
          costFormatted: string;
          etd: string;
        }> = [];

        for (const c of couriers) {
          try {
            const costs = await rajaongkir.calculateShipping({
              origin: originCityId,
              destination: destinationCityId,
              weight,
              courier: c,
            });

            for (const cost of costs) {
              allCosts.push({
                courier: cost.courier,
                service: cost.service,
                cost: cost.cost,
                costFormatted: `Rp ${cost.cost.toLocaleString('id-ID')}`,
                etd: cost.etd,
              });
            }
          } catch {
            // Skip failed courier
          }
        }

        if (allCosts.length === 0) {
          return {
            success: false,
            message: 'Tidak ada kurir yang tersedia untuk rute ini',
            tracking: null,
            costs: null,
          };
        }

        // Sort by cost
        allCosts.sort((a, b) => a.cost - b.cost);

        return {
          success: true,
          message: `Ditemukan ${allCosts.length} opsi pengiriman`,
          tracking: null,
          costs: allCosts,
        };
      }

      return {
        success: false,
        message: 'Action harus "track" atau "cost"',
        tracking: null,
        costs: null,
      };
    },
  });

  return { trackShipping, requestShipping };
}
