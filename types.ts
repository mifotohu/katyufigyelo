export interface PotholeReport {
  id: string;
  lat: number;
  lng: number;
  location_name: string; // e.g., "Budapest, Váci út"
  zip_code?: string;
  road_position: 'edge' | 'center' | 'lane_change';
  severity_count: number; // Number of people who reported this
  created_at: string;
  image_url?: string;
}

export enum RoadPosition {
  EDGE = 'edge',
  CENTER = 'center',
  LANE_CHANGE = 'lane_change',
}

export const RoadPositionLabels: Record<RoadPosition, string> = {
  [RoadPosition.EDGE]: 'Út szélén',
  [RoadPosition.CENTER]: 'Út közepén',
  [RoadPosition.LANE_CHANGE]: 'Sávváltónál',
};

export interface NewReportFormData {
  lat: number;
  lng: number;
  location_name: string;
  zip_code: string;
  road_position: RoadPosition;
  image_file: File | null;
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_GEMINI_API_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  namespace google {
    namespace maps {
      class Map {
        constructor(mapDiv: HTMLElement | null, opts?: MapOptions);
        addListener(eventName: string, handler: (e: MapMouseEvent) => void): void;
      }
      class Marker {
        constructor(opts?: MarkerOptions);
        setMap(map: Map | null): void;
        addListener(eventName: string, handler: (e: any) => void): void;
      }
      class InfoWindow {
        constructor(opts?: InfoWindowOptions);
        open(opts?: InfoWindowOpenOptions): void;
      }
      interface MapMouseEvent {
        latLng: {
          lat(): number;
          lng(): number;
        } | null;
      }
      interface MapsLibrary {
        Map: typeof Map;
      }
      interface MarkerLibrary {
        Marker: typeof Marker;
      }
      interface MapOptions {
        center?: LatLngLiteral;
        zoom?: number;
        mapId?: string;
        streetViewControl?: boolean;
        mapTypeControl?: boolean;
        fullscreenControl?: boolean;
        styles?: any[];
      }
      interface MarkerOptions {
        position: LatLngLiteral;
        map: Map;
        title?: string;
        icon?: string;
      }
      interface InfoWindowOptions {
        content: string;
      }
      interface InfoWindowOpenOptions {
        anchor: Marker;
        map: Map;
      }
      interface LatLngLiteral {
        lat: number;
        lng: number;
      }
    }
  }
}