/* ====================================================
   TAIMS — Complete Application Logic
   Live Backend: Google Apps Script
   API: https://script.google.com/macros/s/AKfycbyCG2KtZToPkWb-W7mr0dQUzNleH3j7lYJfmmGKtXZWM2vUICdwlmk4CebgqsiIID-vqw/exec
==================================================== */

// ============ LIVE API CONFIGURATION ============
const API_URL = 'https://script.google.com/macros/s/AKfycbyCG2KtZToPkWb-W7mr0dQUzNleH3j7lYJfmmGKtXZWM2vUICdwlmk4CebgqsiIID-vqw/exec';
let API_TOKEN = null;
let BACKEND_AVAILABLE = false; // flips true after first successful ping

// Core API caller — handles CORS via no-cors fetch + JSON parse
async function callAPI(action, data = {}) {
  try {
    const body = { action, data };
    if (API_TOKEN) body.token = API_TOKEN;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // GAS requires text/plain for CORS
      body: JSON.stringify(body),
      redirect: 'follow'
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success !== false) BACKEND_AVAILABLE = true;
    return json;
  } catch (err) {
    console.warn(`[TAIMS API] ${action} failed:`, err.message);
    return { success: false, error: err.message, offline: true };
  }
}

// GET via URL params (for simple reads — avoids preflight)
async function callAPIGet(action, params = {}) {
  try {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${API_URL}?${qs}`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.success !== false) BACKEND_AVAILABLE = true;
    return json;
  } catch (err) {
    console.warn(`[TAIMS API GET] ${action} failed:`, err.message);
    return { success: false, error: err.message, offline: true };
  }
}

function showAPIStatus(ok) {
  const indicator = document.getElementById('api-status');
  const label = document.getElementById('api-label');
  if (indicator) {
    indicator.className = `api-dot ${ok ? 'online' : 'offline'}`;
    indicator.title = ok ? 'Live — Google Sheets connected' : 'Demo mode — Google Sheets not connected';
  }
  if (label) {
    label.textContent = ok ? 'Live — Google Sheets' : 'Demo mode';
    label.style.color = ok ? 'rgba(52,211,153,0.8)' : 'rgba(255,255,255,0.35)';
  }
}

// ============ DATA LAYER ============
const USERS = {
  admin: { name: 'Priya Sharma', role: 'Administrator', email: 'admin@township.com', password: 'admin123', color: '#0ea5e9' },
  supervisor: { name: 'Ravi Kumar', role: 'Supervisor', email: 'supervisor@township.com', password: 'super123', color: '#8b5cf6' },
  worker: { name: 'Arjun Singh', role: 'Worker', email: 'worker@township.com', password: 'worker123', color: '#10b981' }
};

let currentUser = null;
let currentStep = 1;
let editingAssetId = null;
let currentCalMonth = new Date().getMonth();
let currentCalYear = new Date().getFullYear();
let sortField = 'id';
let sortDir = 1;
let currentPage = 1;
const ITEMS_PER_PAGE = 15;

// ============ MASTER DATA ============
const SUBCATEGORY_MAP = {
  'Electrical': ['Lift / Elevator', 'Transformer', 'Generator', 'DG Set', 'UPS / Inverter', 'Distribution Panel', 'MCB / ELCB', 'CCTV Camera', 'Street Light', 'Common Light', 'Fan', 'Pump Motor', 'Fire Alarm', 'PA System'],
  'Mechanical': ['Water Pump', 'Pressure Pump', 'Booster Pump', 'Gate / Barrier', 'Roller Shutter', 'Fire Hydrant', 'Water Sump', 'Overhead Tank', 'Pipeline Valve', 'AC Unit'],
  'Civil': ['Sump Tank', 'Terrace Waterproofing', 'Retaining Wall', 'Boundary Wall', 'Pathway', 'Garden Structure', 'Parking Marking', 'Speed Breaker', 'Drainage System', 'Staircase'],
  'Misc': ['Parking Boom Barrier', 'Intercom System', 'Video Door Phone', 'Security System', 'Mailbox', 'Notice Board', 'Gym Equipment', 'Play Equipment', 'Benches', 'Dustbin']
};

const SUBLOCATION_MAP = {
  'Tower 1': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 2': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 3': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 4': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 5': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 6': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 7': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 8': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Tower 9': ['Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6','Floor 7','Floor 8','Floor 9','Lift Lobby','Corridor','Electrical Room','Terrace','Staircase'],
  'Pump House': ['Motor 1','Motor 2','Motor 3','Panel Area','Valve Section','Sump Area','Control Room'],
  'Parking (Cellar)': ['Zone A','Zone B','Zone C','Entry','Exit','Ramp Area'],
  'Parking (Stilt)': ['Tower 1 Side','Tower 2 Side','Tower 3 Side','Visitor Area'],
  'Park 1': ['Play Area','Seating Zone','Walking Track','Garden Bed','Entry Gate'],
  'Park 2': ['Play Area','Seating Zone','Walking Track','Garden Bed','Entry Gate'],
  'Common Area': ['Gate House','Club House','Gym Area','Reception','Management Office']
};

const LOCATION_DETAILS = {
  'Tower 1': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 1' },
  'Tower 2': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 1' },
  'Tower 3': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 1' },
  'Tower 4': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 2' },
  'Tower 5': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 2' },
  'Tower 6': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 2' },
  'Tower 7': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 3' },
  'Tower 8': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 3' },
  'Tower 9': { lifts: 2, floors: 9, flats: 54, gen: 'Generator 3' },
};

const CATEGORY_COLORS = ['#0ea5e9','#10b981','#f59e0b','#8b5cf6'];
const CATEGORY_NAMES = ['Electrical','Mechanical','Civil','Misc'];
const CATEGORY_COUNTS = [412, 189, 156, 90];

// Generate comprehensive sample data
function generateAssets() {
  const assetDefs = [
    { name: 'KONE Elevator Unit', cat: 'Electrical', sub: 'Lift / Elevator', loc: 'Tower 1', subloc: 'Lift Lobby', brand: 'KONE', model: 'MonoSpace 500', cost: 850000 },
    { name: 'Schindler Elevator', cat: 'Electrical', sub: 'Lift / Elevator', loc: 'Tower 2', subloc: 'Lift Lobby', brand: 'Schindler', model: '3300', cost: 920000 },
    { name: 'KONE Elevator Unit', cat: 'Electrical', sub: 'Lift / Elevator', loc: 'Tower 3', subloc: 'Lift Lobby', brand: 'KONE', model: 'MonoSpace 500', cost: 850000 },
    { name: 'KONE Elevator Unit', cat: 'Electrical', sub: 'Lift / Elevator', loc: 'Tower 4', subloc: 'Lift Lobby', brand: 'KONE', model: 'MonoSpace 500', cost: 850000 },
    { name: 'Schindler Elevator', cat: 'Electrical', sub: 'Lift / Elevator', loc: 'Tower 5', subloc: 'Lift Lobby', brand: 'Schindler', model: '3300', cost: 920000 },
    { name: 'Cummins Generator 250KVA', cat: 'Electrical', sub: 'Generator', loc: 'Tower 1', subloc: 'Electrical Room', brand: 'Cummins', model: 'C250D5', cost: 1250000 },
    { name: 'Cummins Generator 250KVA', cat: 'Electrical', sub: 'Generator', loc: 'Tower 4', subloc: 'Electrical Room', brand: 'Cummins', model: 'C250D5', cost: 1250000 },
    { name: 'Cummins Generator 250KVA', cat: 'Electrical', sub: 'Generator', loc: 'Tower 7', subloc: 'Electrical Room', brand: 'Cummins', model: 'C250D5', cost: 1250000 },
    { name: 'Kirloskar Transformer 500KVA', cat: 'Electrical', sub: 'Transformer', loc: 'Tower 1', subloc: 'Electrical Room', brand: 'Kirloskar', model: 'KE-500', cost: 580000 },
    { name: 'Kirloskar Transformer 500KVA', cat: 'Electrical', sub: 'Transformer', loc: 'Tower 2', subloc: 'Electrical Room', brand: 'Kirloskar', model: 'KE-500', cost: 580000 },
    { name: 'Grundfos Submersible Pump', cat: 'Mechanical', sub: 'Water Pump', loc: 'Pump House', subloc: 'Motor 1', brand: 'Grundfos', model: 'SP 30-9', cost: 145000 },
    { name: 'Grundfos Submersible Pump', cat: 'Mechanical', sub: 'Water Pump', loc: 'Pump House', subloc: 'Motor 2', brand: 'Grundfos', model: 'SP 30-9', cost: 145000 },
    { name: 'KSB Pressure Booster Pump', cat: 'Mechanical', sub: 'Booster Pump', loc: 'Pump House', subloc: 'Motor 3', brand: 'KSB', model: 'Etabloc 040', cost: 95000 },
    { name: 'Hikvision CCTV Camera', cat: 'Electrical', sub: 'CCTV Camera', loc: 'Tower 1', subloc: 'Lift Lobby', brand: 'Hikvision', model: 'DS-2CD2143G2', cost: 8500 },
    { name: 'Hikvision CCTV Camera', cat: 'Electrical', sub: 'CCTV Camera', loc: 'Tower 2', subloc: 'Lift Lobby', brand: 'Hikvision', model: 'DS-2CD2143G2', cost: 8500 },
    { name: 'Parking Boom Barrier', cat: 'Misc', sub: 'Parking Boom Barrier', loc: 'Parking (Cellar)', subloc: 'Entry', brand: 'FAAC', model: 'B680', cost: 85000 },
    { name: 'Parking Boom Barrier', cat: 'Misc', sub: 'Parking Boom Barrier', loc: 'Parking (Cellar)', subloc: 'Exit', brand: 'FAAC', model: 'B680', cost: 85000 },
    { name: 'Overhead Water Tank 50KL', cat: 'Civil', sub: 'Overhead Tank', loc: 'Tower 1', subloc: 'Terrace', brand: 'Sintex', model: 'LLDPE-50', cost: 65000 },
    { name: 'Fire Hydrant System', cat: 'Mechanical', sub: 'Fire Hydrant', loc: 'Tower 1', subloc: 'Floor 1', brand: 'Newage', model: 'FH-2021', cost: 125000 },
    { name: 'DG Set Control Panel', cat: 'Electrical', sub: 'Distribution Panel', loc: 'Tower 1', subloc: 'Electrical Room', brand: 'L&T', model: 'MCC-2020', cost: 180000 },
    { name: 'LED Street Light 80W', cat: 'Electrical', sub: 'Street Light', loc: 'Common Area', subloc: 'Gate House', brand: 'Havells', model: 'LED-SL-80', cost: 12000 },
    { name: 'Children Play Equipment Set', cat: 'Misc', sub: 'Play Equipment', loc: 'Park 1', subloc: 'Play Area', brand: 'Kompan', model: 'Nature Play', cost: 285000 },
    { name: 'Garden Bench Granite', cat: 'Civil', sub: 'Benches', loc: 'Park 1', subloc: 'Seating Zone', brand: 'Local', model: 'Granite-G01', cost: 18000 },
    { name: 'Security Access Controller', cat: 'Electrical', sub: 'Security System', loc: 'Common Area', subloc: 'Gate House', brand: 'HID', model: 'VertX V1000', cost: 45000 },
    { name: 'UPS System 20KVA', cat: 'Electrical', sub: 'UPS / Inverter', loc: 'Tower 1', subloc: 'Electrical Room', brand: 'APC', model: 'Galaxy 300', cost: 320000 },
    { name: 'Roller Shutter Door', cat: 'Mechanical', sub: 'Roller Shutter', loc: 'Parking (Cellar)', subloc: 'Entry', brand: 'Dormax', model: 'RS-4500', cost: 95000 },
    { name: 'Video Door Phone System', cat: 'Misc', sub: 'Video Door Phone', loc: 'Tower 6', subloc: 'Lift Lobby', brand: 'Legrand', model: 'VDP-Color', cost: 35000 },
    { name: 'AC Unit 1.5T Split', cat: 'Mechanical', sub: 'AC Unit', loc: 'Common Area', subloc: 'Management Office', brand: 'Daikin', model: 'FTKF50TV', cost: 55000 },
    { name: 'Intercom Master Station', cat: 'Misc', sub: 'Intercom System', loc: 'Common Area', subloc: 'Gate House', brand: 'Ravel', model: 'MS-2050', cost: 28000 },
    { name: 'Water Sump 2L Lakh Litres', cat: 'Civil', sub: 'Sump Tank', loc: 'Pump House', subloc: 'Sump Area', brand: 'RCC Built', model: 'Underground Sump', cost: 450000 },
  ];

  const conditions = ['Good','Good','Good','Repair','Critical'];
  const statuses = ['Active','Active','Active','Under Repair'];
  const warranties = ['active','active','expiring','expired','none'];

  return assetDefs.map((def, i) => {
    const wType = warranties[i % warranties.length];
    const today = new Date();
    let wStart, wEnd;
    if (wType === 'active') { wStart = new Date(today.getFullYear()-1, today.getMonth(), 1); wEnd = new Date(today.getFullYear()+1, today.getMonth(), 1); }
    else if (wType === 'expiring') { wStart = new Date(today.getFullYear()-1, today.getMonth(), 1); wEnd = new Date(today.getFullYear(), today.getMonth()+1, today.getDate()+15); }
    else if (wType === 'expired') { wStart = new Date(today.getFullYear()-2, today.getMonth(), 1); wEnd = new Date(today.getFullYear()-1, today.getMonth(), 1); }

    const hasAmc = i % 3 !== 0;
    let amcStart, amcEnd;
    if (hasAmc) {
      amcStart = new Date(today.getFullYear(), 0, 1);
      amcEnd = new Date(today.getFullYear() + (i % 5 === 0 ? 0 : 1), i % 12, 1);
    }

    return {
      id: `AST-${String(2024).slice(2)}-${String(i+1).padStart(3,'0')}`,
      name: def.name,
      category: def.cat,
      subcategory: def.sub,
      mainLocation: def.loc,
      subLocation: def.subloc,
      brand: def.brand,
      model: def.model,
      serial: `SN-${def.brand.toUpperCase().slice(0,3)}-${String(Math.floor(Math.random()*99999)).padStart(5,'0')}`,
      installDate: `202${i%4}-${String((i%12)+1).padStart(2,'0')}-15`,
      condition: conditions[i % conditions.length],
      status: statuses[i % statuses.length],
      purchaseCost: def.cost,
      replacementCost: Math.round(def.cost * 1.3),
      quantity: 1,
      unit: def.sub.includes('Camera') ? 'Nos' : def.sub.includes('Light') ? 'Nos' : 'Set',
      warrantyAvailable: wType !== 'none',
      warrantyType: 'Manufacturer',
      warrantyProvider: def.brand + ' Service',
      warrantyStart: wStart ? wStart.toISOString().split('T')[0] : '',
      warrantyEnd: wEnd ? wEnd.toISOString().split('T')[0] : '',
      warrantyStatus: wType === 'none' ? 'N/A' : wType,
      warrantyContact: '+91 98765 4321' + i,
      amcRequired: hasAmc,
      amcVendor: hasAmc ? def.brand + ' AMC Services' : '',
      amcType: hasAmc ? (i%2===0 ? 'Comprehensive' : 'Non-Comprehensive') : '',
      amcStart: amcStart ? amcStart.toISOString().split('T')[0] : '',
      amcEnd: amcEnd ? amcEnd.toISOString().split('T')[0] : '',
      amcCost: hasAmc ? Math.round(def.cost * 0.08) : 0,
      amcFrequency: i%3===0 ? 'Monthly' : i%3===1 ? 'Quarterly' : 'Half-Yearly',
      amcStatus: hasAmc ? (amcEnd && amcEnd < today ? 'expired' : 'active') : 'N/A',
      notes: '',
      addedDate: new Date(today.getFullYear(), today.getMonth()-Math.floor(Math.random()*6), Math.floor(Math.random()*28)+1).toISOString().split('T')[0]
    };
  });
}

const TASKS_DATA = [
  { id: 'TSK-001', assetId: 'AST-24-001', assetName: 'KONE Elevator Unit', issue: 'Breakdown', desc: 'Lift making grinding noise on floor 5, needs immediate inspection', worker: 'Ramesh Kumar', status: 'Open', priority: 'Urgent', date: '2024-01-15', location: 'Tower 1 - Lift Lobby' },
  { id: 'TSK-002', assetId: 'AST-24-006', assetName: 'Cummins Generator', issue: 'Preventive', desc: 'Monthly DG maintenance - oil change, filter cleaning, load test', worker: 'Sanjay Singh', status: 'In Progress', priority: 'Normal', date: '2024-01-14', location: 'Tower 1 - Electrical Room' },
  { id: 'TSK-003', assetId: 'AST-24-011', assetName: 'Grundfos Pump', issue: 'AMC Service', desc: 'Quarterly AMC service for submersible pump - Q4 2024', worker: 'Mohammed Ali', status: 'In Progress', priority: 'High', date: '2024-01-13', location: 'Pump House - Motor 1' },
  { id: 'TSK-004', assetId: 'AST-24-002', assetName: 'Schindler Elevator', issue: 'Inspection', desc: 'Annual safety inspection - load test and cabin checks', worker: 'Arjun Patel', status: 'Open', priority: 'High', date: '2024-01-12', location: 'Tower 2 - Lift Lobby' },
  { id: 'TSK-005', assetId: 'AST-24-014', assetName: 'CCTV Camera', issue: 'Repair', desc: 'Camera in Tower 1 lobby not recording, possible HDD failure', worker: 'Ramesh Kumar', status: 'Open', priority: 'Normal', date: '2024-01-11', location: 'Tower 1 - Lift Lobby' },
  { id: 'TSK-006', assetId: 'AST-24-021', assetName: 'LED Street Light', issue: 'Repair', desc: '3 street lights near gate not working', worker: 'Sanjay Singh', status: 'Completed', priority: 'Normal', date: '2024-01-10', location: 'Common Area' },
  { id: 'TSK-007', assetId: 'AST-24-009', assetName: 'Kirloskar Transformer', issue: 'Inspection', desc: 'Transformer oil testing and thermal imaging', worker: 'Arjun Patel', status: 'Completed', priority: 'High', date: '2024-01-09', location: 'Tower 1 - Electrical Room' },
  { id: 'TSK-008', assetId: 'AST-24-016', assetName: 'Parking Boom Barrier', issue: 'Repair', desc: 'Entry boom barrier not closing fully, spring needs replacement', worker: 'Mohammed Ali', status: 'Open', priority: 'Normal', date: '2024-01-08', location: 'Parking (Cellar) - Entry' },
  { id: 'TSK-009', assetId: 'AST-24-013', assetName: 'KSB Pressure Pump', issue: 'Preventive', desc: 'Check pressure settings and impeller clearance', worker: 'Ramesh Kumar', status: 'Completed', priority: 'Normal', date: '2024-01-07', location: 'Pump House' },
  { id: 'TSK-010', assetId: 'AST-24-025', assetName: 'UPS System', issue: 'AMC Service', desc: 'Battery capacity test and terminal cleaning', worker: 'Sanjay Singh', status: 'In Progress', priority: 'High', date: '2024-01-06', location: 'Tower 1 - Electrical Room' },
  { id: 'TSK-011', assetId: 'AST-24-003', assetName: 'KONE Elevator Unit', issue: 'Breakdown', desc: 'Tower 3 lift stuck between floors, immediate rescue needed', worker: 'Arjun Patel', status: 'Completed', priority: 'Urgent', date: '2024-01-05', location: 'Tower 3' },
  { id: 'TSK-012', assetId: 'AST-24-018', assetName: 'Fire Hydrant System', issue: 'Inspection', desc: 'Monthly fire system inspection - pressure and valve checks', worker: 'Mohammed Ali', status: 'Open', priority: 'High', date: '2024-01-04', location: 'Tower 1 - Floor 1' },
];

const ALERTS_DATA = [
  { id: 1, type: 'red', title: 'Critical: KONE Elevator — Tower 3', body: 'Elevator is in critical condition. Immediate maintenance required before next inspection.', time: '2 hours ago', category: 'asset', unread: true },
  { id: 2, type: 'amber', title: 'Warranty Expiring — Cummins Generator T7', body: 'Warranty expires in 18 days. Plan AMC engagement before expiry.', time: '4 hours ago', category: 'warranty', unread: true },
  { id: 3, type: 'amber', title: 'Warranty Expiring — Grundfos Pump Motor 2', body: 'Warranty expires in 22 days. Contact Grundfos for renewal.', time: '1 day ago', category: 'warranty', unread: true },
  { id: 4, type: 'red', title: 'AMC Overdue — Parking Boom Barrier (Exit)', body: 'Last service was 5 months ago. Quarterly service is overdue.', time: '1 day ago', category: 'amc', unread: true },
  { id: 5, type: 'amber', title: 'AMC Expiring — Tower 1 Transformer AMC', body: 'AMC contract expires in 28 days. Renew with vendor to avoid lapse.', time: '2 days ago', category: 'amc', unread: true },
  { id: 6, type: 'red', title: 'Task Overdue — Tower 2 Elevator Inspection', body: 'Scheduled inspection task TSK-004 is 3 days overdue.', time: '3 days ago', category: 'task', unread: false },
  { id: 7, type: 'blue', title: 'Maintenance Completed — Kirloskar Transformer', body: 'Annual oil testing successfully completed by Arjun Patel.', time: '3 days ago', category: 'task', unread: false },
];

const AMC_DATA = [
  { assetId: 'AST-24-001', asset: 'KONE Elevator — Tower 1', vendor: 'KONE India Ltd', type: 'Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 180000, lastService: '2024-01-10', nextDue: '2024-04-10', status: 'active', freq: 'Quarterly' },
  { assetId: 'AST-24-002', asset: 'Schindler Elevator — Tower 2', vendor: 'Schindler India', type: 'Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 195000, lastService: '2023-12-05', nextDue: '2024-03-05', status: 'active', freq: 'Quarterly' },
  { assetId: 'AST-24-006', asset: 'Cummins Generator — T1', vendor: 'Cummins Service Center', type: 'Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 145000, lastService: '2024-01-14', nextDue: '2024-02-14', status: 'active', freq: 'Monthly' },
  { assetId: 'AST-24-007', asset: 'Cummins Generator — T4', vendor: 'Cummins Service Center', type: 'Non-Comprehensive', start: '2024-01-01', end: '2024-11-15', cost: 120000, lastService: '2023-12-15', nextDue: '2024-03-15', status: 'expiring', freq: 'Quarterly' },
  { assetId: 'AST-24-009', asset: 'Kirloskar Transformer T1', vendor: 'Kirloskar Electric', type: 'Non-Comprehensive', start: '2023-06-01', end: '2024-01-28', cost: 95000, lastService: '2023-10-01', nextDue: '2024-01-01', status: 'expiring', freq: 'Half-Yearly' },
  { assetId: 'AST-24-011', asset: 'Grundfos Pump Motor 1', vendor: 'Grundfos India', type: 'Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 48000, lastService: '2024-01-13', nextDue: '2024-04-13', status: 'active', freq: 'Quarterly' },
  { assetId: 'AST-24-012', asset: 'Grundfos Pump Motor 2', vendor: 'Grundfos India', type: 'Comprehensive', start: '2023-01-01', end: '2023-12-31', cost: 48000, lastService: '2023-09-15', nextDue: '2023-12-15', status: 'expired', freq: 'Quarterly' },
  { assetId: 'AST-24-016', asset: 'Parking Boom Barrier (Entry)', vendor: 'FAAC India', type: 'Non-Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 32000, lastService: '2023-09-01', nextDue: '2023-12-01', status: 'active', freq: 'Quarterly' },
  { assetId: 'AST-24-025', asset: 'APC UPS System 20KVA', vendor: 'APC by SE', type: 'Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 85000, lastService: '2024-01-06', nextDue: '2024-02-06', status: 'active', freq: 'Monthly' },
  { assetId: 'AST-24-019', asset: 'Fire Hydrant System T1', vendor: 'Newage Fire Safety', type: 'Comprehensive', start: '2024-01-01', end: '2024-12-31', cost: 65000, lastService: '2024-01-04', nextDue: '2024-02-04', status: 'active', freq: 'Monthly' },
];

let ASSETS = generateAssets();

// ============ AUTH ============
function quickLogin(role) {
  const u = USERS[role];
  document.getElementById('login-email').value = u.email;
  document.getElementById('login-password').value = u.password;
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.querySelector('.btn-login');

  btn.textContent = 'Signing in…';
  btn.disabled = true;

  // Try live backend first
  const result = await callAPI('login', { email, password });

  let found = null;

  if (result.success && result.user) {
    // ✅ Live login succeeded
    API_TOKEN = result.token || null;
    found = result.user;
    found.role = result.user.role || 'admin';
    BACKEND_AVAILABLE = true;
    showToast('Connected to Google Sheets ✓', 'success');
  } else {
    // 🔄 Fallback: demo mode (offline or sheet not yet set up)
    for (let [role, user] of Object.entries(USERS)) {
      if (user.email === email && user.password === password) { found = { ...user, role }; break; }
    }
    // Quick-login chips: match by role keyword in email
    if (!found) {
      for (let [role, user] of Object.entries(USERS)) {
        if (email.includes(role) || email === '') { found = { ...user, role }; break; }
      }
    }
    if (!found) found = { ...USERS.admin, role: 'admin' };

    if (result.offline) {
      showToast('Offline mode — using demo data', 'warning');
    } else if (!result.success && result.error && !result.offline) {
      showToast('Invalid credentials', 'error');
      btn.textContent = 'Sign In';
      btn.disabled = false;
      return;
    }
  }

  btn.textContent = 'Sign In';
  btn.disabled = false;

  currentUser = found;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('user-name').textContent = found.name || found.NAME || 'User';
  const roleName = (found.role || 'admin');
  document.getElementById('user-role').textContent = roleName === 'admin' ? 'Administrator' : roleName.charAt(0).toUpperCase() + roleName.slice(1);
  document.getElementById('user-avatar').textContent = (found.name || found.NAME || 'U').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('greeting-name').textContent = (found.name || found.NAME || 'there').split(' ')[0];

  showAPIStatus(BACKEND_AVAILABLE);

  if (roleName === 'worker') {
    document.getElementById('nav-add-asset').style.display = 'none';
  }

  initApp();
  showPage('dashboard');
}

function doLogout() {
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

// ============ NAVIGATION ============
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const breadcrumbs = {
    dashboard: 'Dashboard', assets: 'Asset Registry', 'add-asset': 'Add Asset',
    warranty: 'Warranty Management', amc: 'AMC Tracker', tasks: 'Maintenance Tasks',
    calendar: 'Service Calendar', alerts: 'Alerts', reports: 'Reports & Analytics'
  };
  document.getElementById('topbar-breadcrumb').textContent = breadcrumbs[page] || page;

  if (page === 'assets') renderAssetTable();
  if (page === 'warranty') renderWarrantyGrid();
  if (page === 'amc') renderAmcTable();
  if (page === 'tasks') renderTaskBoard();
  if (page === 'calendar') renderCalendar();
  if (page === 'alerts') renderAlertsPage();
  if (page === 'add-asset') resetAssetForm();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('expanded');
  }
}

async function initApp() {
  // Try to load live data from Google Sheets
  showAPIStatus(false);
  try {
    const [assetRes, taskRes, statsRes] = await Promise.all([
      callAPI('getAssets', {}),
      callAPI('getTasks', {}),
      callAPI('getDashboardStats', {})
    ]);

    if (assetRes.success && assetRes.data && assetRes.data.length > 0) {
      // Map sheet column names → local camelCase keys
      ASSETS = assetRes.data.map(a => ({
        id: a.ASSET_ID, name: a.ASSET_NAME,
        category: a.CATEGORY, subcategory: a.SUBCATEGORY,
        mainLocation: a.MAIN_LOCATION, subLocation: a.SUB_LOCATION,
        brand: a.BRAND, model: a.MODEL, serial: a.SERIAL_NO,
        installDate: a.INSTALL_DATE, condition: a.CONDITION, status: a.STATUS,
        purchaseCost: Number(a.PURCHASE_COST) || 0,
        replacementCost: Number(a.REPLACEMENT_COST) || 0,
        quantity: a.QUANTITY || 1, unit: a.UNIT || 'Nos',
        warrantyAvailable: a.WARRANTY_AVAILABLE === 'Yes',
        warrantyType: a.WARRANTY_TYPE, warrantyProvider: a.WARRANTY_PROVIDER,
        warrantyStart: a.WARRANTY_START, warrantyEnd: a.WARRANTY_END,
        warrantyContact: a.WARRANTY_CONTACT,
        warrantyStatus: a.WARRANTY_STATUS || 'N/A',
        amcRequired: a.AMC_REQUIRED === 'Yes',
        amcVendor: a.AMC_VENDOR, amcType: a.AMC_TYPE,
        amcStart: a.AMC_START, amcEnd: a.AMC_END,
        amcCost: Number(a.AMC_COST) || 0,
        amcFrequency: a.AMC_FREQUENCY,
        amcStatus: a.AMC_STATUS || 'N/A',
        notes: a.NOTES, addedDate: a.CREATED_AT
      }));
      showToast(`Loaded ${ASSETS.length} assets from Google Sheets`, 'success');
      showAPIStatus(true);
    }

    if (taskRes.success && taskRes.data && taskRes.data.length > 0) {
      // Replace demo tasks with live ones — keep demo if sheet empty
      const liveTasks = taskRes.data.map(t => ({
        id: t.TASK_ID, assetId: t.ASSET_ID, assetName: t.ASSET_NAME,
        issue: t.ISSUE_TYPE, desc: t.DESCRIPTION,
        worker: t.ASSIGNED_WORKER, status: t.STATUS,
        priority: t.PRIORITY || 'Normal',
        date: t.TASK_DATE, location: t.ASSET_NAME
      }));
      if (liveTasks.length > 0) {
        TASKS_DATA.length = 0;
        liveTasks.forEach(t => TASKS_DATA.push(t));
      }
    }

    // Update KPI badges from live stats
    if (statsRes.success && statsRes.stats) {
      const s = statsRes.stats;
      document.getElementById('alert-badge').textContent = s.expiringWarranty + s.expiringAmc || '0';
      document.getElementById('task-badge').textContent = s.pendingTasks || '0';
    }

  } catch (err) {
    console.warn('[TAIMS] Could not load live data:', err);
  }

  // Always render dashboard (with live or demo data)
  renderTowerGrid();
  renderDashboardAlerts();
  renderRecentActivity();
  renderDonutChart();
  generateAssetId();
}

// ============ DASHBOARD ============
function renderTowerGrid() {
  const grid = document.getElementById('tower-grid');
  const towerData = [
    { name: 'Tower 1', assets: 94, status: 'good' },
    { name: 'Tower 2', assets: 87, status: 'good' },
    { name: 'Tower 3', assets: 92, status: 'critical' },
    { name: 'Tower 4', assets: 89, status: 'good' },
    { name: 'Tower 5', assets: 91, status: 'good' },
    { name: 'Tower 6', assets: 85, status: 'good' },
    { name: 'Tower 7', assets: 93, status: 'critical' },
    { name: 'Tower 8', assets: 88, status: 'good' },
    { name: 'Tower 9', assets: 90, status: 'good' },
  ];

  grid.innerHTML = towerData.map(t => `
    <div class="tower-block ${t.status === 'critical' ? 'has-critical' : ''}" onclick="filterByTower('${t.name}')">
      <div class="tower-num">${t.name}</div>
      <div class="tower-assets">${t.assets}</div>
      <span class="tower-status ${t.status}">${t.status === 'critical' ? '⚠ Alert' : '✓ OK'}</span>
    </div>
  `).join('');
}

function renderDashboardAlerts() {
  const el = document.getElementById('dashboard-alerts');
  el.innerHTML = ALERTS_DATA.slice(0,5).map(a => `
    <div class="alert-item" onclick="showPage('alerts')">
      <div class="alert-dot ${a.type}"></div>
      <div>
        <div class="alert-text">${a.title}</div>
        <div class="alert-meta">${a.time}</div>
      </div>
    </div>
  `).join('');
}

function renderRecentActivity() {
  const el = document.getElementById('recent-activity');
  const recent = TASKS_DATA.slice(0,6);
  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Task ID</th>
          <th>Asset</th>
          <th>Issue</th>
          <th>Worker</th>
          <th>Status</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${recent.map(t => `
          <tr onclick="viewTask('${t.id}')" style="cursor:pointer">
            <td><span style="font-family:'DM Mono',monospace;font-size:0.78rem;color:#0284c7">${t.id}</span></td>
            <td style="font-weight:500">${t.assetName}</td>
            <td>${t.issue}</td>
            <td>${t.worker}</td>
            <td><span class="badge badge-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></td>
            <td style="color:#64748b;font-size:0.8rem">${formatDate(t.date)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderDonutChart() {
  const canvas = document.getElementById('category-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const total = CATEGORY_COUNTS.reduce((a,b) => a+b, 0);
  const colors = CATEGORY_COLORS;
  let startAngle = -Math.PI / 2;
  const cx = 100, cy = 100, r = 70, innerR = 46;

  ctx.clearRect(0, 0, 200, 200);

  CATEGORY_COUNTS.forEach((val, i) => {
    const angle = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();
    startAngle += angle;
  });

  // Inner circle (donut hole)
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI);
  ctx.fillStyle = 'white';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px DM Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 8);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px DM Sans, sans-serif';
  ctx.fillText('ASSETS', cx, cy + 12);

  const legend = document.getElementById('donut-legend');
  legend.innerHTML = CATEGORY_NAMES.map((n,i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      <span class="legend-label">${n}</span>
      <span class="legend-val">${CATEGORY_COUNTS[i]}</span>
    </div>
  `).join('');
}

// ============ ASSET TABLE ============
let filteredAssets = [];
function renderAssetTable() {
  filteredAssets = [...ASSETS];
  filterAssetTable();
}

function filterAssetTable() {
  const search = (document.getElementById('asset-search')?.value || '').toLowerCase();
  const tower = document.getElementById('filter-tower')?.value || '';
  const cat = document.getElementById('filter-category')?.value || '';
  const cond = document.getElementById('filter-condition')?.value || '';
  const stat = document.getElementById('filter-status')?.value || '';

  filteredAssets = ASSETS.filter(a => {
    if (search && !a.name.toLowerCase().includes(search) && !a.id.toLowerCase().includes(search) && !a.mainLocation.toLowerCase().includes(search)) return false;
    if (tower && !a.mainLocation.includes(tower)) return false;
    if (cat && a.category !== cat) return false;
    if (cond && a.condition !== cond) return false;
    if (stat && a.status !== stat) return false;
    return true;
  });

  // Sort
  filteredAssets.sort((a,b) => {
    let va = a[sortField] || '', vb = b[sortField] || '';
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    return va < vb ? -sortDir : va > vb ? sortDir : 0;
  });

  currentPage = 1;
  renderAssetPage();
}

function renderAssetPage() {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredAssets.slice(start, start + ITEMS_PER_PAGE);
  const tbody = document.getElementById('asset-tbody');
  if (!tbody) return;

  tbody.innerHTML = pageItems.map(a => `
    <tr>
      <td><span style="font-family:'DM Mono',monospace;font-size:0.78rem;color:#0284c7">${a.id}</span></td>
      <td>
        <div style="font-weight:600;font-size:0.875rem;color:#1e293b">${a.name}</div>
        <div style="font-size:0.75rem;color:#94a3b8">${a.subcategory}</div>
      </td>
      <td><span class="badge" style="background:${catColor(a.category)}22;color:${catColor(a.category)}">${a.category}</span></td>
      <td>
        <div style="font-size:0.85rem;font-weight:500">${a.mainLocation}</div>
        <div style="font-size:0.75rem;color:#94a3b8">${a.subLocation}</div>
      </td>
      <td><span class="badge badge-${a.condition.toLowerCase()}">${a.condition}</span></td>
      <td><span class="badge ${a.status==='Active'?'badge-active':a.status==='Under Repair'?'badge-repair':'badge-expired'}">${a.status}</span></td>
      <td><span class="badge ${a.warrantyAvailable ? 'badge-'+a.warrantyStatus : 'badge-na'}">${a.warrantyAvailable ? a.warrantyStatus.charAt(0).toUpperCase() + a.warrantyStatus.slice(1) : 'N/A'}</span></td>
      <td><span class="badge ${a.amcRequired ? 'badge-'+a.amcStatus : 'badge-na'}">${a.amcRequired ? a.amcStatus.charAt(0).toUpperCase() + a.amcStatus.slice(1) : 'N/A'}</span></td>
      <td>
        <button class="tbl-btn primary" onclick="viewAsset('${a.id}')">View</button>
        <button class="tbl-btn" onclick="editAsset('${a.id}')">Edit</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('asset-count').textContent = `Showing ${start+1}–${Math.min(start+ITEMS_PER_PAGE, filteredAssets.length)} of ${filteredAssets.length} assets`;
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredAssets.length / ITEMS_PER_PAGE);
  const pg = document.getElementById('asset-pagination');
  if (!pg) return;
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  pg.innerHTML = html;
}

function goPage(n) { currentPage = n; renderAssetPage(); }

function sortTable(field) {
  if (sortField === field) sortDir *= -1;
  else { sortField = field; sortDir = 1; }
  filterAssetTable();
}

function clearFilters() {
  document.getElementById('asset-search').value = '';
  document.getElementById('filter-tower').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-condition').value = '';
  document.getElementById('filter-status').value = '';
  filterAssetTable();
}

function filterByTower(tower) {
  showPage('assets');
  setTimeout(() => {
    document.getElementById('filter-tower').value = tower;
    filterAssetTable();
  }, 50);
}

function catColor(cat) {
  const map = { Electrical: '#0ea5e9', Mechanical: '#10b981', Civil: '#f59e0b', Misc: '#8b5cf6' };
  return map[cat] || '#64748b';
}

// ============ ASSET DETAIL MODAL ============
function viewAsset(id) {
  const a = ASSETS.find(x => x.id === id);
  if (!a) return;

  const content = document.getElementById('asset-modal-content');
  const categoryIcons = { Electrical: '⚡', Mechanical: '⚙️', Civil: '🏗️', Misc: '📦' };
  const wDays = a.warrantyEnd ? Math.ceil((new Date(a.warrantyEnd) - new Date()) / 86400000) : null;
  const amcDays = a.amcEnd ? Math.ceil((new Date(a.amcEnd) - new Date()) / 86400000) : null;

  content.innerHTML = `
    <div class="asset-detail-header">
      <div class="asset-detail-icon">${categoryIcons[a.category] || '📦'}</div>
      <div style="flex:1">
        <div class="asset-detail-name">${a.name}</div>
        <div class="asset-detail-id">${a.id}</div>
        <div class="asset-detail-location">📍 ${a.mainLocation} › ${a.subLocation}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <span class="badge badge-${a.condition.toLowerCase()}">${a.condition}</span>
        <span class="badge ${a.status==='Active'?'badge-active':a.status==='Under Repair'?'badge-repair':'badge-expired'}">${a.status}</span>
      </div>
    </div>

    <div class="detail-tabs">
      <div class="detail-tab active" onclick="showDetailTab('info', this)">Details</div>
      <div class="detail-tab" onclick="showDetailTab('warranty', this)">Warranty</div>
      <div class="detail-tab" onclick="showDetailTab('amc', this)">AMC</div>
      <div class="detail-tab" onclick="showDetailTab('tasks', this)">Tasks</div>
    </div>

    <div class="detail-tab-content active" id="detail-info">
      <div class="detail-grid">
        <div class="detail-field"><div class="detail-label">Category</div><div class="detail-value">${a.category} › ${a.subcategory}</div></div>
        <div class="detail-field"><div class="detail-label">Brand / Model</div><div class="detail-value">${a.brand} ${a.model}</div></div>
        <div class="detail-field"><div class="detail-label">Serial Number</div><div class="detail-value" style="font-family:'DM Mono',monospace">${a.serial}</div></div>
        <div class="detail-field"><div class="detail-label">Installation Date</div><div class="detail-value">${formatDate(a.installDate)}</div></div>
        <div class="detail-field"><div class="detail-label">Purchase Cost</div><div class="detail-value">₹${a.purchaseCost.toLocaleString('en-IN')}</div></div>
        <div class="detail-field"><div class="detail-label">Replacement Cost</div><div class="detail-value">₹${a.replacementCost.toLocaleString('en-IN')}</div></div>
        <div class="detail-field"><div class="detail-label">Quantity</div><div class="detail-value">${a.quantity} ${a.unit}</div></div>
        <div class="detail-field"><div class="detail-label">Added Date</div><div class="detail-value">${formatDate(a.addedDate)}</div></div>
      </div>
    </div>

    <div class="detail-tab-content" id="detail-warranty">
      ${a.warrantyAvailable ? `
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value"><span class="badge badge-${a.warrantyStatus}">${a.warrantyStatus.charAt(0).toUpperCase()+a.warrantyStatus.slice(1)}</span></div></div>
          <div class="detail-field"><div class="detail-label">Type</div><div class="detail-value">${a.warrantyType}</div></div>
          <div class="detail-field"><div class="detail-label">Provider</div><div class="detail-value">${a.warrantyProvider}</div></div>
          <div class="detail-field"><div class="detail-label">Contact</div><div class="detail-value">${a.warrantyContact}</div></div>
          <div class="detail-field"><div class="detail-label">Start Date</div><div class="detail-value">${formatDate(a.warrantyStart)}</div></div>
          <div class="detail-field"><div class="detail-label">End Date</div><div class="detail-value">${formatDate(a.warrantyEnd)}</div></div>
          ${wDays !== null ? `<div class="detail-field" style="grid-column:span 2"><div class="detail-label">Days Remaining</div><div class="detail-value" style="font-size:1.2rem;font-weight:700;font-family:'DM Mono',monospace;color:${wDays > 30 ? '#10b981' : wDays > 0 ? '#f59e0b' : '#ef4444'}">${wDays > 0 ? wDays + ' days' : 'Expired'}</div></div>` : ''}
        </div>
        <div style="margin-top:1rem">
          <button class="btn-secondary" onclick="raiseWarrantyClaim('${a.id}')">📋 Raise Warranty Claim</button>
        </div>
      ` : '<div style="text-align:center;padding:2rem;color:#94a3b8">No warranty information available</div>'}
    </div>

    <div class="detail-tab-content" id="detail-amc">
      ${a.amcRequired ? `
        <div class="detail-grid">
          <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value"><span class="badge badge-${a.amcStatus}">${a.amcStatus.charAt(0).toUpperCase()+a.amcStatus.slice(1)}</span></div></div>
          <div class="detail-field"><div class="detail-label">Type</div><div class="detail-value">${a.amcType}</div></div>
          <div class="detail-field"><div class="detail-label">Vendor</div><div class="detail-value">${a.amcVendor}</div></div>
          <div class="detail-field"><div class="detail-label">Frequency</div><div class="detail-value">${a.amcFrequency}</div></div>
          <div class="detail-field"><div class="detail-label">AMC Period</div><div class="detail-value">${formatDate(a.amcStart)} → ${formatDate(a.amcEnd)}</div></div>
          <div class="detail-field"><div class="detail-label">Annual Cost</div><div class="detail-value">₹${a.amcCost.toLocaleString('en-IN')}</div></div>
          ${amcDays !== null ? `<div class="detail-field" style="grid-column:span 2"><div class="detail-label">Days Until Expiry</div><div class="detail-value" style="font-size:1.2rem;font-weight:700;font-family:'DM Mono',monospace;color:${amcDays > 30 ? '#10b981' : amcDays > 0 ? '#f59e0b' : '#ef4444'}">${amcDays > 0 ? amcDays + ' days' : 'Expired'}</div></div>` : ''}
        </div>
        <div style="margin-top:1rem">
          <button class="btn-secondary" onclick="updateAmcService('${a.id}')">🔧 Update AMC Service</button>
        </div>
      ` : '<div style="text-align:center;padding:2rem;color:#94a3b8">No AMC assigned to this asset</div>'}
    </div>

    <div class="detail-tab-content" id="detail-tasks">
      ${TASKS_DATA.filter(t => t.assetId === a.id || t.assetName === a.name).map(t => `
        <div class="alert-page-item" style="margin-bottom:8px">
          <div class="alert-icon-wrap ${t.priority==='Urgent'?'red':t.priority==='High'?'amber':'blue'}">${t.issue==='Breakdown'?'⚠️':t.issue==='Preventive'?'🔧':'📋'}</div>
          <div class="alert-content">
            <div class="alert-title">${t.id} — ${t.issue}</div>
            <div class="alert-body">${t.desc}</div>
            <div class="alert-time">${t.worker} · ${formatDate(t.date)} · <span class="badge badge-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></div>
          </div>
        </div>
      `).join('') || '<div style="text-align:center;padding:2rem;color:#94a3b8">No maintenance tasks for this asset</div>'}
    </div>

    <div class="modal-actions">
      <div class="qr-placeholder">
        <svg width="40" height="40" viewBox="0 0 100 100"><rect x="10" y="10" width="30" height="30" fill="none" stroke="#94a3b8" stroke-width="8"/><rect x="60" y="10" width="30" height="30" fill="none" stroke="#94a3b8" stroke-width="8"/><rect x="10" y="60" width="30" height="30" fill="none" stroke="#94a3b8" stroke-width="8"/><rect x="17" y="17" width="16" height="16" fill="#94a3b8"/><rect x="67" y="17" width="16" height="16" fill="#94a3b8"/><rect x="17" y="67" width="16" height="16" fill="#94a3b8"/><rect x="60" y="60" width="8" height="8" fill="#94a3b8"/><rect x="75" y="60" width="8" height="8" fill="#94a3b8"/><rect x="60" y="75" width="8" height="8" fill="#94a3b8"/></svg>
        QR Code
      </div>
      <button class="btn-secondary" onclick="editAsset('${a.id}');closeModal('asset-modal')">Edit Asset</button>
      <button class="btn-primary" onclick="openTaskModal('${a.id}')">Create Task</button>
    </div>
  `;

  openModal('asset-modal');
}

function showDetailTab(tab, el) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.detail-tab-content').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('detail-' + tab)?.classList.add('active');
}

// ============ ADD / EDIT ASSET FORM ============
let currentFormStep = 1;

function resetAssetForm() {
  currentFormStep = 1;
  editingAssetId = null;
  document.getElementById('asset-form-title').textContent = 'Add New Asset';
  document.querySelectorAll('.form-step-content').forEach(s => s.classList.remove('active'));
  document.getElementById('step-1').classList.add('active');
  document.querySelectorAll('.step').forEach(s => { s.classList.remove('active','done'); });
  document.querySelector('[data-step="1"]').classList.add('active');
  generateAssetId();
}

function editAsset(id) {
  const a = ASSETS.find(x => x.id === id);
  if (!a) return;
  editingAssetId = id;
  showPage('add-asset');
  document.getElementById('asset-form-title').textContent = 'Edit Asset';

  setTimeout(() => {
    document.getElementById('asset-id').value = a.id;
    document.getElementById('asset-name').value = a.name;
    document.getElementById('asset-brand').value = a.brand;
    document.getElementById('asset-model').value = a.model;
    document.getElementById('asset-serial').value = a.serial;
    document.getElementById('asset-install-date').value = a.installDate;
    document.getElementById('asset-status').value = a.status;
    document.getElementById('asset-purchase-cost').value = a.purchaseCost;
    document.getElementById('asset-replacement-cost').value = a.replacementCost;

    document.getElementById('asset-category').value = a.category;
    updateSubcategory();
    setTimeout(() => { document.getElementById('asset-subcategory').value = a.subcategory; }, 50);

    const condRadio = document.querySelector(`input[name="condition"][value="${a.condition}"]`);
    if (condRadio) condRadio.checked = true;

    updatePreview();
  }, 100);
}

function generateAssetId() {
  const now = new Date();
  const yr = String(now.getFullYear()).slice(2);
  const count = ASSETS.length + 1;
  const id = `AST-${yr}-${String(count).padStart(3,'0')}`;
  const el = document.getElementById('asset-id');
  if (el) { el.value = id; updatePreview(); }
}

function updateSubcategory() {
  const cat = document.getElementById('asset-category')?.value;
  const sub = document.getElementById('asset-subcategory');
  if (!sub) return;
  const opts = SUBCATEGORY_MAP[cat] || [];
  sub.innerHTML = `<option value="">Select subcategory</option>` + opts.map(o => `<option>${o}</option>`).join('');
  updatePreview();
}

function updateSubLocation() {
  const main = document.getElementById('main-location')?.value;
  const sub = document.getElementById('sub-location');
  const visual = document.getElementById('location-visual');
  if (!sub) return;

  const locs = SUBLOCATION_MAP[main] || [];
  sub.innerHTML = `<option value="">Select sub-location</option>` + locs.map(l => `<option>${l}</option>`).join('');

  if (main && LOCATION_DETAILS[main]) {
    const d = LOCATION_DETAILS[main];
    visual.innerHTML = `
      <div class="location-info">
        <div class="location-name">📍 ${main}</div>
        <div class="location-detail">${d.lifts} Lifts · ${d.floors} Floors · ${d.flats} Flats</div>
        <div class="location-detail" style="color:#0ea5e9">Served by ${d.gen}</div>
      </div>`;
  } else if (main) {
    visual.innerHTML = `<div class="location-info"><div class="location-name">📍 ${main}</div></div>`;
  } else {
    visual.innerHTML = `<div class="location-placeholder"><p>Select a location to see details</p></div>`;
  }
  updatePreview();
}

function updatePreview() {
  const name = document.getElementById('asset-name')?.value || 'Asset name';
  const id = document.getElementById('asset-id')?.value || 'ID';
  const main = document.getElementById('main-location')?.value || 'Location not set';
  const sub = document.getElementById('sub-location')?.value || '';
  const cond = document.querySelector('input[name="condition"]:checked')?.value || 'Good';

  const pId = document.getElementById('preview-id');
  const pName = document.getElementById('preview-name');
  const pLoc = document.getElementById('preview-location');
  const pCond = document.getElementById('preview-condition');

  if (pId) pId.textContent = id;
  if (pName) pName.textContent = name;
  if (pLoc) pLoc.textContent = sub ? `${main} › ${sub}` : main;
  if (pCond) pCond.innerHTML = `<span class="condition-dot ${cond.toLowerCase()}"></span> ${cond} Condition`;
}

function nextStep(step) {
  const prev = step - 1;
  document.getElementById(`step-${prev}`)?.classList.remove('active');
  document.getElementById(`step-${step}`)?.classList.add('active');

  document.querySelectorAll('.step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active','done');
    if (n < step) s.classList.add('done');
    if (n === step) s.classList.add('active');
  });

  document.querySelectorAll('.help-step').forEach((s,i) => {
    s.classList.toggle('active', i === step - 1);
  });

  currentFormStep = step;
  updatePreview();
}

