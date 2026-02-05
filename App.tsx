import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { AlertTriangle, MapPin, Phone, X, Save, Loader2, Compass, Car, Mail, Key, Info, ShieldCheck, ShieldAlert } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './src/lib/supabaseClient';

// --- LEAFLET CSS FIX (CDN fallback) ---
import 'leaflet/dist/leaflet.css';

// Ikon fix produkciós környezethez
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function App() {
  const [map, setMap] = useState<L.Map | null>(null);
  const [reports, setReports] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newCoords, setNewCoords] = useState<{lat: number, lng: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');

  // --- ADATOK LEKÉRÉSE (Hibakezeléssel) ---
  const fetchReports = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('potholes').select('*');
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // --- GPS PONTOSSÁG FIX ---
  const handleLocateMe = () => {
    if (!map) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 18, { animate: true, duration: 2 });
      },
      (error) => alert("GPS hiba: " + error.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // <-- Ez a lényeg!
    );
  };

  function MapEvents() {
    useMapEvents({
      click(e) {
        setNewCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        setIsFormOpen(true);
      },
    });
    return null;
  }

  const handleSubmit = async () => {
    if (!newCoords || !supabase) return;
    setLoading(true);
    const desc = (document.getElementById('desc-input') as HTMLTextAreaElement).value;
    
    const { error } = await supabase.from('potholes').insert([{ 
      lat: newCoords.lat, 
      lng: newCoords.lng, 
      location_desc: desc,
      reports_count: 1 
    }]);

    setLoading(false);
    if (error) alert("Hiba: " + error.message);
    else {
      setIsFormOpen(false);
      fetchReports();
    }
  };

  // --- HA NINCS SUPABASE (Vercel Env hiba banner) ---
  if (!supabase) {
    return (
      <div className="h-screen w-full bg-slate-900 flex items-center justify-center p-10 text-center">
        <div className="bg-red-500/10 border border-red-500 p-6 rounded-2xl">
          <ShieldAlert className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-white font-bold text-xl mb-2">Missing Environment Variables!</h2>
          <p className="text-slate-400 text-sm">Vercel Settings -> Environment Variables -> Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden">
      <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[1000]">
        <h1 className="text-amber-500 font-black italic uppercase tracking-tighter text-xl flex items-center gap-2">
          <Car /> Kátyúfigyelő
        </h1>
        <div className="flex gap-2">
            <input 
              type="password" 
              placeholder="API Key" 
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                localStorage.setItem('GEMINI_API_KEY', e.target.value);
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-xs w-32 focus:ring-1 focus:ring-amber-500 outline-none"
            />
        </div>
      </header>

      <main className="flex-1 relative w-full">
        <MapContainer 
          center={[47.1625, 19.5033]} 
          zoom={7} 
          style={{ height: "100%", width: "100%" }}
          ref={setMap}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapEvents />
          {reports.map((r: any) => (
            <Marker key={r.id} position={[r.lat, r.lng]}>
              <Popup>
                <div className="text-slate-900 font-sans">
                  <p className="font-bold border-b mb-1">{r.location_desc}</p>
                  <p className="text-red-600 font-bold">{r.reports_count} bejelentés</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <button 
          onClick={handleLocateMe}
          className="absolute bottom-20 right-6 bg-slate-900 text-white p-4 rounded-full shadow-2xl border border-slate-700 z-[900] hover:bg-amber-500 transition-colors"
        >
          <Compass size={24} />
        </button>
      </main>

      <footer className="h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-500 z-[1000]">
        <div className="flex items-center gap-1"><Phone size={14} className="text-amber-500"/> 06-1-819-9000</div>
        <div className="flex items-center gap-1"><ShieldAlert size={14} className="text-red-500"/> 112</div>
      </footer>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-slate-900">
            <div className="bg-amber-500 p-5 text-white font-bold flex justify-between items-center">
              <span>ÚJ BEJELENTÉS</span>
              <button onClick={() => setIsFormOpen(false)}><X /></button>
            </div>
            <div className="p-6 space-y-4">
              <textarea id="desc-input" className="w-full border-2 border-slate-100 rounded-2xl p-4 h-32 outline-none focus:border-amber-500" placeholder="Pontos helyszín..."></textarea>
              <button 
                onClick={handleSubmit} 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Save size={18}/> Beküldöm</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}