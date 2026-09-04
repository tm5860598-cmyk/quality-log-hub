"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Save,
  Eye,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  Package,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  validateRecipe,
  simulateManufacturing,
  type Recipe,
  type Ingredient,
  type RecipeStep,
  type RecipeParameters,
} from "@/lib/manufacturing-engine.server";

interface RecipeManagerProps {
  productId: string;
  department: string;
  productName?: string;
}

export function RecipeManager({ productId, department, productName }: RecipeManagerProps) {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Recipe>({
    product_id: productId,
    department,
    version: 1,
    recipe_name: "",
    base_quantity: 0,
    base_unit: "",
    ingredients: [],
    steps: [],
    parameters: {},
  });
  const [simulation, setSimulation] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load recipes
  useEffect(() => {
    async function loadRecipes() {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("product_id", productId)
        .eq("department", department)
        .order("version", { ascending: false });

      if (error) {
        toast.error("Failed to load recipes");
        return;
      }

      const parsed = (data || []).map((r: any) => ({
        ...r,
        ingredients: r.ingredients || [],
        steps: r.steps || [],
        parameters: r.parameters || {},
      }));

      setRecipes(parsed);
      if (parsed.length > 0) {
        setSelectedRecipe(parsed[0]);
      }
    }

    loadRecipes();
  }, [productId, department]);

  // Handle new recipe
  function handleNewRecipe() {
    const newVersion = Math.max(0, ...recipes.map((r) => r.version || 0)) + 1;
    setFormData({
      product_id: productId,
      department,
      version: newVersion,
      recipe_name: "",
      base_quantity: 0,
      base_unit: "",
      ingredients: [],
      steps: [],
      parameters: {},
    });
    setSelectedRecipe(null);
    setEditMode(true);
    setValidationErrors([]);
  }

  // Handle edit
  function handleEdit() {
    if (selectedRecipe) {
      setFormData(selectedRecipe);
      setEditMode(true);
      setValidationErrors([]);
    }
  }

  // Handle save
  async function handleSave() {
    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    setLoading(true);
    try {
      const validation = await validateRecipe(formData);
      if (!validation.isValid) {
        setValidationErrors(validation.messages);
        toast.error("Recipe has validation errors");
        setLoading(false);
        return;
      }

      const recipeData = {
        product_id: formData.product_id,
        department: formData.department,
        version: formData.version,
        recipe_name: formData.recipe_name,
        base_quantity: formData.base_quantity,
        base_unit: formData.base_unit,
        ingredients: formData.ingredients,
        steps: formData.steps,
        parameters: formData.parameters,
        specifications: formData.specifications || {},
        status: "active",
        created_by: user.id,
      };

      if (formData.id) {
        // Update existing
        const { error } = await supabase
          .from("recipes")
          .update(recipeData as never)
          .eq("id", formData.id);

        if (error) throw error;

        // Save version history
        const { error: versionError } = await supabase
          .from("recipe_versions")
          .insert({
            recipe_id: formData.id,
            product_id: formData.product_id,
            version: formData.version,
            change_note: "Recipe updated",
            current_recipe: recipeData as never,
            created_by: user.id,
          });

        if (versionError) console.error("Failed to save version history:", versionError);
      } else {
        // Create new
        const { data: newRecipe, error } = await supabase
          .from("recipes")
          .insert(recipeData as never)
          .select()
          .single();

        if (error) throw error;

        // Save initial version
        await supabase.from("recipe_versions").insert({
          recipe_id: newRecipe.id,
          product_id: newRecipe.product_id,
          version: newRecipe.version,
          change_note: "Recipe created",
          current_recipe: newRecipe,
          created_by: user.id,
        });

        formData.id = newRecipe.id;
      }

      setRecipes([...recipes.filter((r) => r.id !== formData.id), formData]);
      setSelectedRecipe(formData);
      setEditMode(false);
      setValidationErrors([]);
      toast.success("Recipe saved successfully");
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Add ingredient
  function addIngredient() {
    setFormData({
      ...formData,
      ingredients: [
        ...formData.ingredients,
        { name: "", quantity: 0, unit: "", percentage: 0 },
      ],
    });
  }

  // Update ingredient
  function updateIngredient(index: number, field: keyof Ingredient, value: any) {
    const updated = [...formData.ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, ingredients: updated });
  }

  // Remove ingredient
  function removeIngredient(index: number) {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter((_, i) => i !== index),
    });
  }

  // Handle simulation
  async function handleSimulate() {
    if (!selectedRecipe) {
      toast.error("Please select a recipe");
      return;
    }

    setLoading(true);
    try {
      const sim = await simulateManufacturing(selectedRecipe, 100, selectedRecipe.base_unit, department);
      setSimulation(sim);
    } catch (error: any) {
      toast.error(`Simulation failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6" />
            Recipe Manager
          </h2>
          <p className="text-slate-600">
            {productName} • {department}
          </p>
        </div>
        <Button onClick={handleNewRecipe} className="gap-2">
          <Plus className="w-4 h-4" />
          New Recipe
        </Button>
      </div>

      <Tabs defaultValue="recipes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recipes">Recipes</TabsTrigger>
          {selectedRecipe && <TabsTrigger value="simulation">Simulation</TabsTrigger>}
        </TabsList>

        {/* Recipes Tab */}
        <TabsContent value="recipes" className="space-y-4">
          {!editMode && recipes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available Recipes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          v{recipe.version} - {recipe.recipe_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          {recipe.base_quantity} {recipe.base_unit} • {recipe.ingredients?.length || 0} ingredients
                        </p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {recipe.status}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recipe Editor */}
          {editMode && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {formData.id ? "Edit Recipe" : "Create New Recipe"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <ul className="list-disc pl-5 space-y-1">
                        {validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Recipe Name</Label>
                    <Input
                      value={formData.recipe_name}
                      onChange={(e) =>
                        setFormData({ ...formData, recipe_name: e.target.value })
                      }
                      placeholder="e.g., Standard Recipe v1"
                    />
                  </div>
                  <div>
                    <Label>Base Quantity</Label>
                    <Input
                      type="number"
                      value={formData.base_quantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          base_quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Base Unit</Label>
                    <Input
                      value={formData.base_unit}
                      onChange={(e) => setFormData({ ...formData, base_unit: e.target.value })}
                      placeholder="كجم, لتر, إلخ"
                    />
                  </div>
                </div>

                {/* Ingredients */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-base font-semibold">Ingredients</Label>
                    <Button onClick={addIngredient} size="sm" variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.ingredients.map((ing, i) => (
                      <div key={i} className="grid grid-cols-6 gap-2 items-end">
                        <Input
                          placeholder="Name"
                          value={ing.name}
                          onChange={(e) => updateIngredient(i, "name", e.target.value)}
                          className="col-span-2"
                        />
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={ing.quantity}
                          onChange={(e) =>
                            updateIngredient(i, "quantity", parseFloat(e.target.value) || 0)
                          }
                        />
                        <Input
                          placeholder="Unit"
                          value={ing.unit}
                          onChange={(e) => updateIngredient(i, "unit", e.target.value)}
                        />
                        <Input
                          type="number"
                          placeholder="%"
                          value={ing.percentage || ""}
                          onChange={(e) =>
                            updateIngredient(i, "percentage", parseFloat(e.target.value) || 0)
                          }
                        />
                        <Button
                          onClick={() => removeIngredient(i)}
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Saving..." : "Save Recipe"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Recipe View */}
          {!editMode && selectedRecipe && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{selectedRecipe.recipe_name}</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={handleEdit} variant="outline" size="sm">
                    Edit
                  </Button>
                  <Button onClick={handleSimulate} size="sm" disabled={loading}>
                    <Zap className="w-4 h-4" />
                    Simulate
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-sm text-slate-600">Base Recipe</p>
                    <p className="text-lg font-bold">
                      {selectedRecipe.base_quantity} {selectedRecipe.base_unit}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-sm text-slate-600">Ingredients</p>
                    <p className="text-lg font-bold">{selectedRecipe.ingredients?.length || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-sm text-slate-600">Version</p>
                    <p className="text-lg font-bold">v{selectedRecipe.version}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Ingredients</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left p-2">Name</th>
                        <th className="text-right p-2">Quantity</th>
                        <th className="text-right p-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecipe.ingredients?.map((ing, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{ing.name}</td>
                          <td className="text-right p-2">
                            {ing.quantity} {ing.unit}
                          </td>
                          <td className="text-right p-2">
                            {ing.percentage ? `${ing.percentage.toFixed(1)}%` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Simulation Tab */}
        {selectedRecipe && (
          <TabsContent value="simulation" className="space-y-4">
            {simulation ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Manufacturing Simulation (100 {selectedRecipe.base_unit})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            Expected Output
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-600">
                            {simulation.expected_output.toFixed(2)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {simulation.expected_output_unit}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-orange-500" />
                            Expected Waste
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-orange-600">
                            {simulation.expected_waste.toFixed(2)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {simulation.expected_waste_unit}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-slate-600">
                            Expected Cost
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-slate-900">
                            {simulation.expected_cost.toFixed(2)}
                          </p>
                          <p className="text-sm text-slate-600">SAR</p>
                        </CardContent>
                      </Card>
                    </div>

                    {simulation.critical_points && simulation.critical_points.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-900 mb-2">
                          Critical Control Points
                        </h4>
                        <ul className="list-disc pl-5 space-y-1">
                          {simulation.critical_points.map((point: string, i: number) => (
                            <li key={i} className="text-sm text-yellow-800">
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-slate-500">
                  Click "Simulate" to run manufacturing simulation
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
