import { supabase } from "@/integrations/supabase/client";

// ============ TYPES ============
export interface Ingredient {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  material_id?: string;
  supplier_id?: string;
  percentage?: number;
  min_percent?: number;
  max_percent?: number;
  standard_spec?: string;
  cost?: number;
  cost_unit?: string;
}

export interface RecipeStep {
  order: number;
  description: string;
  ingredient_ref?: string;
  quantity?: string;
  stir_speed?: string;
  stir_time?: string;
  temperature?: string;
  pressure?: string;
  notes?: string;
}

export interface RecipeParameters {
  pasteurization_time?: string;
  cooling_time?: string;
  filling_point?: string;
  special_instructions?: string;
  [key: string]: string | undefined;
}

export interface Recipe {
  id?: string;
  product_id: string;
  department: string;
  version: number;
  recipe_name: string;
  base_quantity: number;
  base_unit: string;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  parameters: RecipeParameters;
  specifications?: Record<string, unknown>;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CalculationInput {
  recipe_id: string;
  batch_size: number;
  batch_unit: string;
  department: string;
  notes?: string;
}

export interface CalculationResult {
  id?: string;
  recipe_id: string;
  batch_size: number;
  batch_unit: string;
  scaling_factor: number;
  scaled_ingredients: ScaledIngredient[];
  expected_output: number;
  expected_output_unit: string;
  waste_loss: number;
  waste_loss_unit: string;
  waste_percent: number;
  total_cost: number;
  cost_per_unit: number;
  currency: string;
  calculation_date: string;
  validation_status: "valid" | "warning" | "error";
  validation_messages: string[];
  explanation: string;
}

export interface ScaledIngredient extends Ingredient {
  scaled_quantity: number;
  scaled_cost?: number;
  alternatives?: MaterialSubstitution[];
}

export interface MaterialSubstitution {
  substitute_id: string;
  substitute_name: string;
  conversion_factor: number;
  quality_notes?: string;
  is_approved: boolean;
}

export interface ManufacturingSimulation {
  recipe_id: string;
  batch_size: number;
  batch_unit: string;
  materials: ScaledIngredient[];
  expected_output: number;
  expected_output_unit: string;
  expected_waste: number;
  expected_waste_unit: string;
  expected_cost: number;
  quality_parameters: Record<string, unknown>;
  critical_points: string[];
}

export interface DeviationAnalysis {
  batch_id: string;
  parameter_name: string;
  expected_value: number | string;
  actual_value: number | string;
  deviation_percent?: number;
  severity: "low" | "medium" | "high" | "critical";
  root_cause?: string;
}

// ============ UNIT CONVERSION ============

async function getUnitConversions(department?: string) {
  const { data, error } = await supabase
    .from("unit_conversions")
    .select("*")
    .match(department ? { department } : {});

  if (error) throw new Error(`Failed to fetch unit conversions: ${error.message}`);
  return data || [];
}

async function getMaterialDensity(materialId: string, fromUnit: string, toUnit: string) {
  const { data, error } = await supabase
    .from("material_density")
    .select("density_value")
    .eq("material_id", materialId)
    .eq("from_unit", fromUnit)
    .eq("to_unit", toUnit)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data?.density_value || null;
}

export async function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  department?: string,
  materialId?: string
): Promise<number> {
  if (fromUnit === toUnit) return quantity;

  // Check if it's a density-based conversion
  if (materialId) {
    const density = await getMaterialDensity(materialId, fromUnit, toUnit);
    if (density) return quantity * density;
  }

  // Check standard conversions
  const conversions = await getUnitConversions(department);
  const conversion = conversions.find(
    (c) => c.from_unit === fromUnit && c.to_unit === toUnit
  );

  if (conversion) {
    return quantity * conversion.conversion_factor;
  }

  throw new Error(
    `Cannot convert from ${fromUnit} to ${toUnit}. Conversion not defined.`
  );
}

// ============ RECIPE SCALING ============

export async function scaleRecipe(
  recipe: Recipe,
  desiredBatchSize: number,
  desiredUnit: string
): Promise<ScaledIngredient[]> {
  // Convert desired batch size to base unit if needed
  let scalingFactor = 1;
  if (desiredUnit !== recipe.base_unit) {
    const converted = await convertUnit(
      desiredBatchSize,
      desiredUnit,
      recipe.base_unit,
      recipe.department
    );
    scalingFactor = converted / recipe.base_quantity;
  } else {
    scalingFactor = desiredBatchSize / recipe.base_quantity;
  }

  const scaledIngredients: ScaledIngredient[] = [];

  for (const ingredient of recipe.ingredients) {
    const scaledQty = ingredient.quantity * scalingFactor;

    scaledIngredients.push({
      ...ingredient,
      scaled_quantity: scaledQty,
      scaled_cost: ingredient.cost ? ingredient.cost * scalingFactor : undefined,
    });
  }

  return scaledIngredients;
}

