# 🏭 Smart Manufacturing Engine - Documentation

## 📋 Overview

The **Smart Manufacturing Engine** is a comprehensive system for managing recipes, calculating batch sizes, planning production, and analyzing yield/cost across three departments: **Juices**, **Dairy**, and **Bakery**.

The system is completely decoupled by department - no data mixing, no cross-department calculations.

---

## 🎯 Core Features

### 1. **Recipe Management** (`RecipeManager.tsx`)
- Create and version recipes per product/department
- Define ingredients with quantities, units, and percentages
- Store recipe steps and processing parameters
- Support for multiple recipe versions with full history
- Manufacturing simulation before production

**Key Functions:**
- `handleNewRecipe()` - Create new recipe with auto-versioning
- `handleEdit()` - Modify existing recipes
- `handleSave()` - Save with validation and version tracking
- `handleSimulate()` - Simulate manufacturing with current recipe

---

### 2. **Manufacturing Calculator** (`ManufacturingCalculator.tsx`)
- Select recipe and desired batch size
- Automatic recipe scaling with configurable units
- Real-time cost calculation
- Yield & loss analysis
- Smart validation with warnings
- Calculation history with export

**Workflow:**
1. User selects recipe (latest active version)
2. Enters desired batch size
3. System calculates:
   - Scaling factor
   - Scaled ingredient quantities
   - Expected output & waste
   - Total & per-unit costs
4. Can create batch directly from calculation
5. Full calculation saved for audit trail

**Key Server Functions:**
- `calculateBatch()` - Main calculation orchestrator
- `scaleRecipe()` - Applies scaling factor to ingredients
- `convertUnit()` - Handles unit conversions with density support
- `calculateCost()` - Computes total & per-unit costs
- `calculateYieldAndLoss()` - Estimates waste based on department defaults
- `validateRecipe()` - Ensures recipe integrity
- `validateBatchCalculation()` - Checks calculation validity

---

### 3. **Unit Conversion & Density** (`ManufacturingConfiguration.tsx`)
Smart conversions with support for:
- Standard unit conversions (kg ↔ L, etc.)
- Material-specific density values
- Department-specific conversion rules
- Prevention of illogical conversions

**Tables:**
- `unit_conversions` - Define conversion factors
- `material_density` - Density values per material
- Support for volume/weight conversions

**Example:**
```
1 Liter Water = 1 kg (density = 1)
1 Liter Oil = 0.92 kg (density = 0.92)
```

---

### 4. **Cost Calculator** (`ManufacturingConfiguration.tsx`)
- Store cost per unit per material
- Date-effective cost tracking
- Support for multiple suppliers
- Auto-calculate batch costs

**Cost Calculation Formula:**
```
Batch Cost = Σ(Material_i.scaled_quantity × Material_i.cost_per_unit)
Per-Unit Cost = Batch Cost / Batch Size
Output-Unit Cost = Batch Cost / Expected Output
```

---

### 5. **Batch Creation & Tracking**
- Convert calculation directly to batch
- Auto-generate batch numbers with department prefix
- Link batch to recipe version (no recipe modifications affect old batches)
- Store expected values for comparison

**Batch Components:**
- Basic batch info (number, date, status)
- Linked recipe (immutable reference)
- Expected output & waste
- Material list with quantities
- Cost data snapshot
- Manufacturing parameters

---

### 6. **Actual vs Expected Comparison** (`BatchComparisonAnalysis.tsx`)
- Record actual production results
- Automatic deviation calculation
- Deviation severity classification:
  - **Low**: ≤5% deviation
  - **Medium**: 5-20% deviation
  - **High**: >20% deviation
  - **Critical**: >30% deviation

**Analysis:**
- Output comparison (bar chart)
- Deviation percentage calculation
- Waste analysis
- Status determination (within/outside acceptable range)

---

### 7. **Deviation Logging** (`deviation_logs` table)
Automatic tracking of:
- Deviation type
- Parameter name
- Expected vs actual values
- Deviation percentage
- Severity level
- Root cause investigation
- Corrective actions
- Status (open/investigating/resolved)

---