function prevStep(step) { nextStep(step); }

function toggleWarrantyFields() {
  const on = document.getElementById('warranty-toggle').checked;
  document.getElementById('warranty-fields').style.display = on ? 'block' : 'none';
}

function toggleAmcFields() {
  const on = document.getElementById('amc-toggle').checked;
  document.getElementById('amc-fields').style.display = on ? 'block' : 'none';
}

function calcWarrantyStatus() {
  const start = document.getElementById('warranty-start')?.value;
  const end = document.getElementById('warranty-end')?.value;
  const display = document.getElementById('warranty-status-display');
  if (!end || !display) return;

  const today = new Date();
  const endDate = new Date(end);
  const daysLeft = Math.ceil((endDate - today) / 86400000);

  let status, color;
  if (daysLeft < 0) { status = 'Expired'; color = '#ef4444'; }
  else if (daysLeft <= 30) { status = `Expiring Soon (${daysLeft} days)`; color = '#f59e0b'; }
  else { status = `Active (${daysLeft} days remaining)`; color = '#10b981'; }

  display.textContent = status;
  display.style.color = color;
  display.style.fontStyle = 'normal';
  display.style.fontWeight = '500';
}

function calcAmcStatus() {
  const end = document.getElementById('amc-end')?.value;
  const display = document.getElementById('amc-status-display');
  if (!end || !display) return;

  const today = new Date();
  const endDate = new Date(end);
  const daysLeft = Math.ceil((endDate - today) / 86400000);

  let status, color;
  if (daysLeft < 0) { status = 'Expired'; color = '#ef4444'; }
  else if (daysLeft <= 30) { status = `Expiring Soon (${daysLeft} days)`; color = '#f59e0b'; }
  else { status = `Active (${daysLeft} days remaining)`; color = '#10b981'; }

  display.textContent = status;
  display.style.color = color;
  display.style.fontStyle = 'normal';
  display.style.fontWeight = '500';
  calcNextService();
}

