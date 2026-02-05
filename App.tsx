import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertTriangle, MapPin, Phone, X, Save, Loader2, Compass, Car, ShieldAlert, Plus } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './src/lib/supabaseClient';

// --- LEAFLET FIXES ---
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
  
  // Form states
  const [city, setCity] = useState('Budapest');
  const [address, setAddress] = useState('');
  const [roadPos, setRoadPos] = useState('center');

  const fetchReports = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('potholes').select('*');
    if (data) setReports(data);
  };

  useEffect(() => { fetchReports(); }, []);

  // --- PROFI GEOCODING FÜGGVÉNY ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !supabase) return;
    setLoading(true);

    try {
      // 1. Koordináták lekérése a cím alapján (Nominatim)
      const query = `${city}, ${address}`;
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        alert("Sajnos nem találtuk meg ezt a címet a térképen. Ellenőrizd az utca nevét!");
        setLoading(false);
        return;
      }

      const lat = parseFloat(geoData[0].lat);
      const lng = parseFloat(geoData[0].lon);

      // 2. Mentés a Supabase-be
      const { error } = await supabase.from('potholes').insert([{ 
        lat, 
        lng, 
        location_desc: `${city}, ${address}`,
        road_position: roadPos,
        reports_count: 1 
      }]);

      if (error) throw error;

      // 3. Siker! Térkép frissítése és ugrás az új kátyúhoz
      setIsFormOpen(false);
      setAddress('');
      await fetchReports();
      map?.flyTo([lat, lng], 16);
      alert("Bejelentés sikeresen rögzítve a megadott címen!");

    } catch (err: any) {
      alert("Hiba történt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!supabase) return <div className="h-screen bg-slate-950 flex items-center justify-center text-red-500 font-bold italic">SUPABASE CONFIG MISSING!</div>;

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden font-sans">
      
      {/* HEADER */}
      <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[1000] shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-500/20">
            <Car className="text-slate-900 w-6 h-6" />
          </div>
          <h1 className="text-xl font-black italic uppercase tracking-tighter text-white">Kátyúfigyelő <span className="text-amber-500">v2.0</span></h1>
        </div>
      </header>

      {/* MAP AREA */}
      <main className="flex-1 relative w-full overflow-hidden">
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
                <div className="p-1 font-sans">
                  <p className="font-bold text-slate-900 border-b mb-1">{r.location_desc}</p>
                  <p className="text-xs text-red-600 font-bold uppercase tracking-widest">{r.reports_count} Bejelentés</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ÚJ BEJELENTÉS GOMB (FIXED) */}
        <button 
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-8 right-8 bg-amber-500 text-slate-900 font-black px-8 py-4 rounded-2xl shadow-2xl z-[900] flex items-center gap-3 hover:scale-105 active:scale-95 transition-all uppercase tracking-tighter italic border-4 border-slate-900/10"
        >
          <Plus size={24} strokeWidth={4} /> Új Kátyú Jelentése
        </button>
      </main>

      {/* FOOTER */}
      <footer className="h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-500 z-[1000] uppercase font-bold tracking-widest">
        <div className="flex items-center gap-2"><Phone size={14} className="text-amber-500"/> 06-1-819-9000</div>
        <div className="flex items-center gap-2"><ShieldAlert size={14} className="text-red-600"/> Segélyhívó: 112</div>
      </footer>

      {/* MODAL FORM (CÍM ALAPÚ) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Bejelentés címe</h2>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">A program automatikusan elhelyezi a jelölőt</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-white transition"><X size={28}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Település</label>
                  <input 
                    type="text" 
                    value={city} 
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-slate-100 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-amber-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Út helyzete</label>
                  <select 
                    value={roadPos} 
                    onChange={(e) => setRoadPos(e.target.value)}
                    className="w-full bg-slate-100 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-amber-500 outline-none transition cursor-pointer"
                  >
                    <option value="center">Középen</option>
                    <option value="edge">Út szélén</option>
                    <option value="lane_change">Sávváltónál</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Utca, házszám (vagy km szelvény)</label>
                <input 
                  type="text" 
                  required
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Pl: Váci út 120"
                  className="w-full bg-slate-100 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:border-amber-500 outline-none transition"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 uppercase italic tracking-tighter text-lg"
              >
                {loading ? <Loader2 className="animate-spin" /> : <><Save size={20}/> Bejelentés rögzítése</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}