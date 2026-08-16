# 🏭 Smart Manufacturing Engine - Setup & Usage Guide

## ⚡ Quick Start

### 1. Access the Manufacturing Engine
Navigate to: **`/manufacturing`**

The dashboard has 5 tabs:
- **Calculator** - Calculate batches from recipes
- **Recipes** - Create and manage recipes
- **Batches** - Track production and analyze results
- **Configuration** - Set up system parameters
- **Info** - Learn about features and workflow

---

## 🛠️ Initial Setup (Admin Only)

### Step 1: Configure Unit Conversions
**Go to: Configuration → Unit Conversions tab**

Add conversions for your operations:

#### Example for Juice Production:
```
From Unit: لتر
To Unit: كجم
Factor: 1.0 (for water)

From Unit: لتر
To Unit: كجم
Factor: 0.92 (for oil)
```

**Common Conversions to Add:**
- كيلوغرام ↔ غرام (1 kg = 1000 g)
- لتر ↔ مليلتر (1 L = 1000 mL)
- Department-specific conversions

---

### Step 2: Add Material Density
**Go to: Configuration → Material Density tab**

For each material that needs volume/weight conversion:

#### Example:
```
Material Name: ماء (Water)
Density Value: 1.0
From Unit: لتر
To Unit: كجم
```

---

### Step 3: Set Material Costs
**Go to: Configuration → Cost Data tab**

Add current cost per material:

#### Example:
```
Material Name: برتقال (Orange)
Cost per Unit: 2.50
Unit: كجم
Department: juice-production
```

**Notes:**
- Costs are date-effective (uses current date)
- Update when supplier prices change
- System uses latest cost for calculations

---

### Step 4: Configure Manufacturing Parameters
**Go to: Configuration → Manufacturing Params tab**

Set department-specific defaults:

#### For Juice Production:
```
Department: juice-production
Default Waste %: 2.5
Min Batch Size: 50 (كجم)
Max Batch Size: 5000 (كجم)
Batch Size Unit: كجم
```

#### For Dairy:
```
Department: dairy-production
Default Waste %: 1.5
Min Batch Size: 100
Max Batch Size: 10000
```

#### For Bakery:
```
Department: bakery-production
Default Waste %: 3.0
Min Batch Size: 25
Max Batch Size: 500
```

---

## 📦 Creating Recipes

### Step 1: Go to Recipes Tab
1. Select your department (Juice/Dairy/Bakery)
2. Select product from dropdown
3. Click **"New Recipe"** button

### Step 2: Fill Recipe Details
```
Recipe Name: Orange Juice v1
Base Quantity: 100
Base Unit: كجم
```

### Step 3: Add Ingredients
Click **"+"** to add each ingredient:

Example for Orange Juice:
```
Ingredient 1:
- Name: برتقال
- Quantity: 70
- Unit: كجم
- Percentage: 70%

Ingredient 2:
- Name: ماء
- Quantity: 28
- Unit: كجم
- Percentage: 28%

Ingredient 3:
- Name: حمض الستريك
- Quantity: 2
- Unit: كجم
- Percentage: 2%
```

**Tips:**
- Percentages should add to 100% if using them
- Quantities are for base recipe size (100 كجم in this example)
- Keep decimal places reasonable (2-3 places)

### Step 4: Save Recipe
1. Click **"Save Recipe"** button
2. System validates all fields
3. Creates version 1 automatically
4. Shows in list as "v1 - Orange Juice v1"

### Step 5: Test with Simulation
1. Select recipe from list
2. Click **"Simulate"** button
3. System shows expected output, waste, and cost for 100 كجم
4. Identifies critical control points (pasteurization, cooling, etc.)

---

## 🧮 Calculating Batches

### Step 1: Go to Calculator Tab
1. Select department (Juice/Dairy/Bakery)
2. Select product
3. Choose recipe version from dropdown

### Step 2: Enter Batch Size
```
Desired Batch Size: 500
Unit: كجم
```

### Step 3: Click "Calculate Batch"
System automatically calculates:

#### Scaled Ingredients Table
Shows each ingredient with:
- Original quantity (from recipe)
- Scaled quantity (for 500 كجم)
- Unit
- Cost

#### Yield & Loss Tab
Shows:
- Expected Output: 487.5 كجم (with 2.5% waste)
- Waste/Loss: 12.5 كجم (2.5%)
- Input Batch Size: 500 كجم

#### Costs Tab
Shows:
- Total Cost: 939.00 SAR
- Cost per Input Unit: 1.88 SAR/كجم
- Cost per Output Unit: 1.93 SAR/كجم

#### Explanation Tab
**Read this in Arabic to understand calculation!**
Shows step-by-step:
- How many times recipe was scaled
- Each ingredient breakdown
- Cost calculations

### Step 4: Create Batch (Optional)
1. Click **"Create Batch"** button
2. System generates batch number (e.g., BATCH-JUICE-1692453600)
3. Batch is ready for production
4. Batch linked to this recipe version (immutable)

**Important:** If you modify recipe later, old batches still use original recipe!

---

## 📊 Recording Production Results

### Step 1: Go to Batches Tab
1. Select your department
2. View "Recent Batches" list
3. Click on batch to analyze

### Step 2: Enter Actual Results
```
Actual Output: 489 (كجم)
Actual Waste/Loss: 11 (كجم)
```

### Step 3: Click "Submit Actuals"
System automatically:
- Calculates deviation percentage
- Compares with expected values
- Determines if within acceptable range (±5%)
- Creates deviation logs if needed

