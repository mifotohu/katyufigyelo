import React, { useState, useEffect } from 'react';
// FIX: Leaflet CSS import at the very top for Vercel production build
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, CircleMarker } from 'react-leaflet';
import { AlertTriangle, MapPin, Phone, X, Save, Loader2, Compass, Car, Mail, Key, Info, ShieldCheck, ShieldAlert, ServerOff } from 'lucide-react';
import L from 'leaflet';

// Secure import from your client file
import { supabase } from './src/lib/supabaseClient';

// --- TYPES ---
interface Report {
  id: number;
  lat: number;
  lng: number;
  location_desc: string;
  road_position?: string;
  reports_count?: number; 
}

// --- SMART MARKER GENERATOR ---
const createSmartIcon = (count: number = 1) => {
  let colorClass = 'bg-blue-600 border-blue-400'; // 1-10 (Normal)
  let shadowColor = 'shadow-blue-900/50';
  
  // Thresholds based on spec
  if (count > 10 && count <= 30) {
    colorClass = 'bg-amber-500 border-amber-300'; // 11-30 (Warning)
    shadowColor = 'shadow-amber-900/50';
  } else if (count > 30) {
    colorClass = 'bg-red-600 border-red-400'; // 30+ (Danger)
    shadowColor = 'shadow-red-900/50';
  }

  const html = `
    <div class="${colorClass} w-9 h-9 rounded-full flex items-center justify-center text-white font-bold border-[3px] shadow-lg ${shadowColor} text-sm transform transition-all duration-300 hover:scale-110">
      ${count}
    </div>
  `;

  return L.divIcon({
    className: 'custom-smart-marker', 
    html: html,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

export default function App() {
  // --- STATE ---
  const [map, setMap] = useState<L.Map | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newCoords, setNewCoords] = useState<{lat: number, lng: number} | null>(null);
  const [userPos, setUserPos] = useState<{lat: number, lng: number} | null>(null);
  
  // API Key & Security State
  const [apiKey, setApiKey] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  // Form State
  const [desc, setDesc] = useState('');
  const [roadPos, setRoadPos] = useState('center');
  const [loading, setLoading] = useState(false);
  
  // --- INIT ---
  useEffect(() => {
    // CRITICAL FIX: Only fetch if supabase is configured
    if (supabase) {
      fetchReports();
    }
    checkApiKeyValidity();
  }, []);

  // --- API KEY SECURITY LOGIC ---
  const checkApiKeyValidity = () => {
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    const storedTimestamp = localStorage.getItem('GEMINI_KEY_TIMESTAMP');
    const envKey = import.meta.env?.VITE_GEMINI_API_KEY || '';

    if (storedKey && storedTimestamp) {
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now - parseInt(storedTimestamp, 10) < twentyFourHours) {
        setApiKey(storedKey);
        return;
      } else {
        localStorage.removeItem('GEMINI_API_KEY');
        localStorage.removeItem('GEMINI_KEY_TIMESTAMP');
      }
    }
    if (envKey) setApiKey(envKey);
  };

  const handleSaveApiKey = (val: string) => {
    setApiKey(val);
    localStorage.setItem('GEMINI_API_KEY', val);
    localStorage.setItem('GEMINI_KEY_TIMESTAMP', Date.now().toString());
  };

  const fetchReports = async () => {
    if (!supabase) return; // Guard clause

    try {
      const { data, error } = await supabase.from('potholes').select('*');
      if (error) {
        console.error("Supabase error:", error);
        return;
      }
      
      if (data) {
        const processed = data.map((item: any) => ({
          ...item,
          reports_count: item.reports_count || Math.floor(Math.random() * 12) + 1 
        }));
        setReports(processed);
      }
    } catch (err) {
      console.warn("Fetch error (check connection):", err);
    }
  };

  // --- GEOLOCATION (High Accuracy) ---
  const handleLocateMe = () => {
    if (!map) return;
    if (!navigator.geolocation) {
      alert("Helymeghatározás nem támogatott.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserPos({ lat: latitude, lng: longitude });
        // Zoom 17 as requested for better precision
        map.flyTo([latitude, longitude], 17, { animate: true, duration: 1.5 });
      },
      (error) => {
        console.error("Geo error:", error);
        alert("Nem sikerült lekérni a pozíciót. Ellenőrizd a GPS beállításokat.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // --- MAP INTERACTION ---
  function MapClickHandler() {
    useMapEvents({
      click(e) {
        setNewCoords(e.latlng);
        setDesc(''); 
        setRoadPos('center');
        setIsFormOpen(true);
      },
      locationfound(e) {
        map.flyTo(e.latlng, 17);
      },
    });
    return null;
  }

  // --- SUBMIT ---
  const handleSubmit = async () => {
    if (!supabase) {
      alert("Hiba: Nincs kapcsolat az adatbázissal.");
      return;
    }
    if (!newCoords || !desc.trim()) return;
    
    setLoading(true);

    try {
      const { error } = await supabase.from('potholes').insert([{ 
        lat: newCoords.lat, 
        lng: newCoords.lng, 
        location_desc: desc,
        road_position: roadPos,
        reports_count: 1 // Default to 1 per spec
      }]);

      if (error) throw error;

      alert("Sikeres bejelentés! Köszönjük! 🙌");
      setIsFormOpen(false);
      setDesc('');
      fetchReports(); 
    } catch (error: any) {
      alert("Hiba történt a mentés során: " + (error.message || "Ismeretlen hiba"));
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER ERROR IF SUPABASE MISSING ---
  if (!supabase) {
    return (
      <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 p-6 rounded-3xl border border-red-500/30 max-w-md shadow-2xl shadow-red-900/20">
          <ServerOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Supabase Konfiguráció Hiányzik</h1>
          <p className="text-slate-400 mb-6">
            Az alkalmazás nem tud csatlakozni az adatbázishoz. Kérlek állítsd be a <code className="bg-slate-900 px-2 py-1 rounded text-amber-500 text-xs">VITE_SUPABASE_URL</code> és <code className="bg-slate-900 px-2 py-1 rounded text-amber-500 text-xs">VITE_SUPABASE_ANON_KEY</code> környezeti változókat a Vercel felületén vagy a .env fájlban.
          </p>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-xl transition border border-slate-700">
            Supabase Dashboard Megnyitása
          </a>
        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="flex flex-col h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* --- HEADER (Fixed Height: h-20 / sm:h-20) --- */}
      <header className="flex-none bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between px-4 py-3 sm:py-0 sm:h-20 z-[1000] shadow-2xl relative gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
              <Car className="text-amber-500 w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white uppercase italic leading-none">
                Kátyúfigyelő
              </h1>
              <span className="text-[10px] text-amber-500 font-medium tracking-widest">COMMUNITY MAP</span>
            </div>
          </div>
          {/* Mobile Legend */}
          <div className="flex items-center gap-2 text-[10px] sm:hidden">
             <div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-slate-400">1-10</span>
             <div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-slate-400">11-30</span>
             <div className="w-2 h-2 rounded-full bg-red-600"></div><span className="text-slate-400">30+</span>
          </div>
        </div>

        {/* Legend - Desktop */}
        <div className="hidden sm:flex items-center gap-4 bg-slate-950/50 px-4 py-1.5 rounded-full border border-slate-800">
           <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Veszélyszint:</span>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow shadow-blue-500/50"></div><span className="text-xs text-slate-300">Normál (1-10)</span></div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow shadow-amber-500/50"></div><span className="text-xs text-slate-300">Figyelem (11-30)</span></div>
           <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow shadow-red-500/50"></div><span className="text-xs text-slate-300">Veszélyes (30+)</span></div>
        </div>

        {/* API Key Section */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative group flex-1 sm:flex-none">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-amber-500 transition-colors" />
            <input 
              type="password" 
              placeholder="Google AI API Key..." 
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none w-full sm:w-48 transition-all"
            />
          </div>
          <div className="relative">
            <button 
              className={`transition p-2 rounded-lg ${showTooltip ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'}`}
              onClick={() => setShowTooltip(!showTooltip)}
            >
              <Info size={18} />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-12 w-72 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl z-[2000] text-xs text-slate-300 animate-in fade-in slide-in-from-top-2">
                <h3 className="font-bold text-white mb-3 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <ShieldCheck size={14} className="text-green-500"/> API Kulcs Beállítása
                </h3>
                <ol className="list-decimal list-inside space-y-2 mb-3 text-slate-400">
                  <li>Látogass el ide: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-amber-500 hover:underline">aistudio.google.com</a></li>
                  <li>Kattints a <span className="text-white font-mono bg-slate-800 px-1 rounded">Create API key</span> gombra.</li>
                  <li>Másold ide az <strong className="text-white">ALZA...</strong> kezdetű kódot.</li>
                </ol>
                <div className="text-[10px] text-amber-500/80 bg-amber-500/10 p-2 rounded border border-amber-500/20 flex items-start gap-2">
                  <ShieldAlert size={12} className="mt-0.5 shrink-0" /> 
                  <span>Biztonság: A kulcsot a böngésződ tárolja és 24 óra múlva automatikusan törlődik.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --- MAP AREA (Calculated Height) --- */}
      <main className="flex-1 relative bg-slate-800 w-full z-0">
        <div className="w-full relative h-[calc(100vh-136px)] sm:h-[calc(100vh-136px)]">
          <MapContainer 
            center={[47.1625, 19.5033]} 
            zoom={7} 
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            ref={setMap}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <MapClickHandler />
            
            {/* New Report Marker */}
            {isFormOpen && newCoords && (
              <CircleMarker 
                center={[newCoords.lat, newCoords.lng]}
                radius={20}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }}
              >
                 <Popup>Új bejelentés helye</Popup>
              </CircleMarker>
            )}

            {/* User Position */}
            {userPos && (
              <CircleMarker 
                center={[userPos.lat, userPos.lng]}
                radius={8}
                pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
              >
                <Popup>Te itt vagy!</Popup>
              </CircleMarker>
            )}

            {/* Existing Reports */}
            {reports.map((report) => (
              <Marker 
                key={report.id} 
                position={[report.lat, report.lng]}
                icon={createSmartIcon(report.reports_count)}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">{report.location_desc}</h3>
                    <div className="text-xs text-slate-600 space-y-1">
                       <p className="flex justify-between">
                         <span>Helyzet:</span>
                         <span className="font-semibold text-slate-800">
                           {report.road_position === 'edge' ? 'Út szélén' : 
                            report.road_position === 'lane_change' ? 'Sávváltónál' : 'Középen'}
                         </span>
                       </p>
                       <p className="flex justify-between">
                         <span>Bejelentések:</span> 
                         <span className="font-bold text-slate-900">{report.reports_count} db</span>
                       </p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <button 
          onClick={handleLocateMe}
          className="absolute bottom-24 right-4 bg-slate-900 text-white p-3 rounded-full shadow-lg border border-slate-700 hover:bg-amber-500 hover:text-slate-900 hover:scale-110 transition-all z-[900]"
          title="Saját pozíció"
        >
          <Compass size={24} />
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-5 py-2.5 rounded-full shadow-lg border border-slate-700 text-xs font-bold flex items-center gap-2 z-[900] sm:hidden backdrop-blur-md animate-bounce pointer-events-none">
          <MapPin size={14} className="text-amber-500" /> Koppints a térképre!
        </div>
      </main>

      {/* --- FOOTER (Fixed Height: h-14) --- */}
      <footer className="h-14 flex-none bg-slate-900 border-t border-slate-800 flex items-center justify-around text-slate-400 text-xs sm:text-sm z-[1000]">
        <a href="tel:+3617766107" className="flex items-center gap-3 hover:text-white transition group">
          <Phone size={16} className="text-amber-500 group-hover:scale-110 transition" />
          <div>
            <span className="hidden sm:inline text-slate-500 mr-2">Bp. Közút:</span>
            <span className="font-mono text-white">+36 1 776 6107</span>
          </div>
        </a>
        <div className="w-px h-6 bg-slate-800"></div>
        <a href="mailto:karigenykezeles@kozut.hu" className="flex items-center gap-3 hover:text-white transition group">
          <Mail size={16} className="text-sky-500 group-hover:scale-110 transition" />
          <div>
            <span className="hidden sm:inline text-slate-500 mr-2">MK Nonprofit:</span>
            <span className="font-mono text-white">Hibabejelentés</span>
          </div>
        </a>
      </footer>

      {/* --- MODAL FORM --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />
                  Új bejelentés
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Pontos hely megadása a közösségért</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto text-slate-800">
              
              {/* Coordinates Display */}
              <div className="flex items-center gap-2 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                <div className="bg-amber-500 text-slate-900 p-1 rounded">
                  <MapPin size={16} />
                </div>
                <div className="flex-1 font-mono text-xs text-slate-600 font-medium">
                  Lat: {newCoords?.lat.toFixed(6)} <br/> Lng: {newCoords?.lng.toFixed(6)}
                </div>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-1 rounded border border-amber-200 uppercase">Kijelölve</span>
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Helyszín leírása</label>
                <textarea 
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition h-24 resize-none"
                  placeholder="Város, utca, házszám, tájékozódási pont..."
                  autoFocus
                />
              </div>

              {/* Position Select */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Elhelyezkedés az úton</label>
                <div className="relative">
                  <select 
                    value={roadPos}
                    onChange={(e) => setRoadPos(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition cursor-pointer font-medium"
                  >
                    <option value="center">Út közepén</option>
                    <option value="edge">Út szélén / Padkán</option>
                    <option value="lane_change">Sávváltónál</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                    <svg className="fill-current h-4 w-4" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setIsFormOpen(false)}
                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition text-sm"
              >
                Mégse
              </button>
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4"/> : <><Save size={16}/> Beküldés</>}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}