function calcNextService() {
  const freq = document.getElementById('amc-frequency')?.value;
  const last = document.getElementById('amc-last-service')?.value;
  const nextEl = document.getElementById('amc-next-service');
  if (!last || !nextEl) return;

  const lastDate = new Date(last);
  const months = { Monthly: 1, Quarterly: 3, 'Half-Yearly': 6, Yearly: 12 };
  const add = months[freq] || 3;
  lastDate.setMonth(lastDate.getMonth() + add);
  nextEl.value = lastDate.toISOString().split('T')[0];
}

// Holds selected File objects keyed by upload type
const selectedFiles = {};

function triggerFileInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.click();
}

function handleFileSelect(input, type, maxMB) {
  const file = input.files && input.files[0];
  if (!file) return;

  // Size check
  if (file.size > maxMB * 1024 * 1024) {
    showToast(`File too large. Maximum size is ${maxMB}MB.`, 'error');
    input.value = '';
    return;
  }

  // Store the file for upload on save
  selectedFiles[type] = file;

  // Update UI
  const zone = document.getElementById(`upload-${type}`);
  const status = document.getElementById(`upload-${type}-status`);
  if (zone) zone.classList.add('uploaded');
  if (status) {
    const shortName = file.name.length > 28 ? file.name.substring(0, 25) + '\u2026' : file.name;
    status.textContent = `\u2713 ${shortName} (${(file.size / 1024).toFixed(0)} KB) \u2014 ready to upload`;
  }
  showToast(`${file.name} selected \u2014 will upload on save`, 'success');
}

