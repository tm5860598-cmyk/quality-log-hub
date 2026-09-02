import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManufacturingCalculator } from "@/components/ManufacturingCalculator";
import { RecipeManager } from "@/components/RecipeManager";
import { BatchComparisonAnalysis } from "@/components/BatchComparisonAnalysis";
import { ManufacturingConfiguration } from "@/components/ManufacturingConfiguration";
import { AlertTriangle, Settings, Package, Calculator, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceDepartments } from "@/lib/departments";

function ManufacturingEngine() {
  const { user } = useAuth();
  const { category: categoryParam } = Route.useSearch();
  const { departments } = useWorkspaceDepartments();
  const categories = departments.map((d) => d.key);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam ?? "juice-production");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Load products
  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, code, category")
        .eq("category", selectedCategory)
        .order("name");

      if (error) {
        toast.error("Failed to load products");
        return;
      }

      setProducts(data || []);
      if (data && data.length > 0) {
        setSelectedProduct(data[0].id);
      }
    }

    loadProducts();
  }, [selectedCategory]);

  // Load batches
  useEffect(() => {
    if (!selectedProduct) return;

    async function loadBatches() {
      const { data, error } = await supabase
        .from("qc_batches")
        .select("id, batch_number, status, production_date")
        .eq("category", selectedCategory)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Failed to load batches:", error);
        return;
      }

      setBatches(data || []);
      if (data && data.length > 0) {
        setSelectedBatch(data[0].id);
      }
    }

    loadBatches();
  }, [selectedProduct, selectedCategory]);

  useEffect(() => {
    if (categoryParam) setSelectedCategory(categoryParam);
  }, [categoryParam]);

  const selectedProductData = products.find((p) => p.id === selectedProduct);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Package className="w-8 h-8" />
                Smart Manufacturing Engine
              </h1>
              <p className="text-slate-400">
                Integrated Recipe Management, Batch Calculation & Production Planning
              </p>
            </div>
          </div>
        </div>

        {/* Department Selection */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
            >
              {departments.find((d) => d.key === cat)?.emoji}{" "}
              {departments.find((d) => d.key === cat)?.title_ar ?? cat}
            </Button>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="calculator" className="w-full bg-white rounded-lg shadow-lg">
          <TabsList className="grid w-full grid-cols-5 bg-slate-100">
            <TabsTrigger value="calculator" className="gap-2">
              <Calculator className="w-4 h-4" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="recipes" className="gap-2">
              <Package className="w-4 h-4" />
              Recipes
            </TabsTrigger>
            <TabsTrigger value="batches" className="gap-2">
              <Plus className="w-4 h-4" />
              Batches
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Info
            </TabsTrigger>
          </TabsList>

          {/* Product Selection */}
          {selectedCategory && (
            <div className="p-4 border-b bg-slate-50">
              <div className="flex items-center gap-4">
                <label className="font-semibold">Select Product:</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="px-3 py-2 border rounded-lg"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Calculator Tab */}
          <TabsContent value="calculator" className="p-6">
            {selectedProduct && selectedProductData ? (
              <ManufacturingCalculator
                productId={selectedProduct}
                department={selectedCategory}
                productName={selectedProductData.name}
                onBatchCreated={(batchId) => {
                  setSelectedBatch(batchId);
                  toast.success("Batch created successfully!");
                }}
              />
            ) : (
              <div className="text-center py-8">Select a product to continue</div>
            )}
          </TabsContent>

          {/* Recipes Tab */}
          <TabsContent value="recipes" className="p-6">
            {selectedProduct && selectedProductData ? (
              <RecipeManager
                productId={selectedProduct}
                department={selectedCategory}
                productName={selectedProductData.name}
              />
            ) : (
              <div className="text-center py-8">Select a product to continue</div>
            )}
          </TabsContent>

          {/* Batches Tab */}
          <TabsContent value="batches" className="p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-4">Recent Batches</h3>
              {batches.length > 0 ? (
                <div className="space-y-2">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedBatch(batch.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{batch.batch_number}</p>
                          <p className="text-sm text-slate-600">
                            {batch.production_date}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            batch.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-slate-500">
                    No batches found
                  </CardContent>
                </Card>
              )}
            </div>

            {selectedBatch && (
              <div className="mt-8">
                <h3 className="font-semibold mb-4">Batch Analysis</h3>
                <BatchComparisonAnalysis batchId={selectedBatch} />
              </div>
            )}
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="configuration" className="p-6">
            <ManufacturingConfiguration />
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info" className="p-6">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    System Setup
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">
                      Configuration Required
                    </h4>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li>✓ Unit Conversions (kg ↔ L, etc.)</li>
                      <li>✓ Material Density Tables</li>
                      <li>✓ Cost Data per Material</li>
                      <li>✓ Department Manufacturing Parameters</li>
                      <li>✓ Material Substitution Rules</li>
                    </ul>
                    <p className="mt-4 text-sm text-blue-900">
                      Go to <strong>Configuration</strong> tab to set these up.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manufacturing Engine Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-1">📊 Recipe Calculator</h4>
                    <p className="text-sm text-slate-600">
                      Automatic recipe scaling, cost calculation, and batch planning
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">📦 Recipe Management</h4>
                    <p className="text-sm text-slate-600">
                      Create, version, and simulate recipes before production
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">⚙️ Batch Tracking</h4>
                    <p className="text-sm text-slate-600">
                      Record actual results and compare against standards
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">💰 Cost Analysis</h4>
                    <p className="text-sm text-slate-600">
                      Total cost, per-unit cost, and loss/waste analysis
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">🔄 Unit Conversion</h4>
                    <p className="text-sm text-slate-600">
                      Smart conversions with density support for liquid/solid materials
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">⚠️ Deviation Detection</h4>
                    <p className="text-sm text-slate-600">
                      Automatic analysis of actual vs expected results
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">1</span>
                      <span>
                        <strong>Configure</strong> unit conversions, material costs, and department parameters
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">2</span>
                      <span>
                        <strong>Create Recipes</strong> for products with ingredients and steps
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">3</span>
                      <span>
                        <strong>Calculate</strong> batch size with auto-scaling and cost calculation
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">4</span>
                      <span>
                        <strong>Simulate</strong> manufacturing before production
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">5</span>
                      <span>
                        <strong>Create Batch</strong> from calculation
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">6</span>
                      <span>
                        <strong>Record Actual</strong> results after production
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-blue-600">7</span>
                      <span>
                        <strong>Analyze Deviations</strong> and investigate root causes
                      </span>
                    </li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/manufacturing")({
  ssr: false,
  component: ManufacturingEngine,
  validateSearch: (s: Record<string, unknown>) => ({
    category: typeof s.category === "string" ? s.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "محرك التصنيع | My Favourite Project" },
      { name: "description", content: "حساب التشغيلات وإدارة الوصفات وإصداراتها وتحليل الفاقد والتكلفة لكل قسم." },
      { property: "og:title", content: "محرك التصنيع | My Favourite Project" },
      { property: "og:description", content: "وصفات وإصدارات وحساب تشغيلات وتحليل انحرافات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
