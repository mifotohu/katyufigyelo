import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertTriangle, Car, ShieldAlert, Phone, Plus, X, Save, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './src/lib/supabaseClient';

// --- LEAFLET CSS & ICON FIXES ---
import 'leaflet/dist/leaflet.css';
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
  const [loading, setLoading] = useState(false);
  
  const [city, setCity] = useState('Budapest');
  const [address, setAddress] = useState('');
  const [roadPos, setRoadPos] = useState('center');

  // Adatok lekérése
  const fetchReports = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('potholes').select('*');
    if (data) setReports(data);
  }, []);

  useEffect(() => { 
    fetchReports(); 
  }, [fetchReports]);

  // --- MAP RENDER FIX ---
  // Amint a térkép példány létrejön, kényszerítjük a méret újraszámolását
  useEffect(() => {
    if (map) {
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }
  }, [map, isFormOpen]);

  // --- BEKÜLDÉSI LOGIKA (UPSERT) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !supabase) return;
    setLoading(true);

    try {
      const fullAddress = `${city}, ${address}`;
      
      // 1. Megnézzük, van-e már ilyen bejelentés
      const { data: existing } = await supabase
        .from('potholes')
        .select('*')
        .eq('location_desc', fullAddress)
        .maybeSingle();

      if (existing) {
        // UPDATE: Növeljük a számlálót
        const { error: upError } = await supabase
          .from('potholes')
          .update({ reports_count: (existing.reports_count || 1) + 1 })
          .eq('id', existing.id);
        
        if (upError) throw upError;
      } else {
        // INSERT: Új koordináták lekérése
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
        const geoData = await geoRes.json();

        if (!geoData || geoData.length === 0) {
          alert("A címet nem sikerült beazonosítani!");
          setLoading(false);
          return;
        }

        const { error: insError } = await supabase.from('potholes').insert([{ 
          lat: parseFloat(geoData[0].lat), 
          lng: parseFloat(geoData[0].lon), 
          location_desc: fullAddress,
          road_position: roadPos,
          reports_count: 1 
        }]);

        if (insError) throw insError;
      }

      setIsFormOpen(false);
      setAddress('');
      await fetchReports();
      alert("Bejelentés sikeresen rögzítve!");

    } catch (err: any) {
      alert("Hiba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 overflow-hidden">
      {/* Fejléc */}
      <header className="h-20 flex-none bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[1000]">
        <div className="flex items-center gap-3">
          <Car className="text-amber-500 w-8 h-8" />
          <h1 className="text-xl font-black italic uppercase text-white">Kátyúfigyelő <span className="text-amber-500">v2.1</span></h1>
        </div>
      </header>

      {/* Térkép terület */}
      <main className="flex-1 relative bg-slate-800">
        <MapContainer 
          center={[47.1625, 19.5033]} 
          zoom={7} 
          style={{ height: "100%", width: "100%" }}
          ref={setMap}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {reports.map((r: any) => (
            <Marker key={r.id} position={[r.lat, r.lng]}>
              <Popup>
                <div className="text-slate-900 font-sans p-1">
                  <p className="font-bold border-b mb-1">{r.location_desc}</p>
                  <p className="text-red-600 font-black">{r.reports_count} Bejelentés</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <button 
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-8 right-8 bg-amber-500 text-slate-900 font-black px-6 py-4 rounded-2xl shadow-2xl z-[900] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all uppercase italic"
        >
          <Plus /> Új bejelentés
        </button>
      </main>

      {/* Lábléc */}
      <footer className="h-14 flex-none bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-500 uppercase tracking-widest font-bold z-[1000]">
        <div className="flex items-center gap-2"><Phone className="text-amber-500" size={14}/> 06-1-819-9000</div>
        <div className="flex items-center gap-2"><ShieldAlert className="text-red-600" size={14}/> Segélyhívó: 112</div>
      </footer>

      {/* Bejelentő Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-6 flex justify-between items-center">
              <h2 className="text-xl font-black italic text-white uppercase italic">Bejelentés</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-500"><X /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <input 
                type="text" 
                placeholder="Település" 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold focus:border-amber-500 outline-none border-2 border-transparent"
              />
              <input 
                type="text" 
                placeholder="Utca, házszám" 
                required
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold focus:border-amber-500 outline-none border-2 border-transparent"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 uppercase italic"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> Beküldés</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}