// Legacy alias kept in case anything else references it
function simulateUpload(type) {
  triggerFileInput(`file-${type}`);
}

async function saveAsset() {
  const name = document.getElementById('asset-name')?.value?.trim();
  if (!name) { showToast('Please enter an asset name', 'error'); return; }

  const btn = document.querySelector('#step-4 .btn-success');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }

  const warrantyOn = document.getElementById('warranty-toggle')?.checked;
  const amcOn = document.getElementById('amc-toggle')?.checked;

  const payload = {
    ASSET_NAME: name,
    CATEGORY: document.getElementById('asset-category')?.value || 'Misc',
    SUBCATEGORY: document.getElementById('asset-subcategory')?.value || '',
    MAIN_LOCATION: document.getElementById('main-location')?.value || 'Common Area',
    SUB_LOCATION: document.getElementById('sub-location')?.value || '',
    BRAND: document.getElementById('asset-brand')?.value || '',
    MODEL: document.getElementById('asset-model')?.value || '',
    SERIAL_NO: document.getElementById('asset-serial')?.value || '',
    INSTALL_DATE: document.getElementById('asset-install-date')?.value || '',
    CONDITION: document.querySelector('input[name="condition"]:checked')?.value || 'Good',
    STATUS: document.getElementById('asset-status')?.value || 'Active',
    PURCHASE_COST: parseInt(document.getElementById('asset-purchase-cost')?.value) || 0,
    REPLACEMENT_COST: parseInt(document.getElementById('asset-replacement-cost')?.value) || 0,
    QUANTITY: parseInt(document.getElementById('asset-qty')?.value) || 1,
    UNIT: document.getElementById('asset-unit')?.value || 'Nos',
    WARRANTY_AVAILABLE: warrantyOn ? 'Yes' : 'No',
    WARRANTY_TYPE: warrantyOn ? (document.getElementById('warranty-type')?.value || '') : '',
    WARRANTY_START: warrantyOn ? (document.getElementById('warranty-start')?.value || '') : '',
    WARRANTY_END: warrantyOn ? (document.getElementById('warranty-end')?.value || '') : '',
    WARRANTY_PROVIDER: warrantyOn ? (document.getElementById('warranty-provider')?.value || '') : '',
    WARRANTY_CONTACT: warrantyOn ? (document.getElementById('warranty-contact')?.value || '') : '',
    AMC_REQUIRED: amcOn ? 'Yes' : 'No',
    AMC_VENDOR: amcOn ? (document.getElementById('amc-vendor')?.value || '') : '',
    AMC_TYPE: amcOn ? (document.getElementById('amc-type')?.value || '') : '',
    AMC_START: amcOn ? (document.getElementById('amc-start')?.value || '') : '',
    AMC_END: amcOn ? (document.getElementById('amc-end')?.value || '') : '',
    AMC_COST: amcOn ? (parseInt(document.getElementById('amc-cost')?.value) || 0) : 0,
    AMC_FREQUENCY: amcOn ? (document.getElementById('amc-frequency')?.value || '') : '',
    AMC_LAST_SERVICE: amcOn ? (document.getElementById('amc-last-service')?.value || '') : '',
    AMC_CONTACT: amcOn ? (document.getElementById('amc-contact')?.value || '') : '',
    NOTES: document.getElementById('asset-notes')?.value || '',
    ADDED_BY: currentUser?.email || currentUser?.EMAIL || 'admin'
  };

  let result;
  if (editingAssetId) {
    payload.ASSET_ID = editingAssetId;
    result = await callAPI('updateAsset', payload);
  } else {
    result = await callAPI('addAsset', payload);
  }

  if (btn) { btn.textContent = '💾 Save Asset'; btn.disabled = false; }

  if (result.success) {
    // Also update local demo array for instant UI refresh
    if (!editingAssetId) {
      const newId = result.assetId || document.getElementById('asset-id')?.value;
      ASSETS.push({
        id: newId, name, ...payload,
        category: payload.CATEGORY, subcategory: payload.SUBCATEGORY,
        mainLocation: payload.MAIN_LOCATION, subLocation: payload.SUB_LOCATION,
        brand: payload.BRAND, model: payload.MODEL, condition: payload.CONDITION,
        status: payload.STATUS, purchaseCost: payload.PURCHASE_COST,
        warrantyAvailable: warrantyOn, warrantyStatus: warrantyOn ? 'active' : 'N/A',
        amcRequired: amcOn, amcStatus: amcOn ? 'active' : 'N/A',
        serial: payload.SERIAL_NO, installDate: payload.INSTALL_DATE,
        addedDate: new Date().toISOString().split('T')[0]
      });
      showToast(`Asset saved to Google Sheets! ID: ${result.assetId || 'auto'}`, 'success');
    } else {
      showToast('Asset updated in Google Sheets ✓', 'success');
    }
  } else if (result.offline) {
    // Offline — save locally only
    if (!editingAssetId) {
      const id = document.getElementById('asset-id')?.value;
      ASSETS.push({ id, name, category: payload.CATEGORY, subcategory: payload.SUBCATEGORY,
        mainLocation: payload.MAIN_LOCATION, subLocation: payload.SUB_LOCATION,
        brand: payload.BRAND, model: payload.MODEL, condition: payload.CONDITION,
        status: payload.STATUS, purchaseCost: payload.PURCHASE_COST,
        warrantyAvailable: warrantyOn, warrantyStatus: 'N/A',
        amcRequired: amcOn, amcStatus: 'N/A', addedDate: new Date().toISOString().split('T')[0]
      });
    }
    showToast('Saved locally (offline). Will sync when connected.', 'warning');
  } else {
    showToast('Error saving: ' + (result.error || 'Unknown error'), 'error');
    return;
  }

  setTimeout(() => showPage('assets'), 600);
}

