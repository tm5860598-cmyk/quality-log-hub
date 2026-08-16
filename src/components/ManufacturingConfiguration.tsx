"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, Edit2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const DEPARTMENTS = ["juice-production", "dairy-production", "bakery-production"];

interface UnitConversion {
  id?: string;
  from_unit: string;
  to_unit: string;
  conversion_factor: number;
  base_unit: string;
  department?: string;
}

interface MaterialDensity {
  id?: string;
  material_name: string;
  density_value: number;
  from_unit: string;
  to_unit: string;
  department?: string;
}

interface CostData {
  id?: string;
  material_name: string;
  cost_per_unit: number;
  unit: string;
  department?: string;
}

interface ManufacturingParams {
  id?: string;
  department: string;
  default_waste_percent: number;
  min_batch_size?: number;
  max_batch_size?: number;
  batch_size_unit?: string;
}

export function ManufacturingConfiguration() {
  const { user } = useAuth();

  // Unit Conversions
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [newConversion, setNewConversion] = useState<UnitConversion>({
    from_unit: "",
    to_unit: "",
    conversion_factor: 1,
    base_unit: "kg",
  });
  const [editingConversion, setEditingConversion] = useState<string | null>(null);

  // Material Density
  const [densities, setDensities] = useState<MaterialDensity[]>([]);
  const [newDensity, setNewDensity] = useState<MaterialDensity>({
    material_name: "",
    density_value: 1,
    from_unit: "لتر",
    to_unit: "كجم",
  });
  const [editingDensity, setEditingDensity] = useState<string | null>(null);

  // Cost Data
  const [costs, setCosts] = useState<CostData[]>([]);
  const [newCost, setNewCost] = useState<CostData>({
    material_name: "",
    cost_per_unit: 0,
    unit: "كجم",
  });
  const [editingCost, setEditingCost] = useState<string | null>(null);

  // Manufacturing Parameters
  const [params, setParams] = useState<ManufacturingParams[]>([]);
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[0]);

  // Load data
  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    try {
      const [convData, densityData, costData, paramData] = await Promise.all([
        supabase.from("unit_conversions").select("*"),
        supabase.from("material_density").select("*"),
        supabase.from("cost_data").select("*"),
        supabase.from("manufacturing_parameters").select("*"),
      ]);

      if (convData.data) setConversions(convData.data);
      if (densityData.data) setDensities(densityData.data);
      if (costData.data) setCosts(costData.data);
      if (paramData.data) setParams(paramData.data);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  }

  // ============ UNIT CONVERSIONS ============

  async function handleAddConversion() {
    if (!user || !newConversion.from_unit || !newConversion.to_unit) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("unit_conversions")
        .insert({
          ...newConversion,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setConversions([...conversions, data]);
      setNewConversion({ from_unit: "", to_unit: "", conversion_factor: 1, base_unit: "kg" });
      toast.success("Conversion added");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  async function handleDeleteConversion(id: string) {
    try {
      const { error } = await supabase.from("unit_conversions").delete().eq("id", id);

      if (error) throw error;

      setConversions(conversions.filter((c) => c.id !== id));
      toast.success("Conversion deleted");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  // ============ MATERIAL DENSITY ============

  async function handleAddDensity() {
    if (!user || !newDensity.material_name || !newDensity.density_value) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("material_density")
        .insert({
          ...newDensity,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setDensities([...densities, data]);
      setNewDensity({
        material_name: "",
        density_value: 1,
        from_unit: "لتر",
        to_unit: "كجم",
      });
      toast.success("Density added");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  async function handleDeleteDensity(id: string) {
    try {
      const { error } = await supabase.from("material_density").delete().eq("id", id);

      if (error) throw error;

      setDensities(densities.filter((d) => d.id !== id));
      toast.success("Density deleted");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  // ============ COST DATA ============

  async function handleAddCost() {
    if (!user || !newCost.material_name || !newCost.cost_per_unit) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("cost_data")
        .insert({
          ...newCost,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCosts([...costs, data]);
      setNewCost({ material_name: "", cost_per_unit: 0, unit: "كجم" });
      toast.success("Cost data added");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  async function handleDeleteCost(id: string) {
    try {
      const { error } = await supabase.from("cost_data").delete().eq("id", id);

      if (error) throw error;

      setCosts(costs.filter((c) => c.id !== id));
      toast.success("Cost deleted");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  // ============ MANUFACTURING PARAMETERS ============

  async function handleSaveParameters() {
    if (!user) return;

    try {
      const deptParams = params.find((p) => p.department === selectedDept);

      if (deptParams?.id) {
        const { error } = await supabase
          .from("manufacturing_parameters")
          .update(deptParams)
          .eq("id", deptParams.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("manufacturing_parameters")
          .insert({
            ...deptParams,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          setParams(params.map((p) => (p.department === selectedDept ? data : p)));
        }
      }

      toast.success("Parameters saved");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    }
  }

  const currentParams = params.find((p) => p.department === selectedDept) || {
    department: selectedDept,
    default_waste_percent: 2.5,
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="conversions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="conversions">Unit Conversions</TabsTrigger>
          <TabsTrigger value="density">Material Density</TabsTrigger>
          <TabsTrigger value="costs">Cost Data</TabsTrigger>
          <TabsTrigger value="parameters">Manufacturing Params</TabsTrigger>
        </TabsList>

        {/* Unit Conversions */}
        <TabsContent value="conversions">
          <Card>
            <CardHeader>
              <CardTitle>Unit Conversions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>From Unit</Label>
                  <Input
                    value={newConversion.from_unit}
                    onChange={(e) =>
                      setNewConversion({ ...newConversion, from_unit: e.target.value })
                    }
                    placeholder="e.g., لتر"
                  />
                </div>
                <div>
                  <Label>To Unit</Label>
                  <Input
                    value={newConversion.to_unit}
                    onChange={(e) =>
                      setNewConversion({ ...newConversion, to_unit: e.target.value })
                    }
                    placeholder="e.g., كجم"
                  />
                </div>
                <div>
                  <Label>Factor</Label>
                  <Input
                    type="number"
                    value={newConversion.conversion_factor}
                    onChange={(e) =>
                      setNewConversion({
                        ...newConversion,
                        conversion_factor: parseFloat(e.target.value) || 1,
                      })
                    }
                    step="0.01"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddConversion} className="w-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-2">From</th>
                      <th className="text-left p-2">To</th>
                      <th className="text-right p-2">Factor</th>
                      <th className="text-right p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversions.map((conv) => (
                      <tr key={conv.id} className="border-b">
                        <td className="p-2">{conv.from_unit}</td>
                        <td className="p-2">{conv.to_unit}</td>
                        <td className="p-2 text-right">{conv.conversion_factor}</td>
                        <td className="p-2 text-right">
                          <Button
                            onClick={() => handleDeleteConversion(conv.id || "")}
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Density */}
        <TabsContent value="density">
          <Card>
            <CardHeader>
              <CardTitle>Material Density</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Material Name</Label>
                  <Input
                    value={newDensity.material_name}
                    onChange={(e) =>
                      setNewDensity({ ...newDensity, material_name: e.target.value })
                    }
                    placeholder="e.g., ماء"
                  />
                </div>
                <div>
                  <Label>Density Value</Label>
                  <Input
                    type="number"
                    value={newDensity.density_value}
                    onChange={(e) =>
                      setNewDensity({
                        ...newDensity,
                        density_value: parseFloat(e.target.value) || 1,
                      })
                    }
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>Unit Pair</Label>
                  <Input
                    value={`${newDensity.from_unit} → ${newDensity.to_unit}`}
                    disabled
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddDensity} className="w-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-2">Material</th>
                      <th className="text-right p-2">Density</th>
                      <th className="text-center p-2">Conversion</th>
                      <th className="text-right p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {densities.map((dens) => (
                      <tr key={dens.id} className="border-b">
                        <td className="p-2">{dens.material_name}</td>
                        <td className="p-2 text-right">{dens.density_value}</td>
                        <td className="p-2 text-center">
                          {dens.from_unit} → {dens.to_unit}
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            onClick={() => handleDeleteDensity(dens.id || "")}
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Data */}
        <TabsContent value="costs">
          <Card>
            <CardHeader>
              <CardTitle>Cost Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Material Name</Label>
                  <Input
                    value={newCost.material_name}
                    onChange={(e) =>
                      setNewCost({ ...newCost, material_name: e.target.value })
                    }
                    placeholder="Material name"
                  />
                </div>
                <div>
                  <Label>Cost per Unit (SAR)</Label>
                  <Input
                    type="number"
                    value={newCost.cost_per_unit}
                    onChange={(e) =>
                      setNewCost({
                        ...newCost,
                        cost_per_unit: parseFloat(e.target.value) || 0,
                      })
                    }
                    step="0.01"
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={newCost.unit}
                    onChange={(e) => setNewCost({ ...newCost, unit: e.target.value })}
                    placeholder="كجم"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddCost} className="w-full">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-2">Material</th>
                      <th className="text-right p-2">Cost</th>
                      <th className="text-center p-2">Unit</th>
                      <th className="text-right p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costs.map((cost) => (
                      <tr key={cost.id} className="border-b">
                        <td className="p-2">{cost.material_name}</td>
                        <td className="p-2 text-right">{cost.cost_per_unit} SAR</td>
                        <td className="p-2 text-center">{cost.unit}</td>
                        <td className="p-2 text-right">
                          <Button
                            onClick={() => handleDeleteCost(cost.id || "")}
                            size="sm"
                            variant="ghost"
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manufacturing Parameters */}
        <TabsContent value="parameters">
          <Card>
            <CardHeader>
              <CardTitle>Manufacturing Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                {DEPARTMENTS.map((dept) => (
                  <Button
                    key={dept}
                    variant={selectedDept === dept ? "default" : "outline"}
                    onClick={() => setSelectedDept(dept)}
                    size="sm"
                  >
                    {dept.split("-")[0]}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Default Waste %</Label>
                  <Input
                    type="number"
                    value={currentParams.default_waste_percent}
                    onChange={(e) =>
                      setParams(
                        params.map((p) =>
                          p.department === selectedDept
                            ? {
                                ...p,
                                default_waste_percent: parseFloat(e.target.value) || 0,
                              }
                            : p
                        )
                      )
                    }
                    step="0.1"
                  />
                </div>

                <div>
                  <Label>Min Batch Size</Label>
                  <Input
                    type="number"
                    value={currentParams.min_batch_size || ""}
                    onChange={(e) =>
                      setParams(
                        params.map((p) =>
                          p.department === selectedDept
                            ? {
                                ...p,
                                min_batch_size: parseFloat(e.target.value) || undefined,
                              }
                            : p
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Max Batch Size</Label>
                  <Input
                    type="number"
                    value={currentParams.max_batch_size || ""}
                    onChange={(e) =>
                      setParams(
                        params.map((p) =>
                          p.department === selectedDept
                            ? {
                                ...p,
                                max_batch_size: parseFloat(e.target.value) || undefined,
                              }
                            : p
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <Label>Batch Size Unit</Label>
                  <Input
                    value={currentParams.batch_size_unit || ""}
                    onChange={(e) =>
                      setParams(
                        params.map((p) =>
                          p.department === selectedDept
                            ? { ...p, batch_size_unit: e.target.value }
                            : p
                        )
                      )
                    }
                    placeholder="كجم"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveParameters} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Parameters
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