// ============ COST CALCULATION ============

export async function calculateCost(
  ingredients: ScaledIngredient[],
  batchSize: number,
  batchUnit: string,
  department?: string
): Promise<{ total: number; perUnit: number; currency: string }> {
  let totalCost = 0;
  const currency = "SAR";

  for (const ingredient of ingredients) {
    if (ingredient.material_id) {
      const { data: costData } = await supabase
        .from("cost_data")
        .select("cost_per_unit")
        .eq("material_id", ingredient.material_id)
        .eq("effective_date", new Date().toISOString().split("T")[0])
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (costData) {
        const ingredientCost = costData.cost_per_unit * ingredient.scaled_quantity;
        totalCost += ingredientCost;
      }
    } else if (ingredient.cost) {
      totalCost += ingredient.cost * ingredient.scaled_quantity;
    }
  }

  return {
    total: totalCost,
    perUnit: batchSize > 0 ? totalCost / batchSize : 0,
    currency,
  };
}

// ============ YIELD & LOSS ANALYSIS ============

export async function calculateYieldAndLoss(
  batchSize: number,
  batchUnit: string,
  department: string,
  customWastePercent?: number
): Promise<{ expectedOutput: number; outputUnit: string; waste: number; wasteUnit: string; wastePercent: number }> {
  const { data: params } = await supabase
    .from("manufacturing_parameters")
    .select("default_waste_percent")
    .eq("department", department)
    .single();

  const wastePercent = customWastePercent ?? params?.default_waste_percent ?? 2.5;
  const waste = (batchSize * wastePercent) / 100;
  const expectedOutput = batchSize - waste;

  return {
    expectedOutput,
    outputUnit: batchUnit,
    waste,
    wasteUnit: batchUnit,
    wastePercent,
  };
}

// ============ VALIDATION ============

export interface ValidationResult {
  isValid: boolean;
  level: "error" | "warning" | "info";
  messages: string[];
}

export async function validateRecipe(recipe: Recipe): Promise<ValidationResult> {
  const messages: string[] = [];
  const errors: string[] = [];

  if (!recipe.recipe_name) errors.push("Recipe name is required");
  if (recipe.base_quantity <= 0) errors.push("Base quantity must be greater than 0");
  if (!recipe.base_unit) errors.push("Base unit is required");
  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    errors.push("Recipe must have at least one ingredient");
  }

  // Validate ingredients
  let totalPercent = 0;
  for (const ing of recipe.ingredients || []) {
    if (!ing.name) errors.push("All ingredients must have a name");
    if (ing.quantity < 0) errors.push(`${ing.name}: quantity cannot be negative`);
    if (!ing.unit) errors.push(`${ing.name}: unit is required`);

    if (ing.percentage) {
      totalPercent += ing.percentage;
    }
  }

  // Check if percentages add up (if used)
  if (totalPercent > 0 && Math.abs(totalPercent - 100) > 0.1) {
    messages.push(`Warning: Ingredient percentages total ${totalPercent}%, not 100%`);
  }

  return {
    isValid: errors.length === 0,
    level: errors.length > 0 ? "error" : messages.length > 0 ? "warning" : "info",
    messages: [...errors, ...messages],
  };
}

export async function validateBatchCalculation(
  calculation: CalculationInput,
  scaledIngredients: ScaledIngredient[]
): Promise<ValidationResult> {
  const messages: string[] = [];
  const errors: string[] = [];

  if (calculation.batch_size <= 0) errors.push("Batch size must be greater than 0");
  if (!calculation.batch_unit) errors.push("Batch unit is required");
  if (!calculation.department) errors.push("Department is required");

  for (const ing of scaledIngredients) {
    if (ing.scaled_quantity < 0) {
      errors.push(`${ing.name}: scaled quantity cannot be negative`);
    }
  }

  return {
    isValid: errors.length === 0,
    level: errors.length > 0 ? "error" : messages.length > 0 ? "warning" : "info",
    messages: [...errors, ...messages],
  };
}

// ============ MATERIAL SUBSTITUTION ============

export async function getSuggestedSubstitutions(
  materialId: string,
  department?: string
): Promise<MaterialSubstitution[]> {
  const { data, error } = await supabase
    .from("material_substitution")
    .select(
      `
      substitute_material_id,
      conversion_factor,
      quality_notes,
      is_approved,
      raw_materials(name)
    `
    )
    .eq("primary_material_id", materialId)
    .eq("is_approved", true)
    .match(department ? { department } : {});

  if (error) throw error;

  return (data || []).map((row: any) => ({
    substitute_id: row.substitute_material_id,
    substitute_name: row.raw_materials?.name,
    conversion_factor: row.conversion_factor,
    quality_notes: row.quality_notes,
    is_approved: row.is_approved,
  }));
}

