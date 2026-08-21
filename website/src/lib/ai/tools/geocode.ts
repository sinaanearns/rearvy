
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../types';
import { createServerLogger } from '@/lib/server-logger';

const log = createServerLogger('GeocodeTool');

// Simple in-memory cache for geocoding results
const geocodeCache = new Map<string, { timestamp: number; result: GeocodeOutput }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests to be nice to Nominatim
let lastRequestTime = 0;

const geocodeInputSchema = z.object({
  query: z.string().min(1).describe('The location query to geocode'),
});

const geocodeOutputSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  display_name: z.string(),
});

export type GeocodeInput = z.infer<typeof geocodeInputSchema>;
export type GeocodeOutput = z.infer<typeof geocodeOutputSchema>;

export function geocode(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      'Geocode a location query using OpenStreetMap Nominatim API to get latitude and longitude.',
    inputSchema: geocodeInputSchema,
    execute: async (input) => {
      const { query } = input;

      // Check cache first
      const cached = geocodeCache.get(query);
      const now = Date.now();
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.result;
      }

      // Rate limiting: ensure we don't make requests too frequently
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          {
            headers: {
              'User-Agent': 'Rearvy/1.0 (https://rearvy.com)',
            },
          }
        );

        lastRequestTime = Date.now();

        if (!response.ok) {
          throw new Error(`Nominatim request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
          throw new Error('No results found for the query');
        }

        const result = data[0];

        const latitude = parseFloat(result.lat);
        const longitude = parseFloat(result.lon);
        const display_name = result.display_name;

        if (isNaN(latitude) || isNaN(longitude)) {
          throw new Error('Invalid coordinates received from Nominatim');
        }

        const output = geocodeOutputSchema.parse({
          latitude,
          longitude,
          display_name,
        });

        // Cache the result
        geocodeCache.set(query, { timestamp: now, result: output });

        return output;
      } catch (error) {
        log.error('Geocoding error:', error);
        throw error;
      }
    },
  });
}