// ============ WARRANTY ============
function renderWarrantyGrid() {
  const grid = document.getElementById('warranty-grid');
  if (!grid) return;
  const warrantied = ASSETS.filter(a => a.warrantyAvailable);

  grid.innerHTML = warrantied.map(a => {
    const today = new Date();
    const end = new Date(a.warrantyEnd);
    const daysLeft = Math.ceil((end - today) / 86400000);
    const totalDays = a.warrantyStart ? Math.ceil((end - new Date(a.warrantyStart)) / 86400000) : 365;
    const usedDays = totalDays - daysLeft;
    const pct = Math.max(0, Math.min(100, (usedDays / totalDays) * 100));

    return `
      <div class="warranty-card ${a.warrantyStatus}" onclick="viewAsset('${a.id}')">
        <div class="wc-header">
          <div>
            <div class="wc-asset-name">${a.name}</div>
            <div class="wc-id">${a.id}</div>
          </div>
          <span class="badge badge-${a.warrantyStatus}">${a.warrantyStatus.charAt(0).toUpperCase()+a.warrantyStatus.slice(1)}</span>
        </div>
        <div class="wc-details">
          <div class="wc-detail">📍 ${a.mainLocation}</div>
          <div class="wc-detail">🏭 <strong>${a.warrantyProvider}</strong></div>
          <div class="wc-detail">📅 Expires: <strong>${formatDate(a.warrantyEnd)}</strong></div>
          <div class="wc-detail">☎️ ${a.warrantyContact}</div>
        </div>
        <div class="warranty-progress">
          <div class="wp-bar ${a.warrantyStatus}" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#94a3b8;margin-bottom:0.5rem">
          <span>${formatDate(a.warrantyStart)}</span>
          <span style="font-weight:600;color:${daysLeft > 30 ? '#10b981' : daysLeft > 0 ? '#f59e0b' : '#ef4444'}">${daysLeft > 0 ? daysLeft + ' days left' : Math.abs(daysLeft) + ' days expired'}</span>
          <span>${formatDate(a.warrantyEnd)}</span>
        </div>
        <div class="wc-actions">
          <button class="tbl-btn" onclick="event.stopPropagation();raiseWarrantyClaim('${a.id}')">Raise Claim</button>
          <button class="tbl-btn primary" onclick="event.stopPropagation();viewAsset('${a.id}')">Details</button>
        </div>
      </div>`;
  }).join('');
}