// ============ CALCULATE BATCH ============

export async function calculateBatch(input: CalculationInput): Promise<CalculationResult> {
  // Fetch recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", input.recipe_id)
    .single();

  if (recipeError) throw new Error(`Recipe not found: ${recipeError.message}`);

  const parsedRecipe = {
    ...recipe,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    parameters: recipe.parameters || {},
  } as Recipe;

  // Validate recipe
  const recipeValidation = await validateRecipe(parsedRecipe);
  if (!recipeValidation.isValid) {
    throw new Error(`Invalid recipe: ${recipeValidation.messages.join(", ")}`);
  }

  // Scale recipe
  const scaledIngredients = await scaleRecipe(parsedRecipe, input.batch_size, input.batch_unit);

  // Validate calculation
  const calcValidation = await validateBatchCalculation(input, scaledIngredients);

  // Calculate yield and loss
  const yieldAnalysis = await calculateYieldAndLoss(
    input.batch_size,
    input.batch_unit,
    input.department
  );

  // Calculate cost
  const costCalc = await calculateCost(
    scaledIngredients,
    input.batch_size,
    input.batch_unit,
    input.department
  );

  // Calculate scaling factor
  let scalingFactor = 1;
  if (input.batch_unit !== parsedRecipe.base_unit) {
    const converted = await convertUnit(
      input.batch_size,
      input.batch_unit,
      parsedRecipe.base_unit,
      input.department
    );
    scalingFactor = converted / parsedRecipe.base_quantity;
  } else {
    scalingFactor = input.batch_size / parsedRecipe.base_quantity;
  }

  // Generate explanation
  const explanation = generateExplanation(
    parsedRecipe,
    input.batch_size,
    input.batch_unit,
    scalingFactor,
    scaledIngredients,
    yieldAnalysis,
    costCalc
  );

  const result: CalculationResult = {
    recipe_id: input.recipe_id,
    batch_size: input.batch_size,
    batch_unit: input.batch_unit,
    scaling_factor: scalingFactor,
    scaled_ingredients: scaledIngredients,
    expected_output: yieldAnalysis.expectedOutput,
    expected_output_unit: yieldAnalysis.outputUnit,
    waste_loss: yieldAnalysis.waste,
    waste_loss_unit: yieldAnalysis.wasteUnit,
    waste_percent: yieldAnalysis.wastePercent,
    total_cost: costCalc.total,
    cost_per_unit: costCalc.perUnit,
    currency: costCalc.currency,
    calculation_date: new Date().toISOString(),
    validation_status: calcValidation.isValid ? "valid" : calcValidation.level === "warning" ? "warning" : "error",
    validation_messages: calcValidation.messages,
    explanation,
  };

  return result;
}

// ============ AI EXPLANATION ============

function generateExplanation(
  recipe: Recipe,
  batchSize: number,
  batchUnit: string,
  scalingFactor: number,
  scaledIngredients: ScaledIngredient[],
  yieldAnalysis: any,
  costCalc: any
): string {
  const lines = [
    `📊 **حساب الدفعة للمنتج: ${recipe.recipe_name}**`,
    "",
    `**معلومات الدفعة:**`,
    `- حجم الدفعة المطلوب: ${batchSize} ${batchUnit}`,
    `- الوصفة الأساسية: ${recipe.base_quantity} ${recipe.base_unit}`,
    `- معامل التوسيع: ${scalingFactor.toFixed(2)}x`,
    "",
    `**الخامات المقررة:**`,
  ];

  for (const ing of scaledIngredients) {
    lines.push(
      `- ${ing.name}: ${ing.scaled_quantity.toFixed(2)} ${ing.unit} (أصلاً: ${ing.quantity} ${ing.unit})`
    );
  }

  lines.push(
    "",
    `**الناتج والفاقد:**`,
    `- الناتج المتوقع: ${yieldAnalysis.expectedOutput.toFixed(2)} ${yieldAnalysis.outputUnit}`,
    `- الفاقد/الخسارة: ${yieldAnalysis.waste.toFixed(2)} ${yieldAnalysis.wasteUnit} (${yieldAnalysis.wastePercent.toFixed(2)}%)`,
    "",
    `**التكاليف:**`,
    `- إجمالي التكلفة: ${costCalc.total.toFixed(2)} ${costCalc.currency}`,
    `- التكلفة لكل وحدة: ${costCalc.perUnit.toFixed(2)} ${costCalc.currency}/${batchUnit}`
  );

  return lines.join("\n");
}

// ============ SAVE CALCULATION ============

