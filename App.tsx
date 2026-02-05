import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertTriangle, Car, ShieldAlert, Phone, Plus, X, Save, Loader2, MapPin } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './src/lib/supabaseClient';

// --- LEAFLET CSS & IKON FIXES ---
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

  // Adatok lekérése az adatbázisból
  const fetchReports = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('potholes').select('*');
    if (!error && data) setReports(data);
  }, []);

  useEffect(() => { 
    fetchReports(); 
  }, [fetchReports]);

  // --- TÉRKÉP MEGJELENÍTÉS FIX (Vercel/Mobil/PC) ---
  // Kényszerítjük a térképet a méret újraszámolására, hogy ne legyen szürke
  useEffect(() => {
    if (map) {
      setTimeout(() => { map.invalidateSize(); }, 400);
    }
  }, [map, isFormOpen]);

  // --- BEKÜLDÉSI LOGIKA (OKOS SZÁMLÁLÓVAL) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !supabase) return;
    setLoading(true);

    try {
      const fullAddress = `${city}, ${address.trim()}`;
      
      // 1. ELLENŐRZÉS: Van-e már ilyen pontos cím az adatbázisban?
      const { data: existing, error: findError } = await supabase
        .from('potholes')
        .select('id, reports_count')
        .eq('location_desc', fullAddress)
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        // 2/A. HA LÉTEZIK: Csak a számlálót növeljük meg eggyel
        const { error: updateError } = await supabase
          .from('potholes')
          .update({ reports_count: (existing.reports_count || 1) + 1 })
          .eq('id', existing.id);
        
        if (updateError) throw updateError;
        alert("Újabb bejelentés rögzítve ehhez a kátyúhoz! 📈");

      } else {
        // 2/B. HA NEM LÉTEZIK: Koordináták lekérése és új sor beszúrása
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
        const geoData = await geoRes.json();

        if (!geoData || geoData.length === 0) {
          alert("Ezt a címet nem találom a térképen! Ellenőrizd az utca nevét.");
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
        alert("Sikeresen rögzítettük az új kátyút! ⚠️");
      }

      // 3. LEZÁRÁS: Ablak becsukása és térkép frissítése
      setIsFormOpen(false);
      setAddress('');
      await fetchReports();

    } catch (err: any) {
      alert("Hiba történt: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 overflow-hidden font-sans">
      {/* HEADER */}
      <header className="h-16 flex-none bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[1000] shadow-xl">
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-amber-500 w-6 h-6" />
          <h1 className="text-lg font-black italic uppercase text-white tracking-tighter">Kátyúfigyelő <span className="text-amber-500">v2.1</span></h1>
        </div>
      </header>

      {/* TÉRKÉP - FLEX-GROW KÉNYSZERÍTÉSSEL */}
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
                <div className="text-slate-900 p-1 min-w-[150px]">
                  <p className="font-bold border-b border-slate-200 pb-1 mb-1">{r.location_desc}</p>
                  <p className="text-red-600 font-black text-sm">{r.reports_count} Bejelentés</p>
                  <p className="text-[10px] text-slate-500 mt-1 uppercase">Helyzet: {r.road_position === 'edge' ? 'Út széle' : 'Középen'}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* ÚJ BEJELENTÉS GOMB */}
        <button 
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-6 right-6 bg-amber-500 text-slate-900 font-black px-6 py-4 rounded-2xl shadow-2xl z-[900] flex items-center gap-2 hover:scale-105 active:scale-95 transition-all uppercase italic border-2 border-slate-900/10"
        >
          <Plus size={20} /> Új bejelentés
        </button>
      </main>

      {/* FOOTER */}
      <footer className="h-12 flex-none bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-500 font-bold uppercase z-[1000]">
        <div className="flex items-center gap-1"><Phone size={12} className="text-amber-500"/> 06-1-819-9000</div>
        <div className="flex items-center gap-1"><ShieldAlert size={12} className="text-red-600"/> 112</div>
      </footer>

      {/* BEJELENTŐ MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black italic uppercase tracking-tighter">Bejelentés</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Település</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none border-2 border-transparent focus:border-amber-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Utca, házszám</label>
                <input 
                  type="text" 
                  placeholder="Pl: Váci út 120"
                  required
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none border-2 border-transparent focus:border-amber-500 transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Kátyú helyzete</label>
                <select 
                  value={roadPos} 
                  onChange={(e) => setRoadPos(e.target.value)}
                  className="w-full bg-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none border-2 border-transparent focus:border-amber-500 transition cursor-pointer"
                >
                  <option value="center">Út közepén</option>
                  <option value="edge">Út szélén</option>
                  <option value="lane_change">Sávváltónál</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-slate-800 transition active:scale-95 disabled:opacity-50 uppercase italic text-lg"
              >
                {loading ? <Loader2 className="animate-spin text-amber-500" /> : <><Save size={20}/> Beküldés</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}