function filterWarranty(type, btn) {
  document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  const grid = document.getElementById('warranty-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.warranty-card');
  cards.forEach(c => {
    if (type === 'all' || c.classList.contains(type)) c.style.display = '';
    else c.style.display = 'none';
  });
}

function raiseWarrantyClaim(id) {
  closeModal('asset-modal');
  showToast('Warranty claim form opened — feature available in full deployment', 'warning');
}

// ============ AMC ============
function renderAmcTable() {
  const tbody = document.getElementById('amc-tbody');
  if (!tbody) return;

  tbody.innerHTML = AMC_DATA.map(a => `
    <tr>
      <td style="font-weight:500">${a.asset}</td>
      <td>${a.vendor}</td>
      <td><span class="badge badge-${a.type === 'Comprehensive' ? 'active' : 'open'}">${a.type}</span></td>
      <td style="font-size:0.8rem">${formatDate(a.start)} → ${formatDate(a.end)}</td>
      <td style="font-family:'DM Mono',monospace;font-weight:600">₹${a.cost.toLocaleString('en-IN')}</td>
      <td style="font-size:0.82rem">${formatDate(a.lastService)}</td>
      <td>
        <span style="font-size:0.82rem;font-weight:600;color:${isOverdue(a.nextDue) ? '#ef4444' : '#0ea5e9'}">${formatDate(a.nextDue)}</span>
        ${isOverdue(a.nextDue) ? '<span style="margin-left:4px;font-size:0.7rem;background:rgba(239,68,68,0.1);color:#ef4444;padding:2px 6px;border-radius:10px">OVERDUE</span>' : ''}
      </td>
      <td><span class="badge badge-${a.status}">${a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span></td>
      <td>
        <button class="tbl-btn primary" onclick="updateAmcService('${a.assetId}')">Update</button>
        <button class="tbl-btn" onclick="viewAsset('${a.assetId}')">View</button>
      </td>
    </tr>
  `).join('');
}

