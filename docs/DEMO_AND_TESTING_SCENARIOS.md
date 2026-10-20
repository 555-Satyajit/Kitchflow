# KitchenOS: Client Demo & QA Testing Playbook

A structured, battle-tested scenario walkthrough to test every feature and demonstrate the system to prospective multi-brand cloud kitchen operators, investors, and operations managers.

---

## Quick Reference Summary Table

| Scenario # | Title | Primary Persona | Route | Core Value Prop Demonstrated |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Margin Engine Reconciliation** | Owner / CFO | [`/margins`](file:///c:/projects/Kitchenos/src/app/margins/page.tsx) | Unmasks hidden aggregator costs with integer paise precision. |
| **02** | **Smart Auto-86 & BOM Portion Threshold** | Store Manager | [`/inventory`](file:///c:/projects/Kitchenos/src/app/inventory/page.tsx) | Disables dishes when ingredients fall below 1 portion BOM or min safe buffer. |
| **03** | **KDS Live Countdown & Overdue Alarm** | Line Cook / Expediter | [`/kds`](file:///c:/projects/Kitchenos/src/app/kds/page.tsx) | Live countdown with "left" suffix, color urgency, sound siren, and manager alert banner. |
| **04** | **Cook Station Auto-Focus & Multi-Routing** | Line Cook | [`/kds`](file:///c:/projects/Kitchenos/src/app/kds/page.tsx) | Cooks land directly on their station (e.g. Dum Biryani) with 54px+ touch cards. |
| **05** | **Dynamic Dispatch QA & Seal Prevention** | Dispatcher / Rider Lead | [`/packing`](file:///c:/projects/Kitchenos/src/app/packing/page.tsx) | Order cannot be handed over until KDS is 100% complete; dynamic beverage QA checks. |
| **06** | **Emergency Kitchen Pause (Swiggy / Zomato)** | Shift Manager | Top Header | One-tap panic switch to halt incoming orders during rushes or power failure. |
| **07** | **Role-Based Access Guard** | Owner vs Cook | Header Role Toggle | Restricts kitchen floor cooks to KDS & Dispatch only; keeps margins confidential. |
| **08** | **Bilingual Kitchen Interface** | Cook / Helper | Header Lang Toggle | Seamless English $\leftrightarrow$ Hindi toggle (e.g. *केडीएस कुक, पैकिंग व डिस्पैच*). |

---

## Scenario 01: The Transparent Margin Engine (Unit Economics)

### 🎯 Demo Objective
Show how KitchenOS eliminates the "black box" of Swiggy and Zomato payouts by proving every single rupee and paise in real time.

### 📍 Route
Navigate to **Profit & Margins** (`/margins`).

### 🎬 Walkthrough Steps
1. **Inspect Shift Overview Card**:
   - Observe the top banner displaying Gross Inflows, Total Platform Commission, Customer Discounts, Recipe Raw BOM, Packaging Materials, and **Net Contribution Margin**.
   - Note the mathematical integrity: Net Margin matches `Gross Revenue - (Commission + Discounts + BOM + Packaging)`.
2. **Interactive Configuration Drawer**:
   - Tap **"Settings & Rules"** at the top right.
   - Switch Commission Base from **Customer Payable (Discounted)** to **Menu Price (Gross)**.
   - Toggle **GST on Commission (18% input liability)** on/off.
   - **Show the client:** Notice how all shift totals and per-order cards recalculate instantly without reloading.
3. **Drill Down into an Order**:
   - Click the **"Inspect Breakdown"** button on order `#SW-8491` (Biryani Central).
   - Walk the client through the exact ledger:
     - Item Subtotal: ₹778.00 (2 × ₹389)
     - Packaging Charge Collected: ₹44.00 (2 × ₹22)
     - Gross Inflow: ₹822.00
     - Swiggy Commission (22% + 18% GST): ₹179.80
     - Restaurant Sponsored Discount: ₹75.00
     - Recipe BOM Cost: ₹238.40 (600g Basmati Rice + 440g Chicken + 240ml Gravy)
     - Packaging Material Cost: ₹44.00
     - **Net Margin:** Clearly labeled as ₹284.80.

---

## Scenario 02: Smart Auto-86 & Portion-Aware Inventory

### 🎯 Demo Objective
Demonstrate that dishes are automatically pulled offline **before** a cook ruins an order, based on true portion BOM and manager-set safety thresholds.

### 📍 Route
Navigate to **Inventory & Stock** (`/inventory`).

### 🎬 Walkthrough Steps
1. **Stock vs Minimum Visual Clarification**:
   - Point to the **Tortilla Flatbread** card.
   - Point out the display: **`35 / min 12 pc`** with an emerald progress bar showing **`292% (Safe)`**.
   - Show how this completely replaces confusing arbitrary percentages.
2. **Testing the Portion BOM Auto-86 Rule**:
   - Tap **"Custom + Reason Code"** on **Chicken Breast / Curry Cut** (Current Stock: ~3,760g).
   - Enter a reduction delta of `-3720` (leaving just 40g in stock).
   - Select reason code: `WASTAGE_SPOILAGE` (Audit Note: "Batch spoiled during prep").
   - Click **"Confirm Adjustment"**.
3. **Verify the Auto-86 Trigger**:
   - A single portion of *Hyderabadi Chicken Dum Biryani* requires **220g** of chicken. With only 40g remaining, you cannot cook even one portion.
   - Click the **"Menu Status"** tab.
   - **Show the client:** *Hyderabadi Chicken Dum Biryani* has automatically flipped to **OFFLINE** across both **Swiggy** and **Zomato**!
   - Highlight the notice: `"Auto-86: Triggers if stock < 1 portion BOM or < min threshold"`.
4. **Audit Trail Verification**:
   - Switch to the **"Stock Ledger"** tab.
   - Point out the newly recorded entry with timestamp, user reason code, and exact variance calculation.

---

## Scenario 03: High-Urgency KDS (Live Countdown & Overdue Alarm)

### 🎯 Demo Objective
Showcase a screen purpose-built for the heat, steam, and noise of a commercial cloud kitchen floor.

### 📍 Route
Navigate to **KDS Kitchen** (`/kds`).

### 🎬 Walkthrough Steps
1. **Clear Countdown Labels**:
   - Observe active order timer pills. They explicitly display **`Xm Ys left`** (e.g. `11m 32s left`), making it unmistakable that it is a countdown.
2. **Urgency Color Coding**:
   - **Green Card (> 5 mins left):** Calm, normal prep tempo.
   - **Amber Card (0 – 5 mins left):** Expediter rush state.
   - **Flashing Red Card ($\le 0$ Overdue):** Ticket has breached SLA!
3. **Overdue Siren & Manager Notification**:
   - When a ticket crosses into overdue, notice:
     - The timer pill changes to **`OVERDUE +Xm Xs`** with a red pulse.
     - An audible web audio alert chime triggers.
     - A sticky top banner appears:  
       `🚨 MANAGER ALERT: 1 Order Has Breached SLA! Ticket #... exceeded target prep time.`
   - Tap **"Sound Siren"** to demonstrate acoustic floor alerting.
   - Tap **"Acknowledge"** to silence the expediter alert.

---

## Scenario 04: Cook Station Auto-Focus & Multi-Station Routing

### 🎯 Demo Objective
Show how multi-brand kitchens route items to the right line cooks without confusing the floor staff.

### 📍 Route
Toggle role to **Cook** in top bar $\rightarrow$ Navigate to **KDS Kitchen** (`/kds`).

### 🎬 Walkthrough Steps
1. **Default Cook Station Focus**:
   - Notice that in Cook mode, the KDS automatically focuses on **"Dum Biryani"** instead of loading all 10 stations at once.
2. **Readable Station Tab Labels**:
   - Observe the station pills: `Dum Biryani`, `Grill`, `Fry`, `Tandoor`, `Wok`, `Pizza`, `Beverage`, `Assembly`, `Packing`.
   - Point out that there is no clipping (no "ASSEME" or raw database constants).
3. **Touch-Friendly Floor Interaction**:
   - Point out the **54px+ tall item rows**.
   - A cook wearing latex gloves does not need to aim for a tiny 12px checkbox; tapping anywhere on the card checks off the item with an immediate visual strike-through and a large 32px emerald checkmark.
4. **Multi-Station Flow**:
   - Notice that Biryani displays `Station: Dum Biryani → Assembly, Packing`, showing cooks where the plate travels next.

---

## Scenario 05: Dynamic Dispatch QA & Seal Prevention

### 🎯 Demo Objective
Prevent missing items, cold orders, and rider handover mistakes before the delivery bag leaves the kitchen.

### 📍 Route
Navigate to **Dispatch & Packing** (`/packing`).

### 🎬 Walkthrough Steps
1. **KDS Completion Gatekeeper**:
   - If an order's items are still being cooked on the KDS, the Dispatch card displays a bold warning banner:  
     `⚠️ KDS Cooking In Progress: 1 item still pending on line stations.`
   - Point out that the **"Verify & Dispatch Order"** button remains locked until the line cooks finish cooking.
2. **Dynamic Checklist Intelligence**:
   - Look at the verification checklist for an order with a beverage vs an order without:
     - If the order has no beverage, the drink item is greyed out with **`N/A (No Beverage)`**.
     - If hot food is present, it dynamically prompts for **"Hot Compartment Bagged"**.
3. **Dispatch Complete**:
   - Complete all checklist items and tap **"Verify & Dispatch Order"**.
   - The card transitions to complete and moves the order to dispatched status.

---

## Scenario 06: Emergency Kitchen Pause (Panic Switch)

### 🎯 Demo Objective
Show operators how to immediately protect customer ratings and avoid cancellation penalties during power cuts or extreme dinner rushes.

### 📍 Route
Any screen (Top Header).

### 🎬 Walkthrough Steps
1. Tap the prominent red **"Emergency Pause"** button in the header.
2. In the modal, explain the two modes:
   - **Per-Channel Pause**: Pause only Swiggy if Zomato volume is manageable.
   - **Emergency Master Stop ("Pause Both Platforms")**: Immediately sets kitchen status to offline across all aggregators.
3. Tap **"Pause Both Platforms"**:
   - Notice the high-visibility warning banner across the screen:  
     `⚠️ EMERGENCY PAUSE ACTIVE: Both Swiggy & Zomato storefronts are currently halted. No new orders will arrive.`
4. Tap **"Resume Both"** to restore order intake with one tap.

---

## Scenario 07: Cook vs Owner Security & Confidentiality

### 🎯 Demo Objective
Prove that proprietary margins, commission structures, and supplier prices remain strictly hidden from kitchen line workers.

### 📍 Route
Top bar role toggle.

### 🎬 Walkthrough Steps
1. Switch role to **Cook**:
   - The navigation tabs for **Live Queue**, **Inventory**, and **Profit & Margins** disappear completely.
   - If a cook attempts to navigate directly to `/margins` or `/inventory`, they are greeted with an access-denied screen.
   - Ingredient cost figures are replaced with operational labels (`Stock SKU • g`).
2. Switch role back to **Owner**:
   - Full access to financials, custom stock adjustments, settings, and queue simulation is immediately restored.

---

## Scenario 08: Hindi Kitchen Floor Localization

### 🎯 Demo Objective
Demonstrate accessibility for kitchen helpers and non-English-speaking floor cooks.

### 📍 Route
Top bar language toggle (`EN` / `HI`).

### 🎬 Walkthrough Steps
1. Tap the **"HI"** button in the top navigation bar.
2. Point out the translations:
   - *KitchenOS* $\rightarrow$ **किचन ओएस**
   - *KDS Kitchen* $\rightarrow$ **केडीएस कुक**
   - *Dispatch* $\rightarrow$ **पैकिंग व डिस्पैच**
   - *Live Queue* $\rightarrow$ **लाइव ऑर्डर्स**
   - *Emergency Pause* $\rightarrow$ **आपातकालीन रोक**
3. Tap **"EN"** to return seamlessly to English.

---

## Quick Testing Checklist

Before starting a client demo, run through this 60-second smoke test:

- [ ] Dev server running (`http://localhost:3000`)
- [ ] Sound toggle enabled in KDS (`Chime` active)
- [ ] Role switcher set to `Owner`
- [ ] Tap **"Simulate Order"** in Live Queue to populate fresh incoming tickets
- [ ] Verify KDS ticket displays countdown ending with `"left"`
- [ ] Verify Tortilla flatbread displays `"11 / min 12 pc"` (or current stock fraction)
- [ ] Confirm Dispatch button is disabled if KDS items are unchecked