### 8. **Manufacturing Simulation**
Pre-production planning:
- Simulates entire manufacturing process
- Predicts:
  - Expected output quantity
  - Expected waste/loss
  - Expected cost
  - Quality parameters
- Identifies critical control points
- Helps with resource planning

---

### 9. **AI Explanation** (Arabic)
Detailed Arabic explanation of how quantities were calculated:
- Recipe base information
- Scaling factor applied
- Ingredient-by-ingredient breakdown
- Expected output & waste
- Cost breakdown
- Each step explained in plain Arabic

**Example Output:**
```
📊 حساب الدفعة للمنتج: عصير برتقال
معلومات الدفعة:
- حجم الدفعة المطلوب: 500 كجم
- الوصفة الأساسية: 100 كجم
- معامل التوسيع: 5.00x

الخامات المقررة:
- برتقال: 350 كجم (أصلاً: 70 كجم)
- ماء: 140 كجم (أصلاً: 28 كجم)
...
```

---

### 10. **Material Substitution** (Ready for implementation)
- Define approved substitute materials
- Automatic suggestion during calculation
- Conversion factors for substitutes
- Quality notes per substitute
- Only approved substitutes recommended

**Table:** `material_substitution`

---

### 11. **Recipe Versioning**
- Every recipe has immutable versions
- Version history preserved in `recipe_versions` table
- Changes create new version (v1 → v2 → v3)
- Old batches always reference original recipe
- No impact on historical data when recipe changes

---

### 12. **Calculation History**
- Every calculation stored with:
  - Recipe ID & version
  - Input parameters
  - Calculation results
  - User & timestamp
  - Export capability

- Allows:
  - Audit trail
  - Trend analysis
  - Cost tracking
  - Performance monitoring

---

## 🗄️ Database Schema

### Core Tables

#### `recipes`
```sql
- id: UUID (PK)
- product_id: UUID (FK → products)
- department: TEXT
- version: INTEGER
- recipe_name: TEXT
- base_quantity: NUMERIC
- base_unit: TEXT
- ingredients: JSONB (array of ingredient objects)
- steps: JSONB (array of recipe steps)
- parameters: JSONB (processing parameters)
- specifications: JSONB (quality specs)
- status: TEXT (active/archived/draft)
- created_by: UUID
- created_at/updated_at: TIMESTAMPTZ
- UNIQUE(product_id, department, version)
```

#### `recipe_versions`
```sql
- id: UUID (PK)
- recipe_id: UUID (FK)
- product_id: UUID (FK)
- version: INTEGER
- change_note: TEXT
- previous_recipe: JSONB (snapshot)
- current_recipe: JSONB (snapshot)
- created_by: UUID
- created_at: TIMESTAMPTZ
```

#### `calculation_history`
```sql
- id: UUID (PK)
- product_id: UUID (FK)
- recipe_id: UUID (FK)
- department: TEXT
- recipe_version: INTEGER
- batch_size: NUMERIC
- batch_unit: TEXT
- input_data: JSONB
- calculation_result: JSONB
- expected_output: NUMERIC
- waste_loss: NUMERIC
- total_cost: NUMERIC
- cost_per_unit: NUMERIC
- currency: TEXT (default SAR)
- created_by: UUID
- created_at: TIMESTAMPTZ (indexed)
```

#### `unit_conversions`
```sql
- id: UUID (PK)
- from_unit: TEXT
- to_unit: TEXT
- conversion_factor: NUMERIC
- base_unit: TEXT
- department: TEXT (nullable)
- description: TEXT
- created_by: UUID
- created_at/updated_at: TIMESTAMPTZ
- UNIQUE(from_unit, to_unit, department)
```

#### `material_density`
```sql
- id: UUID (PK)
- material_id: UUID (FK)
- material_name: TEXT
- density_value: NUMERIC (kg/L)
- from_unit: TEXT
- to_unit: TEXT
- department: TEXT (nullable)
- created_by: UUID
- created_at/updated_at: TIMESTAMPTZ
```

#### `cost_data`
```sql
- id: UUID (PK)
- material_id: UUID (FK)
- material_name: TEXT
- cost_per_unit: NUMERIC
- unit: TEXT
- effective_date: DATE (indexed)
- supplier_id: UUID (FK)
- currency: TEXT (SAR)
- created_by: UUID
- created_at/updated_at: TIMESTAMPTZ
```

