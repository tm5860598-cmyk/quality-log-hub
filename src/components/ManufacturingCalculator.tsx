"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Calculator,
  Package,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  Save,
  Plus,
  Settings2,
  Zap,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  calculateBatch,
  type CalculationResult,
  type Recipe,
  type CalculationInput,
  saveCalculation,
  createBatchFromCalculation,
  analyzeDeviations,
  simulateManufacturing,
} from "@/lib/manufacturing-engine.server";

interface ManufacturingCalculatorProps {
  productId: string;
  department: string;
  productName?: string;
  onBatchCreated?: (batchId: string) => void;
}

export function ManufacturingCalculator({
  productId,
  department,
  productName,
  onBatchCreated,
}: ManufacturingCalculatorProps) {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [batchSize, setBatchSize] = useState<number>(0);
  const [batchUnit, setBatchUnit] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [calculationHistory, setCalculationHistory] = useState<CalculationResult[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ingredients: true,
    costs: true,
    yield: true,
    validation: true,
  });

  // Fetch recipes
  useEffect(() => {
    async function loadRecipes() {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("product_id", productId)
        .eq("department", department)
        .eq("status", "active")
        .order("version", { ascending: false });

      if (error) {
        toast.error(`Failed to load recipes: ${error.message}`);
        return;
      }

      const parsedRecipes = (data || []).map((r: any) => ({
        ...r,
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        parameters: r.parameters || {},
      }));

      setRecipes(parsedRecipes);
      if (parsedRecipes.length > 0) {
        setSelectedRecipe(parsedRecipes[0]);
        setBatchUnit(parsedRecipes[0].base_unit);
      }
    }

    loadRecipes();
  }, [productId, department]);

  // Load calculation history
  useEffect(() => {
    async function loadHistory() {
      const { data, error } = await supabase
        .from("calculation_history")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Failed to load calculation history:", error);
        return;
      }

      setCalculationHistory(data || []);
    }

    loadHistory();
  }, [productId]);

  // Handle calculation
  async function handleCalculate() {
    if (!selectedRecipe || !user || batchSize <= 0) {
      toast.error("Please select a recipe and enter batch size");
      return;
    }

    setLoading(true);
    try {
      const input: CalculationInput = {
        recipe_id: selectedRecipe.id || "",
        batch_size: batchSize,
        batch_unit: batchUnit,
        department,
      };

      const result = await calculateBatch(input);
      setCalculation(result);

      // Auto-save calculation
      if (result) {
        const savedCalc = await saveCalculation(result, department, user.id);
        if (savedCalc) {
          toast.success("Calculation completed and saved");
        }
      }
    } catch (error: any) {
      toast.error(`Calculation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Handle batch creation
  async function handleCreateBatch() {
    if (!calculation || !user) {
      toast.error("No calculation to create batch from");
      return;
    }

    setLoading(true);
    try {
      const batch = await createBatchFromCalculation(
        calculation,
        productId,
        department,
        user.id,
        "Created from Manufacturing Calculator"
      );

      toast.success(`Batch created: ${batch.batch_number}`);
      onBatchCreated?.(batch.id);
    } catch (error: any) {
      toast.error(`Failed to create batch: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Toggle section
  function toggleSection(section: string) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Manufacturing Calculator</h2>
            </div>
            <p className="text-blue-100">
              {productName} • {department}
            </p>
          </div>
          <BarChart3 className="w-12 h-12 opacity-30" />
        </div>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Recipe & Batch Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipe Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Select Recipe Version</Label>
              <Select
                value={selectedRecipe?.id || ""}
                onValueChange={(id) => {
                  const recipe = recipes.find((r) => r.id === id);
                  if (recipe) {
                    setSelectedRecipe(recipe);
                    setBatchUnit(recipe.base_unit);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {recipes.map((r) => (
                    <SelectItem key={r.id} value={r.id || ""}>
                      v{r.version} - {r.recipe_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Base Recipe Info */}
            {selectedRecipe && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-semibold text-slate-600">Base Recipe</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedRecipe.base_quantity} {selectedRecipe.base_unit}
                </p>
              </div>
            )}
          </div>

          {/* Batch Size Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="batch-size">Desired Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                placeholder="0"
                value={batchSize || ""}
                onChange={(e) => setBatchSize(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label htmlFor="batch-unit">Unit</Label>
              <Input
                id="batch-unit"
                type="text"
                value={batchUnit}
                onChange={(e) => setBatchUnit(e.target.value)}
              />
            </div>
          </div>

          {/* Calculate Button */}
          <Button
            onClick={handleCalculate}
            disabled={loading || !selectedRecipe || batchSize <= 0}
            size="lg"
            className="w-full gap-2"
          >
            <Zap className="w-5 h-5" />
            {loading ? "Calculating..." : "Calculate Batch"}
          </Button>
        </CardContent>
      </Card>

      {/* Validation Messages */}
      {calculation && calculation.validation_messages.length > 0 && (
        <Alert variant={calculation.validation_status === "error" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-1">
              {calculation.validation_messages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Calculation Results Tabs */}
      {calculation && (
        <Tabs defaultValue="ingredients" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ingredients">Materials</TabsTrigger>
            <TabsTrigger value="yield">Yield & Loss</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="explanation">Explanation</TabsTrigger>
          </TabsList>

          {/* Ingredients Tab */}
          <TabsContent value="ingredients" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Scaled Ingredients
                </CardTitle>
                <span className="text-sm text-slate-600">
                  Scaling Factor: {calculation.scaling_factor.toFixed(2)}x
                </span>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left p-2">Material</th>
                        <th className="text-right p-2">Original</th>
                        <th className="text-right p-2">Scaled</th>
                        <th className="text-right p-2">Unit</th>
                        <th className="text-right p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculation.scaled_ingredients.map((ing, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="p-2 font-medium">{ing.name}</td>
                          <td className="p-2 text-right text-slate-600">
                            {ing.quantity.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-semibold text-blue-600">
                            {ing.scaled_quantity.toFixed(2)}
                          </td>
                          <td className="p-2 text-right">{ing.unit}</td>
                          <td className="p-2 text-right">
                            {ing.scaled_cost ? `${ing.scaled_cost.toFixed(2)} SAR` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Yield & Loss Tab */}
          <TabsContent value="yield" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Expected Output
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {calculation.expected_output.toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {calculation.expected_output_unit}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-500" />
                    Waste/Loss
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">
                    {calculation.waste_loss.toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {calculation.waste_loss_unit} ({calculation.waste_percent.toFixed(2)}%)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Input Batch Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {calculation.batch_size.toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{calculation.batch_unit}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Costs Tab */}
          <TabsContent value="costs" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Total Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {calculation.total_cost.toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{calculation.currency}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Cost per Unit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {calculation.cost_per_unit.toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {calculation.currency}/{calculation.batch_unit}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-slate-600">
                    Cost per Output Unit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {(calculation.total_cost / calculation.expected_output).toFixed(2)}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {calculation.currency}/{calculation.expected_output_unit}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Explanation Tab */}
          <TabsContent value="explanation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  How Quantities Were Calculated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="bg-slate-50 p-4 rounded-lg overflow-x-auto font-mono text-sm whitespace-pre-wrap break-words">
                    {calculation.explanation}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Action Buttons */}
      {calculation && (
        <div className="flex gap-4 justify-end">
          <Button variant="outline" gap-2>
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <Button onClick={handleCreateBatch} disabled={loading} gap-2>
            <Plus className="w-4 h-4" />
            Create Batch
          </Button>
        </div>
      )}

      {/* Calculation History */}
      {calculationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Calculations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {calculationHistory.map((calc: any, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-lg text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        {calc.batch_size} {calc.batch_unit}
                      </p>
                      <p className="text-slate-600">
                        {new Date(calc.created_at).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {calc.total_cost?.toFixed(2)} {calc.currency}
                      </p>
                      <p className="text-slate-600">Total Cost</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
