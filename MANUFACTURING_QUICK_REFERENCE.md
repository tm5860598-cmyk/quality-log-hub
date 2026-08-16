# Smart Manufacturing Engine - Quick Reference

## 🎯 Three Easy Paths

### Path 1: Setup (Admin) ⚙️
```
Manufacturing → Configuration
  ├─ Unit Conversions (kg ↔ L)
  ├─ Material Density (for conversions)
  ├─ Cost Data (current prices)
  └─ Manufacturing Params (waste %, batch limits)
```

### Path 2: Create Recipes (QA/Production Manager) 📋
```
Manufacturing → Recipes
  ├─ Select department & product
  ├─ Click "New Recipe"
  ├─ Add ingredients
  ├─ Save (auto v1, v2, v3...)
  └─ Simulate to preview
```

### Path 3: Calculate Batches (Production Engineer) 🧮
```
Manufacturing → Calculator
  ├─ Select recipe
  ├─ Enter batch size
  ├─ Click "Calculate Batch"
  ├─ Review scaled ingredients & costs
  └─ Click "Create Batch" (ready for production)
```

### Path 4: Record Results & Analyze (QA/Production) 📊
```
Manufacturing → Batches
  ├─ Select batch
  ├─ Enter actual output/waste
  ├─ Click "Submit Actuals"
  └─ Review deviations automatically
```

---

## 📊 What Each Tab Shows

| Tab | Purpose | Who Uses | Actions |
|-----|---------|----------|---------|
| **Calculator** | Auto-scale recipes & costs | Production Engineers | Calculate, Create Batch |
| **Recipes** | Manage product recipes | QA/Prod Managers | Create, Edit, Simulate |
| **Batches** | Track production & results | QA/Production | Enter Actuals, Analyze |
| **Configuration** | System setup | Admin | Add conversions, costs, parameters |
| **Info** | Learn the system | Everyone | Read, Reference |

---

## 🔢 Key Calculations (Automatic)

### Batch Calculation Flow
```
You Enter: Batch Size → System Calculates:
  ├─ Scaling Factor (batch size ÷ recipe base)
  ├─ Scaled Ingredients (each ingredient × factor)
  ├─ Expected Output (batch size - waste %)
  ├─ Total Cost (materials summed)
  └─ Per-Unit Cost (total ÷ batch size)
```

### Deviation Analysis
```
You Enter: Actual Results → System Calculates:
  ├─ Expected vs Actual Output
  ├─ Deviation % = (Actual - Expected) ÷ Expected × 100
  ├─ Severity (Low/Med/High/Critical)
  └─ Status (Pass/Fail)
```

---

## ⚡ Essential Features

### ✓ Recipe Versioning
- v1 → v2 → v3...
- Old batches keep original version
- New recipes use latest version

### ✓ Unit Conversion
- kg ↔ liter (with density)
- Custom conversions per department
- Automatic validation

### ✓ Cost Tracking
- Real-time material costs
- Per-unit calculation
- Total batch cost

### ✓ Waste Management
- Expected waste %
- Actual vs expected
- Deviation reporting

### ✓ Audit Trail
- All calculations logged
- User & timestamp
- Exportable history

---

## 🚨 Deviation Severity

```
✓ Pass (Green)      : ±5% deviation
⚠ Low (Yellow)      : 5-10% deviation
🟠 Medium (Orange)   : 10-20% deviation  
🔴 High (Red)        : 20-30% deviation
🔴 Critical (Dark)   : >30% deviation
```

---

## 🔄 Department Separation

**No data mixes between departments!**

```
Juice Production (عصائر)
  ├─ Own recipes
  ├─ Own batches
  ├─ Own calculations
  └─ 2.5% default waste

Dairy Production (ألبان)
  ├─ Own recipes
  ├─ Own batches
  ├─ Own calculations
  └─ 1.5% default waste

Bakery Production (بيكري)
  ├─ Own recipes
  ├─ Own batches
  ├─ Own calculations
  └─ 3.0% default waste
```

---

## 💾 Data That's Saved

### When You Calculate
- Recipe version used
- Batch size entered
- Scaled ingredients
- Expected output/waste
- Total & per-unit costs
- Explanation (Arabic)

### When You Create Batch
- Batch number (auto-generated)
- Production date
- Expected results
- Linked recipe (immutable)
- Material list with costs

### When You Record Actuals
- Actual output/waste
- Deviation calculation
- Severity classification
- Timestamp & user
- Deviation logs

---

## 🎯 Formulas at a Glance

### Scaling
```
Scaling Factor = Desired Size ÷ Recipe Base Size
Scaled Ingredient = Original × Scaling Factor
```

### Costs
```
Material Cost = Quantity × Cost per Unit
Batch Cost = Σ All Materials
Per-Unit Cost = Batch Cost ÷ Batch Size
Output Cost = Batch Cost ÷ Expected Output
```

### Yield
```
Waste = Batch Size × Waste %
Output = Batch Size - Waste
Deviation % = (Actual - Expected) ÷ Expected × 100
```

---

## ⚙️ Setup Checklist

- [ ] Unit Conversions added
- [ ] Material Density defined
- [ ] Cost Data entered
- [ ] Department Waste % set
- [ ] Batch Size limits set
- [ ] First recipe created
- [ ] Recipe simulated
- [ ] First batch calculated
- [ ] First batch created
- [ ] Actual results recorded
- [ ] Deviation analysis reviewed

---

## 🆘 Quick Fixes

| Issue | Solution |
|-------|----------|
| "Cannot convert units" | Add conversion in Configuration → Unit Conversions |
| "No recipes found" | Create recipe in Recipes tab first |
| "Cost looks wrong" | Check Cost Data in Configuration (uses current date) |
| "Calculations off" | Verify unit conversions and material costs |
| "Can't create batch" | Complete calculation first, then click Create Batch |
| "Deviation formula wrong?" | Check waste % in manufacturing parameters |

---

## 📱 Mobile Access

Works on mobile! But best on:
- Desktop for calculations
- Tablet for batch review
- Mobile for quick lookups

---

## 🔐 Access Levels

```
Admin           → Everything
QA Manager      → Recipes, Calculations, View Results
Prod Manager    → Recipes, Calculations, View Results
Prod Engineer   → View Recipes, Create Batches
Warehouse       → View-only access
```

---

## 📈 Dashboard (Info Tab)

Shows:
- Feature list
- Complete workflow (7 steps)
- Integration points
- System status

---

**Print this page for quick reference!** 🖨️

*Latest Update: 2026-08-16*
