import React, { useState, useEffect, useMemo, ReactNode } from 'react';
import { 
  ClipboardCheck, 
  Package, 
  History, 
  Settings as SettingsIcon, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  ArrowRight,
  ShoppingCart,
  TrendingUp,
  Download,
  Share2,
  User,
  Calendar,
  Clock,
  Star,
  Trash2,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Item, DailyCheck, StockStatus, Purchase, WeeklyStat } from './types';

type Tab = 'checklist' | 'purchases' | 'history' | 'stats' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('checklist');
  const [items, setItems] = useState<Item[]>([]);
  const [checks, setChecks] = useState<Record<number, Partial<DailyCheck>>>({});
  const [staffName, setStaffName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat | null>(null);
  const [isMorningCheckDone, setIsMorningCheckDone] = useState(false);

  // Settings State
  const [newItem, setNewItem] = useState({ name: '', category: 'Coffee & Beverages', unit: 'units', is_core: false });

  useEffect(() => {
    fetchItems();
    fetchTodayChecks();
    fetchPurchases();
    fetchStats();
  }, []);

  const fetchItems = async () => {
    const res = await fetch('/api/items');
    const data = await res.json();
    setItems(data);
  };

  const fetchTodayChecks = async () => {
    const res = await fetch('/api/checks/today');
    const data: DailyCheck[] = await res.json();
    if (data.length > 0) {
      const checkMap: Record<number, Partial<DailyCheck>> = {};
      data.forEach(c => {
        checkMap[c.item_id] = c;
      });
      setChecks(checkMap);
      setStaffName(data[0].staff_name);
      setIsMorningCheckDone(true);
    }
  };

  const fetchPurchases = async () => {
    const res = await fetch('/api/purchases');
    const data = await res.json();
    setPurchases(data);
  };

  const fetchStats = async () => {
    const res = await fetch('/api/stats/weekly');
    const data = await res.json();
    setWeeklyStats(data);
  };

  const handleStatusChange = (itemId: number, status: StockStatus) => {
    setChecks(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        item_id: itemId,
        status,
        quantity_needed: 0 // Quantity removed as per request
      }
    }));
  };

  const handleUrgentToggle = (itemId: number) => {
    setChecks(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        item_id: itemId,
        is_urgent: !prev[itemId]?.is_urgent
      }
    }));
  };

  const submitChecklist = async () => {
    if (!staffName) {
      alert('Please enter staff name');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = (Object.values(checks) as Partial<DailyCheck>[]).filter(c => !!c.status);
      await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload, staff_name: staffName })
      });
      setIsMorningCheckDone(true);
      alert('Checklist submitted successfully!');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSummary = () => {
    const needed = (Object.values(checks) as Partial<DailyCheck>[]).filter(c => !!c.status && c.status !== 'enough');
    if (needed.length === 0) return "No items needed today!";

    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    let text = `Stock Needed for ${date}\nSubmitted by: ${staffName}\n\n`;
    
    needed.forEach(c => {
      const item = items.find(i => i.id === c.item_id);
      const urgent = c.is_urgent ? "⚠️ URGENT: " : "";
      const statusLabel = c.status === 'critical' ? '(CRITICAL)' : '(LOW)';
      text += `${urgent}${item?.name} ${statusLabel}\n`;
    });

    return text;
  };

  const copySummary = () => {
    const text = generateSummary();
    navigator.clipboard.writeText(text);
    alert('Summary copied to clipboard!');
  };

  const addItem = async () => {
    if (!newItem.name) return;
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });
    setNewItem({ name: '', category: 'Coffee & Beverages', unit: 'units', is_core: false });
    fetchItems();
  };

  const deleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    await fetch(`/api/items/${id}`, { method: 'DELETE' });
    fetchItems();
  };

  const itemsByCategory = useMemo(() => {
    const groups: Record<string, Item[]> = {};
    items.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [items]);

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-64">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-zinc-200 p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
            <Package className="text-white w-6 h-6" />
          </div>
          <h1 className="font-bold text-xl tracking-tight">StockMaster</h1>
        </div>

        <nav className="space-y-1">
          <NavItem active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')} icon={<ClipboardCheck size={20} />} label="Daily Checklist" />
          <NavItem active={activeTab === 'purchases'} onClick={() => setActiveTab('purchases')} icon={<ShoppingCart size={20} />} label="Purchases" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="History Log" />
          <NavItem active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<TrendingUp size={20} />} label="Weekly Stats" />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={20} />} label="Settings" />
        </nav>

        <div className="mt-auto p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
              <User size={16} className="text-zinc-600" />
            </div>
            <div className="text-xs">
              <p className="font-semibold">{staffName || 'Guest'}</p>
              <p className="text-zinc-500">Staff Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 px-6 py-3 flex justify-between items-center z-50">
        <MobileNavItem active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')} icon={<ClipboardCheck size={24} />} />
        <MobileNavItem active={activeTab === 'purchases'} onClick={() => setActiveTab('purchases')} icon={<ShoppingCart size={24} />} />
        <MobileNavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={24} />} />
        <MobileNavItem active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<TrendingUp size={24} />} />
        <MobileNavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon size={24} />} />
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6 lg:p-10">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
            <Calendar size={14} />
            <span>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">
            {activeTab === 'checklist' && 'Daily Stock Check'}
            {activeTab === 'purchases' && 'Record Purchases'}
            {activeTab === 'history' && 'Daily History Log'}
            {activeTab === 'stats' && 'Weekly Summary'}
            {activeTab === 'settings' && 'System Settings'}
          </h2>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'checklist' && (
              <div className="space-y-8">
                {/* Staff Info */}
                <div className="card p-6 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Staff Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Enter your name..." 
                        className="input-base pl-10"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        disabled={isMorningCheckDone}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-medium ${isMorningCheckDone ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                      {isMorningCheckDone ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                      {isMorningCheckDone ? 'Check Complete' : 'Pending Check'}
                    </div>
                  </div>
                </div>

                {/* Categories */}
                {Object.entries(itemsByCategory).map(([category, catItems]) => (
                  <section key={category} className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                      <ChevronRight size={16} />
                      {category}
                    </h3>
                    <div className="grid gap-3">
                      {(catItems as Item[]).map(item => (
                        <CheckItem 
                          key={item.id} 
                          item={item} 
                          check={checks[item.id] as Partial<DailyCheck> | undefined} 
                          onStatusChange={(status) => handleStatusChange(item.id, status)}
                          onUrgentToggle={() => handleUrgentToggle(item.id)}
                          disabled={isMorningCheckDone}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {/* Actions */}
                <div className="space-y-6 pt-6">
                  {isMorningCheckDone && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="card bg-zinc-900 text-white border-none p-6 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <h3 className="font-bold flex items-center gap-2">
                          <ClipboardCheck size={18} className="text-emerald-400" />
                          Report Preview
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest bg-white/10 px-2 py-1 rounded">Ready to Send</span>
                      </div>
                      <pre className="font-mono text-sm whitespace-pre-wrap text-zinc-300 leading-relaxed">
                        {generateSummary()}
                      </pre>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                        <button 
                          onClick={copySummary}
                          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                        >
                          <Share2 size={20} className="text-blue-400" />
                          <span className="text-[10px] font-bold uppercase">Copy</span>
                        </button>
                        <button 
                          onClick={() => {
                            const text = generateSummary();
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                        >
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                            <ArrowRight size={12} className="text-white" />
                          </div>
                          <span className="text-[10px] font-bold uppercase">WhatsApp</span>
                        </button>
                        <button 
                          onClick={() => {
                            const text = generateSummary();
                            window.location.href = `sms:?body=${encodeURIComponent(text)}`;
                          }}
                          className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                        >
                          <AlertCircle size={20} className="text-amber-400" />
                          <span className="text-[10px] font-bold uppercase">SMS</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    {!isMorningCheckDone ? (
                      <button 
                        onClick={submitChecklist}
                        disabled={isSubmitting || !staffName}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? 'Submitting...' : 'Generate Daily Report'}
                        <ArrowRight size={18} />
                      </button>
                    ) : (
                      <button onClick={() => setIsMorningCheckDone(false)} className="btn-secondary flex-1 flex items-center justify-center gap-2 text-zinc-500">
                        Edit Checklist
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'purchases' && (
              <div className="space-y-6">
                <div className="card p-6">
                  <h3 className="font-bold mb-4">Record New Purchase</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Item</label>
                      <select className="input-base" id="purchase-item">
                        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Store / Supplier</label>
                      <select className="input-base" id="purchase-store">
                        <option value="Coles">Coles</option>
                        <option value="Costco">Costco</option>
                        <option value="Woolworths">Woolworths</option>
                        <option value="Aldi">Aldi</option>
                        <option value="Local Supplier">Local Supplier</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Quantity</label>
                      <input type="number" className="input-base" id="purchase-qty" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Total Cost ($)</label>
                      <input type="number" step="0.01" className="input-base" id="purchase-cost" placeholder="0.00" />
                    </div>
                    <div className="flex items-end sm:col-span-2">
                      <button 
                        onClick={async () => {
                          const itemId = (document.getElementById('purchase-item') as HTMLSelectElement).value;
                          const store = (document.getElementById('purchase-store') as HTMLSelectElement).value;
                          const qty = (document.getElementById('purchase-qty') as HTMLInputElement).value;
                          const cost = (document.getElementById('purchase-cost') as HTMLInputElement).value;
                          if (!itemId || !qty || !cost) return;
                          await fetch('/api/purchases', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                              item_id: parseInt(itemId), 
                              quantity: parseInt(qty), 
                              cost: parseFloat(cost),
                              store: store
                            })
                          });
                          fetchPurchases();
                          fetchStats();
                          alert('Purchase recorded!');
                        }}
                        className="btn-primary w-full"
                      >
                        Add Purchase
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Recent Purchases</h3>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {purchases.map(p => (
                      <div key={p.id} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400">
                            <Store size={20} />
                          </div>
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <span className="font-medium text-zinc-900">{p.store}</span>
                              <span>•</span>
                              <span>{new Date(p.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium">{p.quantity} units</p>
                          <p className="text-sm text-emerald-600 font-semibold">${p.cost.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    {purchases.length === 0 && <div className="p-10 text-center text-zinc-400">No purchases recorded yet.</div>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="card overflow-hidden">
                <div className="p-10 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
                    <History className="text-zinc-400" size={32} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Coming Soon</h3>
                    <p className="text-zinc-500 max-w-xs mx-auto">We are building a detailed history view to track your stock trends over time.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="card p-6 bg-zinc-900 text-white border-none">
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Total Spending (7d)</p>
                    <h3 className="text-4xl font-light tracking-tight">
                      ${weeklyStats?.items.reduce((acc, s) => acc + s.total_cost, 0).toFixed(2) || '0.00'}
                    </h3>
                  </div>
                  <div className="card p-6">
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">Items Purchased (7d)</p>
                    <h3 className="text-4xl font-light tracking-tight">
                      {weeklyStats?.items.reduce((acc, s) => acc + s.total_quantity, 0) || 0}
                    </h3>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Store-wise Spending</h3>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {weeklyStats?.stores.map(s => (
                        <div key={s.store} className="px-6 py-4 flex items-center justify-between">
                          <p className="font-medium">{s.store}</p>
                          <p className="font-mono text-emerald-600 font-semibold">${s.total_cost.toFixed(2)}</p>
                        </div>
                      ))}
                      {(!weeklyStats || weeklyStats.stores.length === 0) && <div className="p-6 text-center text-zinc-400 text-sm">No store data available.</div>}
                    </div>
                  </div>

                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Item Breakdown</h3>
                    </div>
                    <div className="divide-y divide-zinc-100">
                      {weeklyStats?.items.map(s => (
                        <div key={s.name} className="px-6 py-4 flex items-center justify-between">
                          <p className="font-medium">{s.name}</p>
                          <div className="text-right">
                            <p className="text-xs text-zinc-400">{s.total_quantity} units</p>
                            <p className="font-mono text-emerald-600 font-semibold">${s.total_cost.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="card p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Plus size={20} />
                    Add New Item
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Item Name</label>
                      <input 
                        type="text" 
                        className="input-base" 
                        placeholder="e.g. Oat Milk" 
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Category</label>
                      <select 
                        className="input-base"
                        value={newItem.category}
                        onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                      >
                        <option>Coffee & Beverages</option>
                        <option>Kitchen Items</option>
                        <option>Bakery Items</option>
                        <option>Cleaning Supplies</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-500 mb-1">Unit</label>
                      <input 
                        type="text" 
                        className="input-base" 
                        placeholder="e.g. cartons" 
                        value={newItem.unit}
                        onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input 
                        type="checkbox" 
                        id="is-core" 
                        className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        checked={newItem.is_core}
                        onChange={(e) => setNewItem({...newItem, is_core: e.target.checked})}
                      />
                      <label htmlFor="is-core" className="text-sm font-medium">Core Operational Item</label>
                    </div>
                    <div className="sm:col-span-2">
                      <button onClick={addItem} className="btn-primary w-full">Add to System</button>
                    </div>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Manage Existing Items</h3>
                  </div>
                  <div className="divide-y divide-zinc-100">
                    {items.map(item => (
                      <div key={item.id} className="px-6 py-4 flex items-center justify-between group">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-zinc-500">{item.category} • {item.unit}</p>
                        </div>
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
        active 
          ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' 
          : 'text-zinc-500 hover:bg-zinc-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon }: { active: boolean, onClick: () => void, icon: ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`p-2 rounded-xl transition-all ${active ? 'text-zinc-900 bg-zinc-100' : 'text-zinc-400'}`}
    >
      {icon}
    </button>
  );
}

interface CheckItemProps {
  key?: number;
  item: Item;
  check?: Partial<DailyCheck>;
  onStatusChange: (status: StockStatus) => void;
  onUrgentToggle: () => void;
  disabled: boolean;
}

function CheckItem({ item, check, onStatusChange, onUrgentToggle, disabled }: CheckItemProps) {
  const status = check?.status || 'enough';
  
  return (
    <div className={`card p-4 transition-all ${status === 'critical' ? 'border-red-200 bg-red-50/30' : status === 'low' ? 'border-amber-200 bg-amber-50/30' : 'hover:border-zinc-300'}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1 flex items-center gap-3">
          <div className={`status-dot ${status === 'critical' ? 'bg-red-500' : status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{item.name}</p>
              {item.is_core && <span className="text-[10px] font-bold uppercase bg-zinc-900 text-white px-1.5 py-0.5 rounded">Core</span>}
            </div>
            <p className="text-xs text-zinc-500">{item.unit}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-zinc-100 p-1 rounded-xl">
            <StatusBtn active={status === 'enough'} onClick={() => onStatusChange('enough')} label="Enough" color="emerald" disabled={disabled} />
            <StatusBtn active={status === 'low'} onClick={() => onStatusChange('low')} label="Low" color="amber" disabled={disabled} />
            <StatusBtn active={status === 'critical'} onClick={() => onStatusChange('critical')} label="Critical" color="red" disabled={disabled} />
          </div>

          {status !== 'enough' && (
            <div className="flex items-center gap-2">
              <button 
                onClick={onUrgentToggle}
                disabled={disabled}
                className={`p-2 rounded-lg border transition-all ${check?.is_urgent ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-zinc-200 text-zinc-400 hover:text-red-500'}`}
                title="Mark as Urgent"
              >
                <Star size={16} fill={check?.is_urgent ? 'currentColor' : 'none'} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBtn({ active, onClick, label, color, disabled }: { active: boolean, onClick: () => void, label: string, color: 'emerald' | 'amber' | 'red', disabled: boolean }) {
  const colors = {
    emerald: active ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:bg-emerald-50',
    amber: active ? 'bg-amber-500 text-white shadow-sm' : 'text-zinc-500 hover:bg-amber-50',
    red: active ? 'bg-red-500 text-white shadow-sm' : 'text-zinc-500 hover:bg-red-50',
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${colors[color]}`}
    >
      {label}
    </button>
  );
}