function filterAmc(type, btn) {
  document.querySelectorAll('.status-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

function updateAmcService(id) {
  closeModal('asset-modal');
  showToast('AMC service update logged. Upload photo to complete.', 'success');
}

function isOverdue(dateStr) {
  return dateStr && new Date(dateStr) < new Date();
}

// ============ TASKS / KANBAN ============
function renderTaskBoard() {
  const cols = { Open: 'col-open', 'In Progress': 'col-inprogress', Completed: 'col-completed' };
  const counts = { Open: 0, 'In Progress': 0, Completed: 0 };
  const categoryIcons = { Breakdown: '🔴', Preventive: '🔵', Inspection: '🟡', 'AMC Service': '🟢', Emergency: '⚠️', Repair: '🔧' };

  Object.values(cols).forEach(c => { const el = document.getElementById(c); if (el) el.innerHTML = ''; });

  TASKS_DATA.forEach(t => {
    counts[t.status] = (counts[t.status] || 0) + 1;
    const col = document.getElementById(cols[t.status]);
    if (!col) return;
    col.innerHTML += `
      <div class="task-card" onclick="viewTask('${t.id}')">
        <div class="task-card-id">${t.id}</div>
        <div class="task-card-title">${categoryIcons[t.issue] || '📋'} ${t.desc.slice(0,60)}${t.desc.length > 60 ? '...' : ''}</div>
        <div class="task-card-asset">📍 ${t.location}</div>
        <div class="task-card-footer">
          <div class="task-worker">
            <div class="worker-avatar">${t.worker.split(' ').map(n=>n[0]).join('')}</div>
            ${t.worker.split(' ')[0]}
          </div>
          <span class="priority-badge priority-${t.priority.toLowerCase()}">${t.priority}</span>
        </div>
      </div>`;
  });

  document.getElementById('open-count').textContent = counts['Open'] || 0;
  document.getElementById('inprogress-count').textContent = counts['In Progress'] || 0;
  document.getElementById('completed-count').textContent = counts['Completed'] || 0;
}

function openTaskModal(assetId) {
  closeModal('asset-modal');
  const select = document.getElementById('task-asset');
  if (select) {
    select.innerHTML = `<option value="">Select asset</option>` + ASSETS.slice(0,10).map(a => `<option value="${a.id}" ${a.id === assetId ? 'selected' : ''}>${a.name} (${a.id})</option>`).join('');
  }
  openModal('task-modal');
}

async function saveTask() {
  const assetId = document.getElementById('task-asset')?.value;
  const desc = document.getElementById('task-desc')?.value?.trim();
  if (!assetId || !desc) { showToast('Please fill in required fields', 'error'); return; }

  const btn = document.querySelector('#task-modal .btn-primary');
  if (btn) { btn.textContent = 'Creating…'; btn.disabled = true; }

  const assetName = ASSETS.find(a => a.id === assetId)?.name || '';
  const payload = {
    ASSET_ID: assetId,
    ASSET_NAME: assetName,
    ISSUE_TYPE: document.getElementById('task-issue')?.value || 'Breakdown',
    DESCRIPTION: desc,
    ASSIGNED_WORKER: document.getElementById('task-worker')?.value || 'Unassigned',
    PRIORITY: document.getElementById('task-priority')?.value || 'Normal',
    SUPERVISOR: currentUser?.name || '',
    CREATED_BY: currentUser?.email || ''
  };

  const result = await callAPI('addTask', payload);

  if (btn) { btn.textContent = 'Create Task'; btn.disabled = false; }

  const id = (result.success && result.taskId) ? result.taskId : `TSK-${String(TASKS_DATA.length+1).padStart(3,'0')}`;

  TASKS_DATA.push({
    id, assetId, assetName,
    issue: payload.ISSUE_TYPE, desc,
    worker: payload.ASSIGNED_WORKER,
    status: 'Open',
    priority: payload.PRIORITY,
    date: new Date().toISOString().split('T')[0],
    location: ''
  });

  closeModal('task-modal');
  if (result.success) showToast(`Task ${id} created in Google Sheets ✓`, 'success');
  else if (result.offline) showToast(`Task created locally (offline)`, 'warning');
  else showToast('Task created', 'success');

  document.getElementById('task-badge').textContent = TASKS_DATA.filter(t => t.status === 'Open').length;
  if (document.getElementById('page-tasks')?.classList.contains('active')) renderTaskBoard();
}

function viewTask(id) {
  const t = TASKS_DATA.find(x => x.id === id);
  if (!t) return;
  showToast(`Task ${id}: ${t.issue} — ${t.status}`, 'success');
}

// ============ CALENDAR ============
function renderCalendar() {
  const el = document.getElementById('calendar-grid');
  if (!el) return;

  const monthLabel = document.getElementById('cal-month-label');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (monthLabel) monthLabel.textContent = `${months[currentCalMonth]} ${currentCalYear}`;

  const firstDay = new Date(currentCalYear, currentCalMonth, 1).getDay();
  const daysInMonth = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
  const today = new Date();

  // Generate events for calendar
  const events = {};
  AMC_DATA.forEach(a => {
    const d = new Date(a.nextDue);
    if (d.getMonth() === currentCalMonth && d.getFullYear() === currentCalYear) {
      const key = d.getDate();
      if (!events[key]) events[key] = [];
      events[key].push({ label: a.asset.split(' — ')[0].slice(0,18), type: isOverdue(a.nextDue) ? 'overdue' : 'amc' });
    }
  });
  TASKS_DATA.forEach(t => {
    const d = new Date(t.date);
    if (d.getMonth() === currentCalMonth && d.getFullYear() === currentCalYear) {
      const key = d.getDate();
      if (!events[key]) events[key] = [];
      events[key].push({ label: t.id, type: 'task' });
    }
  });

  let html = `
    <div class="cal-header">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-day-name">${d}</div>`).join('')}
    </div>
    <div class="cal-body">`;

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell other-month"><div class="cal-date" style="opacity:0">${new Date(currentCalYear, currentCalMonth, 0).getDate() - firstDay + i + 1}</div></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getDate() === d && today.getMonth() === currentCalMonth && today.getFullYear() === currentCalYear;
    const dayEvents = events[d] || [];
    html += `
      <div class="cal-cell ${isToday ? 'today' : ''}" onclick="showCalEvents(${d})">
        <div class="cal-date">${d}</div>
        <div class="cal-events">
          ${dayEvents.slice(0,3).map(e => `<div class="cal-event ${e.type}">${e.label}</div>`).join('')}
          ${dayEvents.length > 3 ? `<div class="cal-event amc">+${dayEvents.length - 3} more</div>` : ''}
        </div>
      </div>`;
  }

  html += `</div>`;
  el.innerHTML = html;
}

function prevMonth() {
  currentCalMonth--;
  if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; }
  renderCalendar();
}

function nextMonth() {
  currentCalMonth++;
  if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
  renderCalendar();
}

function showCalEvents(day) {
  const panel = document.getElementById('cal-event-panel');
  if (!panel) return;

  const dateStr = `${currentCalYear}-${String(currentCalMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const amcEvents = AMC_DATA.filter(a => {
    const d = new Date(a.nextDue);
    return d.getDate() === day && d.getMonth() === currentCalMonth && d.getFullYear() === currentCalYear;
  });
  const taskEvents = TASKS_DATA.filter(t => {
    const d = new Date(t.date);
    return d.getDate() === day && d.getMonth() === currentCalMonth && d.getFullYear() === currentCalYear;
  });

  if (amcEvents.length === 0 && taskEvents.length === 0) { panel.classList.remove('visible'); return; }

  panel.classList.add('visible');
  panel.innerHTML = `
    <h3 style="font-size:0.95rem;font-weight:600;margin-bottom:1rem">Events for ${formatDate(dateStr)}</h3>
    ${amcEvents.map(a => `
      <div class="alert-page-item" style="margin-bottom:8px">
        <div class="alert-icon-wrap blue">🔧</div>
        <div class="alert-content">
          <div class="alert-title">AMC Service Due: ${a.asset}</div>
          <div class="alert-body">${a.vendor} · ${a.freq} service · ${a.type}</div>
        </div>
      </div>`).join('')}
    ${taskEvents.map(t => `
      <div class="alert-page-item" style="margin-bottom:8px">
        <div class="alert-icon-wrap ${t.priority === 'Urgent' ? 'red' : 'amber'}">📋</div>
        <div class="alert-content">
          <div class="alert-title">${t.id}: ${t.issue}</div>
          <div class="alert-body">${t.desc}</div>
          <div class="alert-time">${t.worker} · <span class="badge badge-${t.status.toLowerCase().replace(' ','')}">${t.status}</span></div>
        </div>
      </div>`).join('')}`;
}

// ============ ALERTS ============
function renderAlertsPage() {
  const list = document.getElementById('alerts-page-list');
  if (!list) return;

  list.innerHTML = ALERTS_DATA.map(a => `
    <div class="alert-page-item ${a.unread ? 'unread' : ''} ${a.type === 'amber' ? 'warning' : a.type === 'blue' ? 'info' : ''}">
      <div class="alert-icon-wrap ${a.type}">
        ${a.category === 'warranty' ? '🛡️' : a.category === 'amc' ? '🔧' : a.category === 'task' ? '📋' : '⚠️'}
      </div>
      <div class="alert-content">
        <div class="alert-title">${a.title}</div>
        <div class="alert-body">${a.body}</div>
        <div class="alert-time">${a.time}</div>
      </div>
      ${a.unread ? '<span class="badge-count">New</span>' : ''}
    </div>
  `).join('');
}

function markAllRead() {
  ALERTS_DATA.forEach(a => a.unread = false);
  renderAlertsPage();
  document.getElementById('alert-badge').textContent = '0';
  showToast('All alerts marked as read', 'success');
}

// ============ REPORTS ============
function generateReport(type) {
  const types = {
    full: 'Full Asset Report',
    tower: 'Tower-wise Report',
    amc: 'AMC Report',
    warranty: 'Warranty Report',
    maintenance: 'Maintenance History',
    critical: 'Critical Assets Report'
  };

  showToast(`Generating ${types[type]}... Download will start shortly`, 'success');

  // Simulate CSV export
  setTimeout(() => {
    let csvData = [];
    if (type === 'full' || type === 'tower') {
      csvData = ASSETS.map(a => [a.id, a.name, a.category, a.mainLocation, a.subLocation, a.condition, a.status, a.brand, a.model, a.purchaseCost].join(','));
      csvData.unshift('Asset ID,Name,Category,Location,Sub-Location,Condition,Status,Brand,Model,Purchase Cost');
    } else if (type === 'amc') {
      csvData = AMC_DATA.map(a => [a.assetId, a.asset, a.vendor, a.type, a.start, a.end, a.cost, a.lastService, a.nextDue, a.status].join(','));
      csvData.unshift('Asset ID,Asset,Vendor,Type,Start,End,Annual Cost,Last Service,Next Due,Status');
    }

    if (csvData.length > 0) {
      const blob = new Blob([csvData.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TAIMS_${type}_report_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Report downloaded!', 'success');
    }
  }, 800);
}

// ============ GLOBAL SEARCH ============
function globalSearch(q) {
  if (q.length < 2) return;
  // Quick show assets page with search applied
  if (document.getElementById('page-assets')?.classList.contains('active')) {
    document.getElementById('asset-search').value = q;
    filterAssetTable();
  }
}

// ============ FILTER HELPERS ============
function filterAssets(condition) { showPage('assets'); setTimeout(() => { document.getElementById('filter-condition').value = condition; filterAssetTable(); }, 50); }
function filterTasks(status) { showPage('tasks'); }
function filterTower(val) { if (val) filterByTower(val); }
function exportAssets() { generateReport('full'); }

// ============ MODAL HELPERS ============
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

// ============ TOAST ============
let toastTimer;
function showToast(msg, type = 'default') {
  const toast = document.getElementById('toast');
  toast.textContent = '';
  const icon = { success: '✓', error: '✕', warning: '⚠' };
  if (icon[type]) { const i = document.createElement('span'); i.textContent = icon[type]; toast.appendChild(i); }
  toast.appendChild(document.createTextNode(' ' + msg));
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ============ UTILS ============
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.querySelector('.sidebar.mobile-open')?.classList.remove('mobile-open');
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('global-search')?.focus();
  }
});

// Live preview on form inputs
document.addEventListener('input', e => {
  if (['asset-name','asset-id'].includes(e.target?.id)) updatePreview();
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  // Auto demo login for quick access
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';

  // Drag-and-drop for upload zones
  const dropConfigs = [
    { zoneId: 'upload-image',       inputId: 'file-image',       type: 'image',       maxMB: 5  },
    { zoneId: 'upload-invoice',     inputId: 'file-invoice',     type: 'invoice',     maxMB: 10 },
    { zoneId: 'upload-warranty-doc',inputId: 'file-warranty-doc',type: 'warranty-doc',maxMB: 10 },
    { zoneId: 'upload-amc-doc',     inputId: 'file-amc-doc',     type: 'amc-doc',     maxMB: 10 },
  ];

  dropConfigs.forEach(({ zoneId, inputId, type, maxMB }) => {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      // Inject file into the hidden input then call handler
      const input = document.getElementById(inputId);
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect(input, type, maxMB);
      }
    });
  });
});