#### `manufacturing_parameters`
```sql
- id: UUID (PK)
- department: TEXT (UNIQUE)
- default_waste_percent: NUMERIC
- min_batch_size: NUMERIC
- max_batch_size: NUMERIC
- batch_size_unit: TEXT
- quality_params: JSONB
- standard_process: JSONB
- created_by: UUID
- created_at/updated_at: TIMESTAMPTZ
```

#### `manufacturing_simulations`
```sql
- id: UUID (PK)
- recipe_id: UUID (FK)
- batch_size: NUMERIC
- batch_unit: TEXT
- simulated_materials: JSONB
- simulated_output: NUMERIC
- simulated_waste: NUMERIC
- simulated_cost: NUMERIC
- quality_prediction: JSONB
- created_by: UUID
- created_at: TIMESTAMPTZ
```

#### `deviation_logs`
```sql
- id: UUID (PK)
- batch_id: UUID (FK)
- recipe_id: UUID (FK)
- deviation_type: TEXT
- parameter_name: TEXT
- expected_value: TEXT
- actual_value: TEXT
- deviation_percent: NUMERIC
- severity: TEXT (low/medium/high/critical)
- root_cause: TEXT
- corrective_action: TEXT
- status: TEXT (open/investigating/resolved)
- created_by: UUID
- created_at/updated_at: TIMESTAMPTZ
```

#### Extended `qc_batches`
Added columns for manufacturing:
- `recipe_id` - Link to recipe
- `recipe_version` - Version snapshot
- `calculation_id` - Source calculation
- `batch_size` - Original batch size
- `expected_output/actual_output` - Comparison data
- `waste_loss` - Expected waste
- `cost_data` - JSONB with cost snapshot
- `manufacturing_params` - JSONB with production parameters
- `deviations` - JSONB with detected deviations

---

## 🚀 User Workflow

### Phase 1: Setup (First Time)
1. Admin → Configuration tab
2. Add unit conversions (kg ↔ L, etc.)
3. Add material density values
4. Add cost per material data
5. Configure department parameters (waste %, batch size limits)

### Phase 2: Recipe Creation
1. Go to Recipes tab
2. Select product and department
3. Click "New Recipe"
4. Enter recipe name and base quantity
5. Add ingredients (name, quantity, unit, %)
6. Save (auto-creates v1)
7. Click "Simulate" to preview

### Phase 3: Batch Calculation
1. Go to Calculator tab
2. Select recipe version
3. Enter desired batch size
4. System shows:
   - Scaled ingredients
   - Expected output & waste
   - Total & per-unit costs
   - Explanation in Arabic
5. Click "Create Batch" to generate production order

### Phase 4: Production
1. Manufacturing team produces batch
2. Records actual output and waste

### Phase 5: Analysis
1. Go to Batches tab
2. Select batch
3. Enter actual results
4. System automatically:
   - Calculates deviations
   - Determines severity
   - Flags out-of-range values
5. Investigate and document root causes

---

## 🔐 Security & Data Isolation

### Department Separation
- Recipes are created per department
- Calculations filtered by department
- Batches belong to department
- No cross-department data access

### Role-Based Access
- `owner/admin` - Full access
- `qa_manager/production_manager` - Can create/edit recipes & calculations
- `production_engineer` - Can create batches
- `warehouse` - Can view materials

### Row-Level Security (RLS)
All tables have RLS policies ensuring:
- Users can only see department data they have access to
- Delete operations restricted to admins
- Edit restricted to relevant roles

---

## 📊 API/Server Functions

### Main Calculation Flow
```typescript
async calculateBatch(input: CalculationInput): Promise<CalculationResult>
  ↓
- Fetch recipe
- Validate recipe
- Scale ingredients
- Calculate costs
- Calculate yield & loss
- Validate calculation
- Generate explanation
- Return result
```

### Supporting Functions

**Unit Conversion:**
```typescript
convertUnit(quantity, fromUnit, toUnit, department?, materialId?)
- Checks density tables for material
- Falls back to standard conversions
- Throws if no conversion found
```