### Step 4: Review Analysis
- **Deviation Chart** shows expected vs actual
- **Status** shows if within range
- **Deviation Logs** list any issues
- Each deviation shows:
  - Type (e.g., "Output")
  - Expected vs Actual
  - Deviation %
  - Severity (Low/Medium/High/Critical)

---

## 📝 Understanding Deviations

### Severity Levels
```
✓ Green (Within Range): ±5% deviation or less
⚠ Yellow (Low): 5-10% deviation
🟠 Orange (Medium): 10-20% deviation
🔴 Red (High): 20-30% deviation
🔴 Dark Red (Critical): >30% deviation
```

### Common Causes
**Output Lower Than Expected:**
- Spillage/handling loss
- Increased processing loss
- Measurement error
- Equipment issues
- Temperature variations

**Output Higher Than Expected:**
- Less waste than expected (good!)
- Measurement/rounding
- Material shrinkage less than predicted
- Better processing efficiency

---

## 🔄 Modifying Recipes

### Creating a New Version
1. Go to **Recipes** tab
2. Select recipe from list
3. Click **"Edit"** button
4. Make changes to ingredients/quantities
5. Click **"Save Recipe"**
6. System creates v2 automatically

### Important: Version Independence
- **Old Batches:** Still use v1 (original recipe)
- **New Calculations:** Use v2 (modified recipe)
- **No Impact:** Changing recipe doesn't affect historical data
- **Full Audit Trail:** All versions saved in history

---

## 📈 Using Calculation History

### Access
**Calculator tab → Recent Calculations section** (bottom of page)

Shows your last 5 calculations with:
- Batch size
- Date calculated
- Total cost
- Currency

### Use Cases
- Compare costs over time
- See if waste % changing
- Track material consumption
- Identify trends

---

## 🎯 Key Formulas

### Scaling
```
Scaling Factor = Desired Batch Size ÷ Base Recipe Size
Scaled Ingredient = Original Ingredient × Scaling Factor
```

### Costs
```
Batch Cost = Σ(Material Scaled Quantity × Material Cost per Unit)
Per-Unit Cost = Batch Cost ÷ Batch Size
Output-Unit Cost = Batch Cost ÷ Expected Output
```

### Yield & Loss
```
Waste Amount = Batch Size × Waste Percentage
Expected Output = Batch Size - Waste Amount
Deviation % = (Actual - Expected) ÷ Expected × 100
```

---

## ⚠️ Common Issues & Solutions

### "Recipe not found"
- Make sure recipe is created and marked "active"
- Recipe must be in same department
- Check product selection

### "Cannot convert from X to Y"
- Add unit conversion in Configuration tab
- Or add material density if it's a volume/weight conversion
- Check spelling of units

### Costs appear incorrect
- Verify cost data is entered in Configuration
- Check date (uses current date's cost)
- Verify material quantities are scaled correctly

### Deviations appear high
- Check if waste % is correct for department
- Verify measurement accuracy
- May need to adjust default waste %

---

## 🔒 Important Notes

### Data Safety
- Recipes are versioned (no data loss)
- Batches linked to specific recipe version
- Calculation history is immutable
- Users can't edit old calculations

### Accuracy
- All calculations server-side (no client rounding errors)
- Uses latest cost data from database
- Respects current department settings
- Full audit trail of all changes

### Access
- Admins: Full access to all features
- QA/Production Managers: Can create recipes & calculations
- Production Engineers: Can create batches
- Warehouse: View-only access

---

## 📚 Example Workflow

### Complete Production Cycle

#### Day 1: Monday
1. Go to **Configuration** → Set up unit conversions
2. Add material costs
3. Go to **Recipes** → Create "Orange Juice v1"
4. Click Simulate to preview

#### Day 2: Tuesday (Production Planning)
1. Go to **Calculator** tab
2. Select recipe
3. Enter batch size: 1000 كجم
4. Review calculation
5. Click "Create Batch"
6. Note batch number: BATCH-JUICE-12345

#### Day 3: Wednesday (Production)
1. Manufacturing team produces batch
2. Records actual output: 975 كجم
3. Records actual waste: 25 كجم

#### Day 3: Afternoon (Analysis)
1. Go to **Batches** tab
2. Click on batch BATCH-JUICE-12345
3. Enter actual results
4. System calculates:
   - Expected: 975 كجم (with 2.5% waste)
   - Actual: 975 كجم
   - Deviation: 0% ✓ PERFECT!
5. Batch analysis complete

#### Day 4: Thursday (Improvement)
1. Found we can reduce waste to 2%
2. Go to **Recipes** → Click Edit
3. Modify recipe (system creates v2 automatically)
4. New batches use v2
5. Track if waste improved

---

## 🚀 Advanced Tips

### Cost Analysis
- Track per-unit costs over time
- Identify expensive materials
- Negotiate supplier pricing
- Optimize ingredient mix

### Waste Optimization
- Monitor waste % per batch
- Identify if waste increasing
- Adjust department default %
- Train staff to reduce losses

### Quality Tracking
- Use deviation logs to track issues
- Investigate high-severity deviations
- Implement corrective actions
- Document root causes

### Recipe Management
- Keep version history clean
- Archive old recipes
- Use clear naming (v1, v2, etc.)
- Document changes in notes

---

## 📞 Troubleshooting

**Still having issues?**
1. Check **Info tab** for feature overview
2. Review this documentation
3. Verify Configuration is complete
4. Check browser console for errors
5. Refresh page and try again

---

**Happy Manufacturing! 🎉**

*Last Updated: 2026-08-16*  
*Manufacturing Engine v1.0*
