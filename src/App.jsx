

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  ChefHat, 
  Leaf, 
  Scale, 
  Clock, 
  Info, 
  Plus, 
  Trash2, 
  Utensils, 
  Brain, 
  Sparkles,
  ChevronRight,
  Target,
  X,
  Activity,
  User,
  Zap,
  Coffee,
  Sun,
  Cookie,
  Moon,
  Heart,
  Calendar,
  TrendingUp,
  MessageSquare,
  ShoppingCart,
  Send,
  Dumbbell
} from 'lucide-react';

// API Configuration
const apiKey = import.meta.env.VITE_GEMINI_API_KEY; 

const App = () => {
  // --- Profile State ---
  const [profile, setProfile] = useState({
    weight: 70,
    targetWeight: 68,
    gender: 'male',
    age: 30,
    height: 175,
    activityLevel: 'sedentary' 
  });

  // --- Food State ---
  const [ingredients, setIngredients] = useState([]);
  const [inputIngredient, setInputIngredient] = useState("");
  const [restrictions, setRestrictions] = useState("");
  
  // --- Result State ---
  const [dailyPlan, setDailyPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);

  // --- Gemini API Features State ---
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', text: '¡Hola! Soy tu coach VitalIA. He actualizado mis algoritmos para considerar tu nivel de actividad física en cada receta. ¿En qué puedo ayudarte?' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [shoppingList, setShoppingList] = useState(null);
  const [pantryAnalysis, setPantryAnalysis] = useState("");

  // --- REFINED Nutritional & Activity Math ---
  const calculateKcal = () => {
    // 1. Harris-Benedict Equation for BMR
    let bmr;
    if (profile.gender === 'male') {
      bmr = 88.36 + (13.4 * Number(profile.weight)) + (4.8 * Number(profile.height)) - (5.7 * Number(profile.age));
    } else {
      bmr = 447.59 + (9.2 * Number(profile.weight)) + (3.1 * Number(profile.height)) - (4.3 * Number(profile.age));
    }

    // 2. Activity Multipliers (Standard TDEE factors)
    const activityMultipliers = {
      sedentary: 1.2,      // Little or no exercise
      light: 1.375,        // Light exercise 1-3 days/week
      moderate: 1.55,      // Moderate exercise 3-5 days/week
      intense: 1.725       // Hard exercise 6-7 days/week
    };

    const multiplier = activityMultipliers[profile.activityLevel] || 1.2;
    const tdee = bmr * multiplier; // Total Daily Energy Expenditure
    
    // 3. Goal Adjustment
    // To lose weight safely: TDEE - 500 kcal
    // To gain weight safely: TDEE + 400 kcal
    if (Number(profile.targetWeight) < Number(profile.weight)) {
        return Math.round(tdee - 500); 
    }
    if (Number(profile.targetWeight) > Number(profile.weight)) {
        return Math.round(tdee + 400); 
    }
    return Math.round(tdee);
  };

  const estimateTime = () => {
    const diff = Math.abs(Number(profile.weight) - Number(profile.targetWeight));
    if (diff === 0) return { weeks: 0, text: "¡Ya estás en tu meta!" };
    
    // Adjusted rate based on activity (more active = slightly more efficient/higher burn)
    const activityRates = {
      sedentary: 0.5,
      light: 0.6,
      moderate: 0.7,
      intense: 0.8
    };
    
    const ratePerWeek = activityRates[profile.activityLevel] || 0.5;
    const weeks = Math.ceil(diff / ratePerWeek);
    const months = (weeks / 4.3).toFixed(1);
    
    return {
      weeks,
      months,
      text: weeks > 4 ? `${months} meses` : `${weeks} semanas`
    };
  };

  const dailyKcal = calculateKcal();
  const timeline = estimateTime();

  // --- API Fetch Helper ---
  const fetchWithRetry = async (url, options, retries = 5, backoff = 1000) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, backoff));
        return fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw err;
    }
  };

  // --- AI Feature: Generate Daily Plan ---
  const generateDailyPlan = async () => {
    if (ingredients.length === 0) {
      setError("Dime qué ingredientes tienes para que el plan sea realista.");
      return;
    }

    setLoading(true);
    setError(null);
    setDailyPlan(null);

    const prompt = `Actúa como un Nutricionista y Coach deportivo experto.
    CONTEXTO DEL USUARIO:
    - Peso: ${profile.weight}kg | Meta: ${profile.targetWeight}kg
    - Nivel de Actividad: ${profile.activityLevel} (Esto es CRÍTICO para el balance de macronutrientes).
    - Objetivo Calórico: ${dailyKcal} kcal/día.
    - Ingredientes: ${ingredients.join(", ")}.
    
    INSTRUCCIONES:
    1. Si la actividad es 'intense' o 'moderate', prioriza proteínas y carbohidratos complejos para la recuperación.
    2. Si es 'sedentary', ajusta las porciones para saciedad sin exceso calórico.

    Responde en JSON estricto:
    {
      "plan_diario": {
        "resumen_dia": "Explicación breve de por qué este plan se ajusta a su nivel de actividad ${profile.activityLevel}.",
        "macros_totales": { "kcal": ${dailyKcal}, "proteinas": "g", "carbs": "g", "grasas": "g" },
        "comidas": [
          {
            "tipo": "Desayuno",
            "nombre": "...",
            "kcal": 0,
            "tiempo": "...",
            "ingredientes": ["..."],
            "pasos": ["..."],
            "beneficio_especifico": "Vínculo con su nivel de actividad o meta."
          }
        ]
      }
    } (Completa Desayuno, Comida, Snack y Cena)`;

    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }], 
            generationConfig: { responseMimeType: "application/json" } 
          })
        }
      );
      const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
      setDailyPlan(parsed.plan_diario);
      setShoppingList(null);
    } catch (err) {
      setError("VitalIA tuvo un pequeño error al calcular tu gasto energético. Reintenta.");
    } finally {
      setLoading(false);
    }
  };

  // --- AI Feature: Pantry Analysis ---
  const analyzePantry = async () => {
    if (ingredients.length === 0) return;
    setIsChatLoading(true);
    const prompt = `Soy una persona con nivel de actividad ${profile.activityLevel} y busco pesar ${profile.targetWeight}kg. 
    Analiza estos ingredientes: ${ingredients.join(", ")}. 
    ¿Qué 3 cosas debería comprar para complementar mi energía y alcanzar mi meta?`;

    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      setPantryAnalysis(data.candidates[0].content.parts[0].text);
      setChatOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatLoading(false);
    }
  };

  // --- AI Feature: Shopping List ---
  const generateShoppingList = async () => {
    if (!dailyPlan) return;
    setLoading(true);
    const prompt = `Crea una lista de compras para este plan de comidas: ${JSON.stringify(dailyPlan.comidas)}. 
    Organiza por: Frescos, Proteínas y Despensa. JSON: {"categorias": [{"nombre": "", "items": [""]}]}`;

    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }], 
            generationConfig: { responseMimeType: "application/json" } 
          })
        }
      );
      const parsed = JSON.parse(data.candidates[0].content.parts[0].text);
      setShoppingList(parsed.categorias);
    } catch (err) {
      setError("No pudimos generar tu lista de compras inteligente.");
    } finally {
      setLoading(false);
    }
  };

  // --- AI Feature: Coach Chat ---
  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const userMsg = { role: 'user', text: chatMessage };
    setChatHistory([...chatHistory, userMsg]);
    setChatMessage("");
    setIsChatLoading(true);

    const prompt = `Eres VitalIA. El usuario tiene un nivel de actividad ${profile.activityLevel} y quiere pasar de ${profile.weight}kg a ${profile.targetWeight}kg. 
    Responde a su duda: "${chatMessage}". Mantén un enfoque científico pero motivador.`;

    try {
      const data = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const aiResponse = data.candidates[0].content.parts[0].text;
      setChatHistory(prev => [...prev, { role: 'assistant', text: aiResponse }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: "Perdí la conexión un segundo. ¿Me lo repites?" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const getMealIcon = (tipo) => {
    switch(tipo) {
      case 'Desayuno': return <Coffee className="w-5 h-5 text-amber-500" />;
      case 'Comida': return <Sun className="w-5 h-5 text-orange-500" />;
      case 'Snack': return <Cookie className="w-5 h-5 text-yellow-500" />;
      case 'Cena': return <Moon className="w-5 h-5 text-blue-500" />;
      default: return <Utensils className="w-5 h-5 text-emerald-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-100">
              <Heart className="text-white w-5 h-5 fill-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-none tracking-tight">Vital<span className="text-emerald-600">IA</span></h1>
              <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-widest mt-1">Smart Nutrition & Fitness</p>
            </div>
          </div>
          <div className="hidden md:flex bg-slate-900 text-white px-5 py-2.5 rounded-[1.25rem] items-center gap-3">
            <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Objetivo Diario</p>
              <p className="text-sm font-black tracking-tight">{dailyKcal} kcal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="font-black text-slate-800 mb-6 flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-emerald-600" /> Perfil Metabolico
            </h2>
            
            <div className="grid grid-cols-2 gap-5 mb-6">
              {[
                { label: 'Peso (kg)', field: 'weight' },
                { label: 'Meta (kg)', field: 'targetWeight' },
                { label: 'Edad', field: 'age' },
                { label: 'Altura (cm)', field: 'height' }
              ].map((item) => (
                <div key={item.field} className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{item.label}</label>
                  <input 
                    type="number" 
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-2 text-sm font-bold focus:border-emerald-500 transition-all outline-none"
                    value={profile[item.field]}
                    onChange={(e) => setProfile({...profile, [item.field]: e.target.value})}
                  />
                </div>
              ))}
            </div>

            <div className="mb-8">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block mb-2">Nivel de Actividad Física</label>
                <div className="grid grid-cols-2 gap-2">
                    {['sedentary', 'light', 'moderate', 'intense'].map((level) => (
                        <button
                            key={level}
                            onClick={() => setProfile({...profile, activityLevel: level})}
                            className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                                profile.activityLevel === level 
                                ? 'bg-emerald-600 border-emerald-600 text-white' 
                                : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {level === 'sedentary' && 'Sedentario'}
                            {level === 'light' && 'Ligera'}
                            {level === 'moderate' && 'Moderada'}
                            {level === 'intense' && 'Intensa'}
                        </button>
                    ))}
                </div>
            </div>

            {profile.weight !== profile.targetWeight && (
              <div className="mb-8 p-5 bg-emerald-50 rounded-[1.5rem] border border-emerald-100 relative overflow-hidden group">
                <Dumbbell className="absolute -right-2 -bottom-2 w-16 h-16 text-emerald-200/50 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Tu Hoja de Ruta</span>
                    </div>
                    <p className="text-xl font-black text-emerald-900 leading-tight">
                    {timeline.text} <span className="text-xs font-medium text-emerald-700 block text-wrap">basado en actividad {profile.activityLevel}</span>
                    </p>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Despensa (Ingredientes)</label>
                <div className="flex gap-2 mt-1.5">
                  <input 
                    type="text" 
                    placeholder="Ej: Pollo, arroz..."
                    className="flex-1 bg-slate-50 border-2 border-transparent rounded-2xl px-4 py-2 text-sm font-bold focus:border-emerald-500"
                    value={inputIngredient}
                    onChange={(e) => setInputIngredient(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), inputIngredient && (setIngredients([...ingredients, inputIngredient]), setInputIngredient("")))}
                  />
                  <button onClick={() => { if(inputIngredient) { setIngredients([...ingredients, inputIngredient]); setInputIngredient(""); } }} className="bg-emerald-600 text-white p-3 rounded-2xl shadow-lg shadow-emerald-100"><Plus className="w-5 h-5" /></button>
                </div>
                
                <button 
                  onClick={analyzePantry}
                  className="w-full mt-3 py-2 text-[11px] font-black uppercase text-emerald-600 border-2 border-emerald-100 rounded-xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                >
                  <Brain className="w-3.5 h-3.5" /> IA: ¿Qué me falta? ✨
                </button>

                <div className="flex flex-wrap gap-2 mt-4">
                  {ingredients.map((ing, idx) => (
                    <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl flex items-center gap-2 animate-in zoom-in-50">
                      {ing} <X className="w-3.5 h-3.5 cursor-pointer hover:text-red-500" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <button 
            onClick={generateDailyPlan}
            disabled={loading}
            className="w-full py-5 rounded-[2.5rem] bg-emerald-600 text-white font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : <Sparkles className="w-6 h-6" />}
            {loading ? "Calculando macros..." : "Generar Plan Vital ✨"}
          </button>
        </div>

        {/* Plan Area */}
        <div className="lg:col-span-8 space-y-8">
          {error && <div className="bg-red-50 text-red-600 p-5 rounded-[1.5rem] font-bold flex items-center gap-3 border border-red-100 animate-in slide-in-from-top-2"><Info className="w-5 h-5 shrink-0" /> {error}</div>}

          {dailyPlan ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8">
                    <Activity className="w-12 h-12 text-slate-50" />
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 relative z-10">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2">Tu Plan Nutricional</h2>
                    <p className="text-slate-500 font-medium italic text-sm md:max-w-md">"{dailyPlan.resumen_dia}"</p>
                  </div>
                  <button 
                    onClick={generateShoppingList}
                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-black transition-all shadow-lg"
                  >
                    <ShoppingCart className="w-4 h-4" /> Compras ✨
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 relative z-10">
                  {Object.entries(dailyPlan.macros_totales).map(([key, val]) => (
                    <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{key}</p>
                      <p className="text-xl font-black text-slate-800">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shopping List Result */}
              {shoppingList && (
                <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 animate-in slide-in-from-top-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-amber-900 flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" /> Tu Lista de Compras
                    </h3>
                    <button onClick={() => setShoppingList(null)} className="text-amber-900/50 hover:text-amber-900"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {shoppingList.map((cat, i) => (
                      <div key={i} className="bg-white/50 p-4 rounded-2xl">
                        <h4 className="text-[10px] font-black uppercase text-amber-700 mb-3 tracking-widest">{cat.nombre}</h4>
                        <ul className="space-y-2">
                          {cat.items.map((item, j) => (
                            <li key={j} className="text-xs font-bold text-amber-800 flex items-center gap-2">
                              <div className="w-1 h-1 bg-amber-400 rounded-full" /> {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dailyPlan.comidas.map((meal, idx) => (
                  <div key={idx} onClick={() => setSelectedMeal(meal)} className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-emerald-200 transition-all cursor-pointer flex flex-col h-full group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-slate-50 p-3.5 rounded-2xl group-hover:bg-emerald-50 transition-colors">
                        {getMealIcon(meal.tipo)}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-300 uppercase leading-none tracking-widest">{meal.tipo}</p>
                        <p className="text-xl font-black text-slate-800 mt-1.5">{meal.kcal} <span className="text-xs text-slate-400 font-bold uppercase">kcal</span></p>
                      </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-tight mb-auto">{meal.nombre}</h3>
                    <div className="mt-8 flex items-center justify-between pt-4 border-t border-slate-50">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><Clock className="w-4 h-4" /> {meal.tiempo}</span>
                      <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-10">
              <div className="bg-emerald-50/50 p-10 rounded-full mb-8">
                <Target className="w-20 h-20 text-emerald-200" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Cálculo de Actividad Listo</h3>
              <p className="max-w-xs mx-auto text-slate-400 font-medium leading-relaxed">He ajustado los parámetros. Pulsa el botón ✨ para generar un plan basado en tus {dailyKcal} kcal recomendadas.</p>
            </div>
          )}
        </div>
      </main>

      {/* Coach Chat Overlay ✨ */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${chatOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}>
        <div className="bg-white w-[350px] h-[550px] rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 p-2 rounded-lg"><Brain className="w-4 h-4 text-white" /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Coach VitalIA ✨</p>
                <p className="text-[10px] text-emerald-400 font-bold">Experto en Nutrición</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="hover:rotate-90 transition-transform"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
            {pantryAnalysis && (
              <div className="bg-emerald-600 p-5 rounded-3xl text-xs font-bold text-white shadow-lg animate-in slide-in-from-left-4">
                <p className="mb-2 flex items-center gap-2 border-b border-white/20 pb-2"><Sparkles className="w-3.5 h-3.5" /> Recomendaciones de Compra</p>
                {pantryAnalysis}
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-xs font-bold shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-3xl animate-pulse flex gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text" 
              placeholder="Pregúntame sobre deporte..."
              className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3 text-xs font-bold focus:ring-2 ring-emerald-500 outline-none"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button 
              onClick={handleSendMessage}
              className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <button 
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 bg-slate-900 text-white p-5 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all z-40 group"
        >
          <MessageSquare className="w-7 h-7" />
          <span className="absolute top-0 right-0 bg-emerald-500 w-5 h-5 rounded-full border-4 border-slate-50 animate-pulse" />
        </button>
      )}

      {/* Meal Detail Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[3.5rem] shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setSelectedMeal(null)} className="absolute top-8 right-8 bg-slate-100 p-2.5 rounded-full hover:bg-red-50 hover:text-red-500 transition-all z-10"><X className="w-6 h-6" /></button>
            <div className="p-10 md:p-14">
              <div className="flex items-center gap-2.5 text-emerald-600 font-black text-xs uppercase tracking-[0.2em] mb-6">{getMealIcon(selectedMeal.tipo)} {selectedMeal.tipo}</div>
              <h2 className="text-4xl font-black text-slate-800 mb-8 leading-[1.1] tracking-tight">{selectedMeal.nombre}</h2>
              <div className="bg-slate-900 p-8 rounded-[2.5rem] mb-12 shadow-xl">
                <h4 className="font-black text-emerald-400 flex items-center gap-2 mb-3 text-sm uppercase tracking-wider"><Sparkles className="w-4 h-4" /> Sabiduría VitalIA ✨</h4>
                <p className="text-sm text-slate-200 italic font-medium leading-relaxed">"{selectedMeal.beneficio_especifico}"</p>
              </div>
              <div className="grid md:grid-cols-2 gap-12">
                <div>
                  <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2.5 text-lg"><Utensils className="w-5 h-5 text-emerald-600" /> Ingredientes</h4>
                  <ul className="space-y-4">
                    {selectedMeal.ingredientes.map((item, i) => (
                      <li key={i} className="text-sm font-semibold text-slate-600 flex gap-4 items-start"><span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" /> {item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2.5 text-lg"><Clock className="w-5 h-5 text-orange-500" /> Pasos</h4>
                  <div className="space-y-6">
                    {selectedMeal.pasos.map((paso, i) => (
                      <div key={i} className="flex gap-5">
                        <span className="bg-emerald-50 text-emerald-700 font-black w-8 h-8 flex items-center justify-center rounded-xl text-xs shrink-0">{i + 1}</span>
                        <p className="text-xs text-slate-600 font-bold leading-relaxed pt-1">{paso}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

export default App;
