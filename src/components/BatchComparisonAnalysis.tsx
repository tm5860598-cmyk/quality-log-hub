"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { analyzeDeviations, type DeviationAnalysis } from "@/lib/manufacturing-engine.server";

interface BatchComparisonProps {
  batchId: string;
}

export function BatchComparisonAnalysis({ batchId }: BatchComparisonProps) {
  const [batch, setBatch] = useState<any>(null);
  const [deviations, setDeviations] = useState<DeviationAnalysis[]>([]);
  const [actualOutput, setActualOutput] = useState<number>(0);
  const [actualWaste, setActualWaste] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load batch data
  useEffect(() => {
    async function loadBatch() {
      const { data, error } = await supabase
        .from("qc_batches")
        .select("*")
        .eq("id", batchId)
        .single();

      if (error) {
        toast.error("Failed to load batch");
        return;
      }

      setBatch(data);
      setActualOutput(data.actual_output || 0);
      setActualWaste(data.waste_loss || 0);
      setLoading(false);
    }

    loadBatch();
  }, [batchId]);

  // Submit actual results
  async function handleSubmitActuals() {
    if (!batch || !actualOutput) {
      toast.error("Please enter actual output");
      return;
    }

    setSubmitting(true);
    try {
      // Analyze deviations
      const devs = await analyzeDeviations(batchId, {
        actual_output: actualOutput,
        actual_waste: actualWaste,
      });

      setDeviations(devs);

      // Update batch
      const { error } = await supabase
        .from("qc_batches")
        .update({
          actual_output: actualOutput,
          actual_output_unit: batch.unit,
          waste_loss: actualWaste,
          deviations: { analysis: devs },
          status: "completed",
        })
        .eq("id", batchId);

      if (error) throw error;

      toast.success("Actual results recorded");
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  if (!batch) return <div>Batch not found</div>;

  const comparisonData = [
    {
      name: "Expected",
      value: batch.expected_output || 0,
      fill: "#10b981",
    },
    {
      name: "Actual",
      value: actualOutput,
      fill: actualOutput >= (batch.expected_output || 0) * 0.95 ? "#3b82f6" : "#ef4444",
    },
  ];

  const deviationPercent = batch.expected_output
    ? ((actualOutput - batch.expected_output) / batch.expected_output) * 100
    : 0;

  const severityColor = {
    low: "text-yellow-600 bg-yellow-50",
    medium: "text-orange-600 bg-orange-50",
    high: "text-red-600 bg-red-50",
    critical: "text-red-700 bg-red-100",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Actual vs Expected Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Actuals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="actual-output">Actual Output</Label>
              <Input
                id="actual-output"
                type="number"
                placeholder="0"
                value={actualOutput}
                onChange={(e) => setActualOutput(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-slate-600 mt-1">
                Expected: {batch.expected_output} {batch.expected_output_unit}
              </p>
            </div>

            <div>
              <Label htmlFor="actual-waste">Actual Waste/Loss</Label>
              <Input
                id="actual-waste"
                type="number"
                placeholder="0"
                value={actualWaste}
                onChange={(e) => setActualWaste(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-slate-600 mt-1">
                Expected: {batch.waste_loss} {batch.waste_loss_unit}
              </p>
            </div>

            <div className="flex flex-col justify-end">
              <Button onClick={handleSubmitActuals} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Actuals"}
              </Button>
            </div>
          </div>

          {/* Comparison Chart */}
          {actualOutput > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-4">Output Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Deviation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold flex items-center gap-2">
                      {deviationPercent > 0 ? (
                        <TrendingUp className="w-6 h-6 text-green-600" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-red-600" />
                      )}
                      <span className={deviationPercent > 0 ? "text-green-600" : "text-red-600"}>
                        {deviationPercent.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2">
                      {Math.abs(actualOutput - (batch.expected_output || 0)).toFixed(2)}{" "}
                      {batch.expected_output_unit}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Math.abs(deviationPercent) <= 5 ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Within Acceptable Range</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        <span>Outside Acceptable Range</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Deviations List */}
          {deviations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Detected Deviations</h3>
              <div className="space-y-2">
                {deviations.map((dev, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${
                      severityColor[dev.severity as keyof typeof severityColor]
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{dev.parameter_name}</p>
                        <p className="text-sm">
                          Expected: {dev.expected_value} | Actual: {dev.actual_value}
                        </p>
                      </div>
                      {dev.deviation_percent && (
                        <span className="font-bold">
                          {dev.deviation_percent > 0 ? "+" : ""}
                          {dev.deviation_percent.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