**Cost Calculation:**
```typescript
calculateCost(ingredients, batchSize, batchUnit, department)
- Fetches latest cost data per material
- Multiplies by scaled quantity
- Returns total & per-unit cost
```

**Recipe Scaling:**
```typescript
scaleRecipe(recipe, desiredSize, desiredUnit)
- Converts batch unit to recipe base unit
- Calculates scaling factor
- Applies to all ingredients
- Returns scaled ingredients
```

**Yield & Loss:**
```typescript
calculateYieldAndLoss(batchSize, unit, department)
- Fetches department waste percentage
- Calculates waste amount
- Returns expected output
```

**Validation:**
```typescript
validateRecipe(recipe): ValidationResult
- Checks all required fields
- Validates ingredient data
- Checks percentage totals (if used)
- Returns errors/warnings
```

---

## 🎯 Implementation Status

### ✅ Completed
- Database schema design
- Server-side calculation engine
- Recipe Manager component
- Manufacturing Calculator component
- Batch Comparison Analysis component
- Configuration Management component
- Main Manufacturing route
- AI Explanation (Arabic)
- Recipe Versioning
- Calculation History
- Manufacturing Simulation
- Deviation Detection

### 🔜 Optional Enhancements
- Material Substitution recommendations (table ready)
- Advanced quality prediction modeling
- Integration with warehouse inventory
- Email notifications for deviations
- PDF export for calculations
- Manufacturing simulation visualization
- Dashboard with KPIs
- Trend analysis reports

---

## 🛠️ Technical Stack

- **Framework**: TanStack Start (React 18)
- **Database**: Supabase (PostgreSQL)
- **UI**: Radix UI + Tailwind CSS
- **State Management**: React hooks + Supabase client
- **Validation**: TypeScript + Runtime validation
- **Charts**: Recharts (for deviation analysis)
- **Notifications**: Sonner (toast)
- **Styling**: Tailwind CSS

---

## 📝 Example: Orange Juice Production

### Recipe: Orange Juice v1
```
Base: 100 كجم
Ingredients:
- برتقال (Orange): 70 كجم (70%)
- ماء (Water): 28 كجم (28%)
- حمض الستريك (Citric Acid): 2 كجم (2%)

Processing:
- Pasteurization: 65°C for 15 minutes
- Cooling: 25°C
- Filling: Hot fill
```

### Cost Data (Current)
```
برتقال: 2.50 SAR/كجم
ماء: 0.10 SAR/كجم
حمض الستريك: 5.00 SAR/كجم
```

### Manufacturing Parameters (Juice)
```
Default Waste: 2.5%
Min Batch: 50 كجم
Max Batch: 5000 كجم
```

### Calculation: 500 كجم Batch
```
Scaling Factor: 5.0x

Scaled Ingredients:
- برتقال: 350 كجم × 2.50 = 875 SAR
- ماء: 140 كجم × 0.10 = 14 SAR
- حمض الستريك: 10 كجم × 5.00 = 50 SAR

Total Batch Cost: 939 SAR
Cost per كجم: 1.88 SAR

Expected Output: 500 - (500 × 2.5%) = 487.5 كجم
Expected Waste: 12.5 كجم

Cost per Output Unit: 939 / 487.5 = 1.93 SAR/كجم
```

### Production Result (Actual)
```
Actual Output: 490 كجم
Actual Waste: 10 كجم

Deviation: (490 - 487.5) / 487.5 = +0.51% ✓ PASS
Status: Within acceptable range
```

---

## 🤝 Integration Points

The system is ready to integrate with:

1. **Warehouse Management** - Track raw material inventory
2. **QC System** - Link batch results to testing
3. **Accounting** - Cost reconciliation
4. **ERP System** - Production planning
5. **Analytics Dashboard** - Performance metrics
6. **Reporting Engine** - Generate PDF/Excel reports

---

## 📞 Support & Maintenance

For questions or issues:
- Check Manufacturing → Info tab for feature overview
- Use Configuration tab to set up system
- Review calculation history for previous batches
- Check deviation logs for production issues

---

**Version:** 1.0  
**Last Updated:** 2026-08-16  
**Status:** Ready for Production Use
