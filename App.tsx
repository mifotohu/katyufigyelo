import React, { useState, useEffect } from 'react';
// CSS IMPORT MUST BE FIRST
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { AlertTriangle, MapPin, Phone, X, Save, Loader2, Compass, Car, ShieldAlert, Plus, Info } from 'lucide-react';
import L from 'leaflet';
import { supabase } from './src/lib/supabaseClient';

// --- CUSTOM MARKER GENERATOR ---
const createSmartIcon = (count: number = 1) => {
  let colorClass = 'bg-blue-600 border-blue-400'; // 1-10 (Normal)
  let shadowColor = 'shadow-blue-900/50';
  
  if (count > 10 && count <= 40) {
    colorClass = 'bg-amber-500 border-amber-300'; // 11-40 (Warning)
    shadowColor = 'shadow-amber-900/50';
  } else if (count > 40) {
    colorClass = 'bg-red-600 border-red-400'; // 40+ (Danger)
    shadowColor = 'shadow-red-900/50';
  }

  const html = `
    <div class="${colorClass} w-10 h-10 rounded-full flex items-center justify-center text-white font-black border-[3px] shadow-xl ${shadowColor} text-sm transform transition-all hover:scale-110">
      ${count}
    </div>
  `;

  return L.divIcon({
    className: 'custom-smart-marker', // No default Leaflet styles
    html: html,
    iconSize: [40, 40],
    iconAnchor: [20, 20], // Center anchor
    popupAnchor: [0, -24]
  });
};

export default function App() {
  const [map, setMap] = useState<L.Map | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userPos, setUserPos] = useState<{lat: number, lng: number} | null>(null);
  
  // Form states
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('Budapest');
  const [address, setAddress] = useState('');
  const [roadPos, setRoadPos] = useState('center');

  const fetchReports = async () => {
    if (!supabase) return;
    try {
      const { data } = await supabase.from('potholes').select('*');
      if (data) {
        // Mocking report counts for demo purposes if not in DB, 
        // normally this comes from DB aggregation or a raw field
        const processed = data.map(item => ({
          ...item,
          reports_count: item.reports_count || Math.floor(Math.random() * 50) + 1 
        }));
        setReports(processed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  // --- GPS ---
  const handleLocateMe = () => {
    if (!map) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
        map.flyTo([latitude, longitude], 17);
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !city || !supabase) return;
    setLoading(true);

    try {
      // 1. Geocoding
      const query = `${zipCode ? zipCode + ' ' : ''}${city}, ${address}`;
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const geoData = await geoRes.json();

      if (!geoData || geoData.length === 0) {
        alert("Nem találtuk a címet. Ellenőrizd az adatokat!");
        setLoading(false);
        return;
      }

      const lat = parseFloat(geoData[0].lat);
      const lng = parseFloat(geoData[0].lon);

      // 2. Insert
      const { error } = await supabase.from('potholes').insert([{ 
        lat, 
        lng, 
        location_desc: `${zipCode ? zipCode + ' ' : ''}${city}, ${address}`,
        road_position: roadPos,
        reports_count: 1 // Start with 1
      }]);

      if (error) throw error;

      setIsFormOpen(false);
      setAddress('');
      setZipCode('');
      await fetchReports();
      map?.flyTo([lat, lng], 16);
      alert("Sikeres bejelentés!");

    } catch (err: any) {
      alert("Hiba: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!supabase) return <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 text-center"><ShieldAlert size={48} className="text-red-500 mb-4"/><h1 className="text-2xl font-bold">Adatbázis hiba</h1><p className="text-slate-400">Ellenőrizd a .env fájlt!</p></div>;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 font-sans overflow-hidden text-slate-100">
      
      {/* HEADER */}
      <header className="flex-none h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 z-[1000] shadow-2xl relative">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
            <Car className="text-amber-500 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black italic uppercase tracking-tighter text-white leading-none">
              Kátyúfigyelő
            </h1>
            <span className="text-[10px] text-amber-500 font-bold tracking-widest uppercase">Community Map</span>
          </div>
        </div>

        {/* Legend (Desktop) */}
        <div className="hidden sm:flex items-center gap-4 bg-slate-950/50 px-4 py-2 rounded-full border border-slate-800">
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600"></div><span className="text-xs font-bold text-slate-400">1-10</span></div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div><span className="text-xs font-bold text-slate-400">11-40</span></div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div><span className="text-xs font-bold text-slate-400">40+</span></div>
        </div>
      </header>

      {/* MAP WRAPPER - CRITICAL FOR LAYOUT */}
      <main className="flex-1 relative w-full bg-slate-800">
        {/* ABSOLUTE INSET-0 ENSURES FULL FILL */}
        <div className="absolute inset-0 w-full h-full z-0">
          <MapContainer 
            center={[47.1625, 19.5033]} // Hungary Center
            zoom={7} 
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            ref={setMap}
            zoomControl={false} // Custom zoom maybe later, cleaner look for now
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {userPos && (
              <CircleMarker center={[userPos.lat, userPos.lng]} radius={8} pathOptions={{color: 'white', fillColor: '#3b82f6', fillOpacity: 1}} />
            )}

            {reports.map((r: any) => (
              <Marker 
                key={r.id} 
                position={[r.lat, r.lng]}
                icon={createSmartIcon(r.reports_count)}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">{r.location_desc}</h3>
                    <div className="flex justify-between items-center text-xs mt-2">
                       <span className="text-slate-500">Bejelentések:</span>
                       <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{r.reports_count}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* GPS Button */}
        <button 
          onClick={handleLocateMe}
          className="absolute bottom-28 right-6 bg-slate-900 text-white p-3 rounded-full shadow-xl border border-slate-700 hover:bg-slate-800 transition z-[900]"
        >
          <Compass size={24} />
        </button>

        {/* FAB - New Report */}
        <button 
          onClick={() => setIsFormOpen(true)}
          className="absolute bottom-8 right-6 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black px-6 py-4 rounded-2xl shadow-2xl shadow-amber-900/40 z-[900] flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 uppercase italic tracking-tighter"
        >
          <Plus size={24} strokeWidth={3} /> ÚJ BEJELENTÉS
        </button>
      </main>

      {/* FOOTER */}
      <footer className="flex-none h-14 bg-slate-900 border-t border-slate-800 flex items-center justify-around text-[10px] text-slate-500 z-[1000] font-bold uppercase tracking-widest">
        <span>© 2024 Kátyúfigyelő</span>
        <div className="flex gap-4">
            <span className="text-amber-500">Help</span>
            <span className="text-slate-300">Privacy</span>
        </div>
      </footer>

      {/* MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-black italic uppercase text-white tracking-tighter flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" /> Új Kátyú
                </h2>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest mt-1 uppercase">A közösség érdekében</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-white transition bg-slate-800 p-2 rounded-full"><X size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto bg-slate-50 text-slate-800">
              
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Irányítószám</label>
                  <input 
                    type="text" 
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="pl. 1134"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                  />
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Település</label>
                   <input 
                    type="text" 
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                   />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Cím (Utca, Házszám)</label>
                <input 
                  type="text" 
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Váci út 12/B"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Elhelyezkedés</label>
                <select 
                  value={roadPos}
                  onChange={(e) => setRoadPos(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition cursor-pointer"
                >
                  <option value="center">Út közepén</option>
                  <option value="edge">Út szélén / Padkán</option>
                  <option value="lane_change">Sávváltónál</option>
                </select>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black py-4 rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 uppercase italic tracking-tighter disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <><Save size={20} strokeWidth={2.5}/> Beküldöm</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}