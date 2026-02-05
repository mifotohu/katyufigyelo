import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertTriangle, Car, ShieldAlert, Phone, Plus, X, Save, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './src/lib/supabaseClient';

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

  const fetchReports = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('potholes').select('*').order('reports_count', { ascending: false });
    if (!error && data) setReports(data);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    if (map) { setTimeout(() => { map.invalidateSize(); }, 400); }
  }, [map, isFormOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !supabase) return;
    setLoading(true);

    try {
      // Normalizáljuk a címet: kisbetűssé tesszük a biztos egyezés érdekében
      const rawAddress = `${city}, ${address.trim()}`;
      const fullAddress = rawAddress.charAt(0).toUpperCase() + rawAddress.slice(1); // Szép formázás
      
      // 1. ELLENŐRZÉS: Kis- és nagybetű független keresés (ILIKE)
      // A .limit(1) biztosítja, hogy ne kapjunk hibát, ha már vannak duplikációk
      const { data: existingReports, error: findError } = await supabase
        .from('potholes')
        .select('id, reports_count')
        .ilike('location_desc', fullAddress) 
        .limit(1);

      if (findError) throw findError;

      const existing = existingReports && existingReports.length > 0 ? existingReports[0] : null;

      if (existing) {
        // 2/A. UPDATE: Meglévő sor frissítése
        const { error: updateError } = await supabase
          .from('potholes')
          .update({ reports_count: (existing.reports_count || 1) + 1 })
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
        alert(`Sikeresen frissítve! Ez már a(z) ${existing.reports_count + 1}. bejelentés erre a helyre.`);

      } else {
        // 2/B. INSERT: Új koordináták és új sor
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
        const geoData = await geoRes.json();

        if (!geoData || geoData.length === 0) {
          alert("A címet nem sikerült beazonosítani a térképen!");
          setLoading(false);
          return;
        }

        const { error: insertError } = await supabase.from('potholes').insert([{ 
          lat: parseFloat(geoData[0].lat), 
          lng: parseFloat(geoData[0].lon), 
          location_desc: fullAddress,
          road_position: roadPos,
          reports_count: 1 
        }]);

        if (insertError) throw insertError;
        alert("Új kátyú sikeresen rögzítve!");
      }

      setIsFormOpen(false);
      setAddress('');
      await fetchReports();

    } catch (err: any) {
      alert("Adatbázis hiba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 overflow-hidden font-sans">
      <header className="h-16 flex-none bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[1000] shadow-xl">
        <div className="flex items-center gap-2 text-white">
          <AlertTriangle className="text-amber-500 w-6 h-6" />
          <h1 className="text-lg font-black italic uppercase tracking-tighter">Kátyúfigyelő V2.1</h1>
        </div>
      </header>

      <main className="flex-1 relative bg-slate-800 w-full overflow-hidden">
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
                <div className="text-slate-900 p-2 min-w-[180px]">
                  <p className="font-bold text-sm border-b pb-1 mb-1">{r.location_desc}</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Státusz:</span>
                    <span className="text-xs font-black text-red-600">{r.reports_count} BEJELENTÉS</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <button 
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-6 right-6 bg-amber-500 text-slate-900 font-black px-6 py-4 rounded-2xl shadow-2xl z-[900] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all uppercase italic border-2 border-white/20"
        >
          <Plus size={20} /> Új bejelentés
        </button>
      </main>

      <footer className="h-12 flex-none bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-500 font-bold uppercase z-[1000]">
        <div className="flex items-center gap-1"><Phone size={12} className="text-amber-500"/> 06-1-819-9000</div>
        <div className="flex items-center gap-1"><ShieldAlert size={12} className="text-red-600"/> 112</div>
      </footer>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black italic uppercase tracking-tighter">Adatok megadása</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <input 
                type="text" 
                placeholder="Település" 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none border-2 border-transparent focus:border-amber-500 transition"
              />
              <input 
                type="text" 
                placeholder="Utca, házszám" 
                required
                value={address} 
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none border-2 border-transparent focus:border-amber-500 transition"
              />
              <select 
                value={roadPos} 
                onChange={(e) => setRoadPos(e.target.value)}
                className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none border-2 border-transparent focus:border-amber-500 transition"
              >
                <option value="center">Út közepén</option>
                <option value="edge">Út szélén</option>
                <option value="lane_change">Sávváltónál</option>
              </select>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 uppercase italic text-lg"
              >
                {loading ? <Loader2 className="animate-spin text-amber-500" /> : <Save size={20}/>} 
                {loading ? 'Folyamatban...' : 'Beküldés'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}