// EXPOSE TO HTML
window.quickLogin = quickLogin;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.showPage = showPage;
window.toggleSidebar = toggleSidebar;
window.viewAsset = viewAsset;
window.editAsset = editAsset;
window.filterAssetTable = filterAssetTable;
window.clearFilters = clearFilters;
window.filterByTower = filterByTower;
window.sortTable = sortTable;
window.goPage = goPage;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.updateSubcategory = updateSubcategory;
window.updateSubLocation = updateSubLocation;
window.toggleWarrantyFields = toggleWarrantyFields;
window.toggleAmcFields = toggleAmcFields;
window.calcWarrantyStatus = calcWarrantyStatus;
window.calcAmcStatus = calcAmcStatus;
window.calcNextService = calcNextService;
window.simulateUpload = simulateUpload;
window.triggerFileInput = triggerFileInput;
window.handleFileSelect = handleFileSelect;
window.saveAsset = saveAsset;
window.filterWarranty = filterWarranty;
window.filterAmc = filterAmc;
window.raiseWarrantyClaim = raiseWarrantyClaim;
window.updateAmcService = updateAmcService;
window.openTaskModal = openTaskModal;
window.saveTask = saveTask;
window.viewTask = viewTask;
window.prevMonth = prevMonth;
window.nextMonth = nextMonth;
window.showCalEvents = showCalEvents;
window.markAllRead = markAllRead;
window.generateReport = generateReport;
window.globalSearch = globalSearch;
window.filterAssets = filterAssets;
window.filterTasks = filterTasks;
window.filterTower = filterTower;
window.exportAssets = exportAssets;
window.openModal = openModal;
window.closeModal = closeModal;
window.showDetailTab = showDetailTab;