export async function saveCalculation(
  calculation: CalculationResult,
  department: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("calculation_history")
    .insert({
      product_id: calculation.recipe_id,
      recipe_id: calculation.recipe_id,
      department,
      recipe_version: 1, // TODO: Get from recipe
      batch_size: calculation.batch_size,
      batch_unit: calculation.batch_unit,
      input_data: {
        scaling_factor: calculation.scaling_factor,
        ingredients: calculation.scaled_ingredients,
      },
      calculation_result: calculation,
      expected_output: calculation.expected_output,
      expected_output_unit: calculation.expected_output_unit,
      waste_loss: calculation.waste_loss,
      waste_loss_unit: calculation.waste_loss_unit,
      total_cost: calculation.total_cost,
      cost_per_unit: calculation.cost_per_unit,
      currency: calculation.currency,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ CREATE BATCH FROM CALCULATION ============

export async function createBatchFromCalculation(
  calculation: CalculationResult,
  productId: string,
  department: string,
  userId: string,
  batchNotes?: string
) {
  // Generate batch number
  const now = new Date();
  const batchNumber = `BATCH-${department.toUpperCase()}-${now.getTime()}`;

  // Create batch
  const { data: batch, error: batchError } = await supabase
    .from("qc_batches")
    .insert({
      batch_number: batchNumber,
      product_id: productId,
      category: department,
      quantity: calculation.expected_output,
      unit: calculation.expected_output_unit,
      production_date: now.toISOString().split("T")[0],
      status: "in_progress",
      recipe_id: calculation.recipe_id,
      calculation_id: calculation.id,
      batch_size: calculation.batch_size,
      expected_output: calculation.expected_output,
      expected_output_unit: calculation.expected_output_unit,
      waste_loss: calculation.waste_loss,
      waste_loss_unit: calculation.waste_loss_unit,
      cost_data: {
        total: calculation.total_cost,
        per_unit: calculation.cost_per_unit,
        currency: calculation.currency,
      },
      notes: batchNotes || `Created from calculation on ${now.toISOString()}`,
      created_by: userId,
    })
    .select()
    .single();

  if (batchError) throw batchError;

  // Create batch materials
  const materials = calculation.scaled_ingredients.map((ing) => ({
    batch_id: batch.id,
    material_name: ing.name,
    raw_material_id: ing.material_id || null,
    quantity: ing.scaled_quantity,
    unit: ing.unit,
    created_by: userId,
  }));

  const { error: materialsError } = await supabase.from("batch_materials").insert(materials);

  if (materialsError) throw materialsError;

  return batch;
}

// ============ COMPARE ACTUAL VS EXPECTED ============

export async function analyzeDeviations(
  batchId: string,
  actualData: Record<string, number | string>
): Promise<DeviationAnalysis[]> {
  const { data: batch, error: batchError } = await supabase
    .from("qc_batches")
    .select("*")
    .eq("id", batchId)
    .single();

  if (batchError) throw batchError;

  const deviations: DeviationAnalysis[] = [];

  // Output deviation
  if (batch.actual_output && batch.expected_output) {
    const deviation =
      ((batch.actual_output - batch.expected_output) / batch.expected_output) * 100;
    if (Math.abs(deviation) > 5) {
      deviations.push({
        batch_id: batchId,
        parameter_name: "Output",
        expected_value: batch.expected_output,
        actual_value: batch.actual_output,
        deviation_percent: deviation,
        severity: Math.abs(deviation) > 20 ? "high" : "medium",
      });
    }
  }

  return deviations;
}

// ============ MANUFACTURING SIMULATION ============

export async function simulateManufacturing(
  recipe: Recipe,
  batchSize: number,
  batchUnit: string,
  department: string
): Promise<ManufacturingSimulation> {
  const scaledIngredients = await scaleRecipe(recipe, batchSize, batchUnit);
  const yieldAnalysis = await calculateYieldAndLoss(batchSize, batchUnit, department);
  const costCalc = await calculateCost(scaledIngredients, batchSize, batchUnit, department);

  const { data: params } = await supabase
    .from("manufacturing_parameters")
    .select("quality_params, standard_process")
    .eq("department", department)
    .single();

  const criticalPoints: string[] = [];
  if (recipe.parameters?.pasteurization_time) {
    criticalPoints.push(`Pasteurization: ${recipe.parameters.pasteurization_time}`);
  }
  if (recipe.parameters?.cooling_time) {
    criticalPoints.push(`Cooling: ${recipe.parameters.cooling_time}`);
  }

  return {
    recipe_id: recipe.id || "",
    batch_size: batchSize,
    batch_unit: batchUnit,
    materials: scaledIngredients,
    expected_output: yieldAnalysis.expectedOutput,
    expected_output_unit: yieldAnalysis.outputUnit,
    expected_waste: yieldAnalysis.waste,
    expected_waste_unit: yieldAnalysis.wasteUnit,
    expected_cost: costCalc.total,
    quality_parameters: params?.quality_params || {},
    critical_points: criticalPoints,
  };
}
